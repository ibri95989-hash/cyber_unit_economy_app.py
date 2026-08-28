"""Telegram-бот, который ведёт диалог с людьми через Claude.

Запуск:

    export TELEGRAM_BOT_TOKEN="123456:AA..."   # токен от @BotFather
    export ANTHROPIC_API_KEY="sk-ant-..."      # ключ с console.anthropic.com
    python telegram_bot.py

Бот работает на long polling: сам опрашивает Telegram, вебхук и белый IP не
нужны — достаточно машины с выходом в интернет. История каждого собеседника
хранится отдельно и в памяти процесса: перезапуск начинает разговор заново.
"""
from __future__ import annotations

import logging
import os
import signal
import sys
import threading
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from typing import Any, Deque, Dict, Iterator, Optional

import anthropic
import requests

import frequency_tool

log = logging.getLogger("telegram_bot")

API_ROOT = "https://api.telegram.org/bot{token}/{method}"

# Файл с ключами рядом со скриптом — чтобы не набирать export при каждом запуске.
ENV_FILE = ".env"

# Long polling: держим соединение 25 секунд, поэтому таймаут запроса больше.
POLL_TIMEOUT = 25
HTTP_TIMEOUT = POLL_TIMEOUT + 15

# Telegram режет сообщения длиннее 4096 символов.
TG_LIMIT = 4096

# Индикатор «печатает» живёт около 5 секунд — обновляем чуть чаще.
TYPING_REFRESH = 4

MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-5")
EFFORT = os.environ.get("CLAUDE_EFFORT", "low")
MAX_TOKENS = int(os.environ.get("CLAUDE_MAX_TOKENS", "2000"))

# Сколько реплик (свои + собеседника) помним в одном чате.
HISTORY_LIMIT = int(os.environ.get("BOT_HISTORY_LIMIT", "40"))

# Сколько собеседников обслуживаем одновременно: замер частотности идёт по
# четырём площадкам и занимает секунды, остальные не должны его ждать.
WORKERS = int(os.environ.get("BOT_WORKERS", "4"))

# Предохранитель от зацикливания на инструменте внутри одной реплики.
MAX_TOOL_ROUNDS = 4

DEFAULT_SYSTEM = (
    "Ты — дружелюбный ассистент в Telegram. Отвечай по-русски, живо и по делу, "
    "без канцелярита и без списков там, где хватает пары фраз. Держи ответ "
    "коротким: это переписка в мессенджере, а не статья. Задавай уточняющий "
    "вопрос, если он реально нужен. Ты помогаешь селлерам маркетплейсов "
    "(Wildberries, Ozon): юнит-экономика, себестоимость, комиссии, логистика, "
    "спрос и частотность запросов. Если не знаешь точную цифру — так и скажи, "
    "не выдумывай данные о конкретных товарах или продажах.\n\n"
    "Про спрос и частотность у тебя есть инструмент search_frequency — он "
    "измеряет запрос на WB, Ozon, в Яндексе и Google. Всегда зови его вместо "
    "того, чтобы прикидывать цифры по памяти. В ответе называй числа по "
    "площадкам и обязательно говори, оценка это или точные данные API; если "
    "источник не ответил — скажи прямо, что цифры по нему нет."
)

WELCOME = (
    "Привет! Я на связи — пиши что угодно, отвечу.\n\n"
    "Могу измерить спрос на любой запрос (WB, Ozon, Яндекс, Google), "
    "обсудить юнит-экономику и разобрать идею товара.\n\n"
    "Например: «сколько ищут ароматизатор в машину?»\n\n"
    "/reset — забыть наш разговор и начать с чистого листа"
)


def load_env_file(path: str = ENV_FILE) -> None:
    """Подхватить KEY=VALUE из .env, не перетирая уже заданное окружение."""
    try:
        lines = open(path, encoding="utf-8").read().splitlines()
    except OSError:
        return
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


class Config:
    """Настройки бота из переменных окружения."""

    def __init__(self) -> None:
        self.telegram_token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
        self.system_prompt = os.environ.get("BOT_SYSTEM_PROMPT", "").strip() or DEFAULT_SYSTEM
        self.proxy = os.environ.get("BOT_PROXY", "").strip() or None
        allowed = os.environ.get("TELEGRAM_ALLOWED_CHATS", "").strip()
        # Пусто — бот отвечает всем. Иначе только перечисленным chat_id.
        self.allowed_chats = {
            int(part) for part in allowed.replace(",", " ").split() if part
        }

    def require_token(self) -> str:
        if not self.telegram_token:
            raise SystemExit(
                "Не задан TELEGRAM_BOT_TOKEN. Возьмите токен у @BotFather и "
                "выполните: export TELEGRAM_BOT_TOKEN='123456:AA...'"
            )
        return self.telegram_token

    def allows(self, chat_id: int) -> bool:
        return not self.allowed_chats or chat_id in self.allowed_chats


class Telegram:
    """Тонкая обёртка над Bot API: long polling и отправка сообщений."""

    def __init__(self, token: str, proxy: Optional[str] = None) -> None:
        self._token = token
        self._proxy = proxy
        # Ответы собеседникам уходят из рабочих потоков параллельно опросу
        # Telegram, поэтому у каждого потока своя сессия.
        self._local = threading.local()
        self._offset: Optional[int] = None

    @property
    def _session(self) -> requests.Session:
        session = getattr(self._local, "session", None)
        if session is None:
            session = requests.Session()
            if self._proxy:
                session.proxies.update({"http": self._proxy, "https": self._proxy})
            self._local.session = session
        return session

    def _close_session(self) -> None:
        """Закрыть сессию текущего потока: короткоживущие потоки не копят пулы."""
        session = getattr(self._local, "session", None)
        if session is not None:
            session.close()
            self._local.session = None

    def _call(self, method: str, timeout: int = HTTP_TIMEOUT, **params: Any) -> Any:
        url = API_ROOT.format(token=self._token, method=method)
        resp = self._session.post(url, json=params, timeout=timeout)
        payload = resp.json()
        if not payload.get("ok"):
            raise RuntimeError(
                f"Telegram отклонил {method}: {payload.get('description', resp.text[:200])}"
            )
        return payload.get("result")

    def me(self) -> dict:
        return self._call("getMe", timeout=30)

    def updates(self) -> Iterator[dict]:
        """Забрать новые апдейты; блокируется до POLL_TIMEOUT секунд."""
        params: Dict[str, Any] = {
            "timeout": POLL_TIMEOUT,
            "allowed_updates": ["message"],
        }
        if self._offset is not None:
            params["offset"] = self._offset
        for update in self._call("getUpdates", **params) or []:
            self._offset = update["update_id"] + 1
            yield update

    def typing(self, chat_id: int) -> None:
        try:
            self._call("sendChatAction", timeout=30, chat_id=chat_id, action="typing")
        except Exception as exc:  # noqa: BLE001 - индикатор набора не критичен
            log.debug("Не удалось показать «печатает»: %s", exc)

    @contextmanager
    def typing_until_done(self, chat_id: int) -> Iterator[None]:
        """Держать «печатает» всё время ответа: Telegram гасит его через 5 секунд."""
        done = threading.Event()

        def keep_alive() -> None:
            try:
                while not done.is_set():
                    self.typing(chat_id)
                    done.wait(TYPING_REFRESH)
            finally:
                self._close_session()

        thread = threading.Thread(target=keep_alive, daemon=True)
        thread.start()
        try:
            yield
        finally:
            done.set()
            thread.join(timeout=1)

    def send(self, chat_id: int, text: str, reply_to: Optional[int] = None) -> None:
        for chunk in split_message(text):
            self._call(
                "sendMessage",
                timeout=60,
                chat_id=chat_id,
                text=chunk,
                reply_to_message_id=reply_to,
                # Разметку не включаем: модель пишет свободный текст, и любой
                # незакрытый * или _ уронил бы отправку с ошибкой парсинга.
                disable_web_page_preview=True,
            )
            reply_to = None


def split_message(text: str, limit: int = TG_LIMIT) -> list[str]:
    """Разбить длинный ответ на куски, стараясь резать по переводу строки."""
    text = text.strip() or "…"
    chunks: list[str] = []
    while len(text) > limit:
        cut = text.rfind("\n", 0, limit)
        if cut < limit // 2:
            cut = text.rfind(" ", 0, limit)
        if cut < limit // 2:
            cut = limit
        chunks.append(text[:cut].rstrip())
        text = text[cut:].lstrip()
    chunks.append(text)
    return chunks


class Dialogue:
    """История разговоров: у каждого чата своя, ограниченной длины."""

    def __init__(self, limit: int = HISTORY_LIMIT) -> None:
        self._limit = limit
        self._chats: Dict[int, Deque[dict]] = {}
        self._lock = threading.Lock()

    def history(self, chat_id: int) -> list[dict]:
        with self._lock:
            return list(self._chats.get(chat_id, ()))

    def add(self, chat_id: int, role: str, content: str) -> None:
        with self._lock:
            chat = self._chats.setdefault(chat_id, deque(maxlen=self._limit))
            chat.append({"role": role, "content": content})

    def drop_last_user_turn(self, chat_id: int) -> None:
        """Убрать реплику, на которую не удалось ответить."""
        with self._lock:
            chat = self._chats.get(chat_id)
            if chat and chat[-1]["role"] == "user":
                chat.pop()

    def reset(self, chat_id: int) -> None:
        with self._lock:
            self._chats.pop(chat_id, None)


class Brain:
    """Ответы Claude: один запрос на реплику, с историей чата в контексте."""

    def __init__(self, system_prompt: str, proxy: Optional[str] = None) -> None:
        kwargs: Dict[str, Any] = {}
        if proxy:
            kwargs["http_client"] = anthropic.DefaultHttpxClient(proxy=proxy)
        # Ключ подхватывается из ANTHROPIC_API_KEY или профиля `ant auth login`.
        self._client = anthropic.Anthropic(**kwargs)
        self._system = system_prompt

    def reply(self, messages: list[dict]) -> str:
        """Ответ на последнюю реплику; при необходимости идёт за частотностью.

        Обмен с инструментом остаётся внутри одного вызова: в историю чата
        уходит только готовый текст, без служебных блоков.
        """
        turns: list[dict] = list(messages)
        for _ in range(MAX_TOOL_ROUNDS):
            response = self._client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=self._system,
                # Диалог в мессенджере: важнее скорость ответа, чем глубина разбора.
                output_config={"effort": EFFORT},
                tools=[frequency_tool.TOOL],
                messages=turns,
            )
            if response.stop_reason == "refusal":
                return "Извини, на такую тему я отвечать не стану. Спроси о чём-нибудь другом."
            if response.stop_reason != "tool_use":
                return self._text_of(response) or "Мне нечего добавить — переспроси, пожалуйста, иначе."

            turns.append({"role": "assistant", "content": response.content})
            turns.append({"role": "user", "content": self._run_tools(response)})

        log.warning("Инструмент вызван %s раз подряд, отвечаю без него", MAX_TOOL_ROUNDS)
        return self._text_of(response) or (
            "Замер спроса не сошёлся с первого раза — уточни, какой именно запрос измерить."
        )

    @staticmethod
    def _text_of(response: Any) -> str:
        return "\n\n".join(
            block.text for block in response.content if block.type == "text"
        ).strip()

    @staticmethod
    def _run_tools(response: Any) -> list[dict]:
        """Выполнить все запрошенные вызовы; результаты идут одним сообщением."""
        results: list[dict] = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            query = (block.input or {}).get("query", "")
            log.info("Считаю частотность: «%s»", query)
            results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": frequency_tool.run(query),
                }
            )
        return results


class Bot:
    def __init__(self, config: Config) -> None:
        self.config = config
        self.tg = Telegram(config.require_token(), config.proxy)
        # Источники частотности ходят через тот же прокси, что и сам бот.
        frequency_tool.configure(config.proxy)
        self.brain = Brain(config.system_prompt, config.proxy)
        self.dialogue = Dialogue()
        self._pool = ThreadPoolExecutor(max_workers=WORKERS, thread_name_prefix="chat")
        self._running = True

    def stop(self, *_: Any) -> None:
        self._running = False
        log.info("Останавливаюсь…")

    def _handle_safely(self, message: dict) -> None:
        """Ошибка в одном разговоре не должна ронять пул и остальные чаты."""
        try:
            self.handle(message)
        except Exception:  # noqa: BLE001 - логируем и продолжаем работать
            log.exception("Не смог обработать сообщение")

    def shutdown(self) -> None:
        """Дать текущим ответам уйти в Telegram перед выходом."""
        self._pool.shutdown(wait=True)

    def run(self) -> None:
        me = self.tg.me()
        log.info("Бот @%s запущен, модель %s", me.get("username", "?"), MODEL)
        backoff = 1
        while self._running:
            try:
                for update in self.tg.updates():
                    self._pool.submit(self._handle_safely, update.get("message") or {})
                backoff = 1
            except requests.RequestException as exc:
                log.warning("Сеть недоступна (%s), повтор через %ss", exc, backoff)
                time.sleep(backoff)
                backoff = min(backoff * 2, 60)
            except RuntimeError as exc:
                # Чаще всего это 409: где-то запущен второй экземпляр бота.
                log.error("%s", exc)
                time.sleep(min(backoff * 2, 60))
                backoff = min(backoff * 2, 60)

    def handle(self, message: dict) -> None:
        chat_id = (message.get("chat") or {}).get("id")
        text = (message.get("text") or "").strip()
        if not chat_id or not text:
            return
        if not self.config.allows(chat_id):
            log.info("Чат %s не в списке разрешённых, пропускаю", chat_id)
            return

        command = text.split()[0].split("@")[0].lower() if text.startswith("/") else ""
        if command in ("/start", "/help"):
            self.dialogue.reset(chat_id)
            self.tg.send(chat_id, WELCOME)
            return
        if command == "/reset":
            self.dialogue.reset(chat_id)
            self.tg.send(chat_id, "Готово, разговор начат заново.")
            return

        self.dialogue.add(chat_id, "user", text)
        try:
            # Замер частотности длится секунды — держим «печатает» до конца.
            with self.tg.typing_until_done(chat_id):
                answer = self.brain.reply(self.dialogue.history(chat_id))
        except anthropic.RateLimitError:
            self.dialogue.drop_last_user_turn(chat_id)
            self.tg.send(chat_id, "Слишком много запросов подряд — напиши ещё раз через минуту.")
            return
        except anthropic.AuthenticationError:
            self.dialogue.drop_last_user_turn(chat_id)
            log.error("Claude не принял ключ: проверьте ANTHROPIC_API_KEY")
            self.tg.send(chat_id, "У меня проблема с доступом к модели, уже разбираемся.")
            return
        except anthropic.APIStatusError as exc:
            self.dialogue.drop_last_user_turn(chat_id)
            log.error("Claude ответил ошибкой %s: %s", exc.status_code, exc.message)
            self.tg.send(chat_id, "Не получилось ответить, попробуй ещё раз.")
            return
        except anthropic.APIConnectionError as exc:
            self.dialogue.drop_last_user_turn(chat_id)
            log.error("Нет связи с Claude: %s", exc)
            self.tg.send(chat_id, "Пропала связь с моделью, повтори сообщение чуть позже.")
            return

        self.dialogue.add(chat_id, "assistant", answer)
        self.tg.send(chat_id, answer, reply_to=message.get("message_id"))


def main() -> int:
    load_env_file()
    logging.basicConfig(
        level=os.environ.get("BOT_LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(message)s",
    )
    bot = Bot(Config())
    signal.signal(signal.SIGINT, bot.stop)
    signal.signal(signal.SIGTERM, bot.stop)
    bot.run()
    bot.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
