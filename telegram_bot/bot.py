"""Telegram-бот для общения с DeepSeek (по умолчанию — deepseek-reasoner).

Запуск:
    export TELEGRAM_BOT_TOKEN=...   # от @BotFather
    export DEEPSEEK_API_KEY=...     # platform.deepseek.com
    export ALLOWED_USER_IDS=123456  # ваш Telegram ID (бот подскажет его сам)
    python -m telegram_bot.bot

Работает через long polling: не нужен ни домен, ни открытый порт.
Все настройки — в переменных окружения, см. README.
"""

from __future__ import annotations

import html
import json
import logging
import os
import re
import threading
import time
from pathlib import Path

import requests

log = logging.getLogger("deepseek-bot")

TELEGRAM_LIMIT = 4096
MODELS = {"reasoner": "deepseek-reasoner", "chat": "deepseek-chat"}

HELP = (
    "Я передаю ваши сообщения в DeepSeek и помню контекст диалога.\n\n"
    "/new — начать новый диалог (забыть контекст)\n"
    "/model — показать или сменить модель: /model reasoner | chat\n"
    "/think — показывать ход рассуждений: /think on | off\n"
    "/id — ваш Telegram ID\n"
    "/help — эта справка"
)

COMMANDS = [
    {"command": "new", "description": "Новый диалог"},
    {"command": "model", "description": "Модель: reasoner | chat"},
    {"command": "think", "description": "Ход рассуждений: on | off"},
    {"command": "id", "description": "Мой Telegram ID"},
    {"command": "help", "description": "Справка"},
]


class Config:
    def __init__(self, env: dict[str, str] | None = None) -> None:
        env = os.environ if env is None else env
        self.telegram_token = env.get("TELEGRAM_BOT_TOKEN", "").strip()
        self.deepseek_key = env.get("DEEPSEEK_API_KEY", "").strip()
        self.telegram_api = env.get("TELEGRAM_API_URL", "https://api.telegram.org").rstrip("/")
        self.deepseek_api = env.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
        self.default_model = env.get("DEEPSEEK_MODEL", MODELS["reasoner"]).strip()
        self.system_prompt = env.get("SYSTEM_PROMPT", "").strip()
        # Сколько последних сообщений (вопросов и ответов) уходит в модель.
        self.history_limit = int(env.get("HISTORY_LIMIT", "30"))
        self.request_timeout = int(env.get("DEEPSEEK_TIMEOUT", "600"))
        # Прокси только для Telegram — на случай, если api.telegram.org недоступен.
        self.telegram_proxy = env.get("TELEGRAM_PROXY", "").strip()
        self.state_file = env.get("STATE_FILE", "bot_state.json").strip()

        allowed = env.get("ALLOWED_USER_IDS", "").replace(";", ",")
        self.allow_all = allowed.strip() == "*"
        self.allowed_ids = {
            int(part) for part in allowed.split(",") if part.strip().lstrip("-").isdigit()
        }

    def missing(self) -> list[str]:
        return [
            name
            for name, value in (
                ("TELEGRAM_BOT_TOKEN", self.telegram_token),
                ("DEEPSEEK_API_KEY", self.deepseek_key),
            )
            if not value
        ]


class Store:
    """Настройки и история чатов; переживают перезапуск через JSON-файл."""

    def __init__(self, path: str) -> None:
        self._path = Path(path) if path else None
        self._lock = threading.Lock()
        self._chats: dict[str, dict] = {}
        if self._path and self._path.exists():
            try:
                self._chats = json.loads(self._path.read_text("utf-8"))
            except (OSError, ValueError):
                log.warning("Не удалось прочитать %s, начинаю с пустой истории", self._path)

    def get(self, chat_id: int) -> dict:
        with self._lock:
            chat = self._chats.setdefault(str(chat_id), {})
            chat.setdefault("history", [])
            return json.loads(json.dumps(chat))

    def update(self, chat_id: int, **fields) -> None:
        with self._lock:
            self._chats.setdefault(str(chat_id), {"history": []}).update(fields)
            if not self._path:
                return
            try:
                tmp = self._path.with_suffix(".tmp")
                tmp.write_text(json.dumps(self._chats, ensure_ascii=False), "utf-8")
                tmp.replace(self._path)
            except OSError as exc:
                log.warning("Не удалось сохранить историю: %s", exc)


def split_text(text: str, limit: int = TELEGRAM_LIMIT) -> list[str]:
    """Режет длинный ответ на части, по возможности по границам абзацев и строк."""
    parts = []
    while len(text) > limit:
        cut = text.rfind("\n\n", 0, limit)
        if cut < limit // 2:
            cut = text.rfind("\n", 0, limit)
        if cut < limit // 2:
            cut = text.rfind(" ", 0, limit)
        if cut < limit // 2:
            cut = limit
        parts.append(text[:cut].rstrip())
        text = text[cut:].lstrip("\n")
    if text.strip():
        parts.append(text)
    return parts


def to_html(text: str) -> str:
    """Переводит Markdown из ответа модели в HTML, который понимает Telegram."""
    stash: list[str] = []

    def keep(fragment: str) -> str:
        stash.append(fragment)
        return f"\x00{len(stash) - 1}\x00"

    def block(match: re.Match) -> str:
        return keep(f"<pre>{html.escape(match.group(1).strip(chr(10)), quote=False)}</pre>")

    def inline(match: re.Match) -> str:
        return keep(f"<code>{html.escape(match.group(1), quote=False)}</code>")

    text = re.sub(r"```[^\n`]*\n?(.*?)```", block, text, flags=re.S)
    text = re.sub(r"`([^`\n]+)`", inline, text)
    text = html.escape(text, quote=False)
    text = re.sub(r"\*\*(?=\S)(.+?)(?<=\S)\*\*", r"<b>\1</b>", text, flags=re.S)
    text = re.sub(r"^#{1,6}\s+(.+)$", r"<b>\1</b>", text, flags=re.M)
    return re.sub(r"\x00(\d+)\x00", lambda m: stash[int(m.group(1))], text)


class Bot:
    def __init__(self, config: Config) -> None:
        self.cfg = config
        self.store = Store(config.state_file)
        self.tg = requests.Session()
        if config.telegram_proxy:
            self.tg.proxies = {"http": config.telegram_proxy, "https": config.telegram_proxy}
        self.ai = requests.Session()
        self._locks: dict[int, threading.Lock] = {}
        self._locks_guard = threading.Lock()

    # --- Telegram -----------------------------------------------------------

    def call(self, method: str, http_timeout: int = 30, **params) -> dict:
        url = f"{self.cfg.telegram_api}/bot{self.cfg.telegram_token}/{method}"
        response = self.tg.post(url, json=params, timeout=http_timeout)
        data = response.json()
        if not data.get("ok"):
            raise RuntimeError(f"Telegram {method}: {data.get('description', response.status_code)}")
        return data["result"]

    def send(self, chat_id: int, text: str, formatted: bool = False) -> None:
        for part in split_text(text):
            if formatted:
                try:
                    self.call("sendMessage", chat_id=chat_id, text=to_html(part), parse_mode="HTML")
                    continue
                except RuntimeError:
                    pass  # разметка не прошла — отправляем как обычный текст
            self.call("sendMessage", chat_id=chat_id, text=part)

    def _typing(self, chat_id: int, stop: threading.Event) -> None:
        while not stop.is_set():
            try:
                self.call("sendChatAction", chat_id=chat_id, action="typing")
            except Exception:  # индикатор не критичен
                pass
            stop.wait(4)

    # --- DeepSeek -----------------------------------------------------------

    def ask(self, model: str, history: list[dict]) -> tuple[str, str]:
        messages = list(history)
        if self.cfg.system_prompt:
            messages.insert(0, {"role": "system", "content": self.cfg.system_prompt})
        response = self.ai.post(
            f"{self.cfg.deepseek_api}/chat/completions",
            headers={"Authorization": f"Bearer {self.cfg.deepseek_key}"},
            json={"model": model, "messages": messages, "stream": False},
            timeout=(15, self.cfg.request_timeout),
        )
        if response.status_code != 200:
            try:
                detail = response.json()["error"]["message"]
            except Exception:
                detail = response.text[:300]
            raise RuntimeError(f"DeepSeek ответил {response.status_code}: {detail}")
        message = response.json()["choices"][0]["message"]
        return (message.get("content") or "").strip(), (message.get("reasoning_content") or "").strip()

    # --- Обработка сообщений --------------------------------------------------

    def allowed(self, user_id: int) -> bool:
        return self.cfg.allow_all or user_id in self.cfg.allowed_ids

    def handle(self, message: dict) -> None:
        chat_id = message["chat"]["id"]
        user_id = (message.get("from") or {}).get("id", 0)
        text = (message.get("text") or message.get("caption") or "").strip()

        if not self.allowed(user_id):
            self.send(
                chat_id,
                f"Доступ закрыт. Ваш Telegram ID: {user_id}\n"
                "Владелец бота должен добавить его в ALLOWED_USER_IDS и перезапустить бота.",
            )
            return
        if not text:
            self.send(chat_id, "Я понимаю только текстовые сообщения.")
            return

        if text.startswith("/"):
            command, _, arg = text.partition(" ")
            self.command(chat_id, user_id, command.split("@")[0].lower(), arg.strip().lower())
            return

        with self._locks_guard:
            lock = self._locks.setdefault(chat_id, threading.Lock())
        with lock:  # сообщения одного чата обрабатываются по очереди
            self.reply(chat_id, text)

    def command(self, chat_id: int, user_id: int, command: str, arg: str) -> None:
        chat = self.store.get(chat_id)
        model = chat.get("model", self.cfg.default_model)
        if command in ("/start", "/help"):
            self.send(chat_id, f"Привет! Сейчас модель: {model}\n\n{HELP}")
        elif command in ("/new", "/reset"):
            self.store.update(chat_id, history=[])
            self.send(chat_id, "Контекст очищен, начинаем новый диалог.")
        elif command == "/id":
            self.send(chat_id, f"Ваш Telegram ID: {user_id}")
        elif command == "/model":
            if not arg:
                self.send(chat_id, f"Сейчас: {model}\nСменить: /model reasoner или /model chat")
            else:
                new_model = MODELS.get(arg, arg)
                self.store.update(chat_id, model=new_model)
                self.send(chat_id, f"Модель: {new_model}")
        elif command == "/think":
            if arg in ("on", "off"):
                self.store.update(chat_id, think=arg == "on")
                state = "показываю" if arg == "on" else "скрываю"
                self.send(chat_id, f"Ход рассуждений: {state}.")
            else:
                state = "включён" if chat.get("think") else "выключен"
                self.send(chat_id, f"Показ рассуждений {state}. Переключить: /think on или /think off")
        else:
            self.send(chat_id, "Не знаю такой команды. /help — список команд.")

    def reply(self, chat_id: int, text: str) -> None:
        chat = self.store.get(chat_id)
        model = chat.get("model", self.cfg.default_model)
        history = chat["history"] + [{"role": "user", "content": text}]
        history = history[-self.cfg.history_limit :]
        while history and history[0]["role"] != "user":
            history.pop(0)

        stop = threading.Event()
        threading.Thread(target=self._typing, args=(chat_id, stop), daemon=True).start()
        try:
            answer, reasoning = self.ask(model, history)
        except requests.Timeout:
            self.send(chat_id, "DeepSeek не успел ответить. Попробуйте ещё раз или /model chat.")
            return
        except Exception as exc:
            log.exception("Ошибка запроса к DeepSeek")
            self.send(chat_id, f"Не удалось получить ответ: {exc}")
            return
        finally:
            stop.set()

        if reasoning and chat.get("think"):
            self.send(chat_id, f"Ход рассуждений:\n\n{reasoning}")
        if not answer:
            self.send(chat_id, "Модель вернула пустой ответ. Попробуйте переформулировать.")
            return
        # В историю идёт только итоговый ответ: рассуждения обратно в API не передаются.
        self.store.update(chat_id, history=history + [{"role": "assistant", "content": answer}])
        self.send(chat_id, answer, formatted=True)

    def _safe_handle(self, message: dict) -> None:
        try:
            self.handle(message)
        except Exception:
            log.exception("Ошибка обработки сообщения")

    # --- Главный цикл -----------------------------------------------------------

    def run(self) -> None:
        me = self.call("getMe")
        self.call("deleteWebhook")
        self.call("setMyCommands", commands=COMMANDS)
        log.info("Бот @%s запущен, модель по умолчанию: %s", me.get("username"), self.cfg.default_model)
        if not self.cfg.allow_all and not self.cfg.allowed_ids:
            log.warning("ALLOWED_USER_IDS пуст: бот никому не отвечает, но подскажет ваш ID.")

        offset = 0
        while True:
            try:
                updates = self.call(
                    "getUpdates", http_timeout=70, offset=offset, timeout=60,
                    allowed_updates=["message"],
                )
            except Exception as exc:
                log.warning("Нет связи с Telegram: %s", exc)
                time.sleep(5)
                continue
            for update in updates:
                offset = update["update_id"] + 1
                if "message" in update:
                    threading.Thread(
                        target=self._safe_handle, args=(update["message"],), daemon=True
                    ).start()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    config = Config()
    if config.missing():
        raise SystemExit("Не заданы переменные окружения: " + ", ".join(config.missing()))
    Bot(config).run()


if __name__ == "__main__":
    main()
