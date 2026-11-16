# :bar_chart: Wildberries — анализ юнит-экономики

Streamlit-приложение для анализа выгрузок из личного кабинета продавца Wildberries.
Загрузите отчёт (CSV/Excel), сопоставьте колонки, впишите себестоимость — приложение
посчитает выручку, издержки маркетплейса (комиссия, логистика, хранение, штрафы),
валовую прибыль, маржинальность и ROI по каждому артикулу.

### Как запустить локально

1. Установите зависимости

   ```
   $ pip install -r requirements.txt
   ```

2. Запустите приложение

   ```
   $ streamlit run streamlit_app.py
   ```

3. Загрузите файл отчёта WB (плоская таблица с заголовками в первой строке) и
   проверьте автоматически определённые колонки.

## Частотность запросов (WB / Ozon / Яндекс / Google)

Отдельное приложение `search_frequency_app.py`: вводите любой запрос
(«ароматизатор в машину», «магнитный держатель») и сразу видите, сколько раз
его ищут в месяц на четырёх площадках. **Ключи не нужны.**

```bash
pip install -r requirements.txt
streamlit run search_frequency_app.py
```

### Как считается без ключей

Основа — Google Trends: публичный, без токенов и регистрации. Он даёт
относительный интерес, а абсолютные показы получаются калибровкой — запрос
сравнивается с опорным словом, месячная частотность которого известна заранее
(таблица опор в `frequency/trends.py`, код сам подбирает опору подходящего
масштаба).

| Источник | Что складывается в оценку |
|---|---|
| Яндекс | калиброванный замер Trends по России |
| Wildberries | товары в публичной выдаче WB + доля веб-спроса, доходящая до площадки |
| Ozon | товары в публичной выдаче Ozon + та же доля спроса |
| Google | доля Google в поиске РФ от базового замера |

Если Trends ограничит частоту обращений, спрос восстанавливается обратным
ходом по выдаче WB и Ozon — цифры остаются на месте. Коэффициенты модели
вынесены в `frequency/estimate.py`.

### Деплой на Streamlit Cloud

1. Откройте [share.streamlit.io](https://share.streamlit.io) и войдите через GitHub.
2. **Create app → Deploy a public app from GitHub** и заполните:
   - Repository: `ibri95989-hash/cyber_unit_economy_app.py`
   - Branch: `claude/search-frequency-aggregator-li8h4z` (или `main`, если вольёте ветку)
   - Main file path: `search_frequency_app.py`
3. **Deploy.** Зависимости ставятся из `requirements.txt` автоматически.
4. Необязательно: **Settings → Secrets** — вставьте содержимое
   `.streamlit/secrets.toml.example` со своими значениями, чтобы прокси и ключи
   подставлялись сами и их не пришлось вводить в каждой сессии.

Важно про облако: серверы Streamlit Cloud находятся за пределами РФ, и
Wildberries с Ozon нередко не отвечают на запросы из дата-центров. Приложение
это переживёт — оценка достроится по Google Trends, — но если нужны и цифры
маркетплейсов, пропишите в секретах `proxy` с российским адресом.

### Запуск в Docker

```bash
docker build -t frequency-app .
docker run --rm -p 8501:8501 frequency-app
```

Приложение открывается на http://localhost:8501. Полезные варианты запуска:

```bash
# свой порт (Render, Cloud Run и Heroku подставляют PORT сами)
docker run --rm -e PORT=8080 -p 8080:8080 frequency-app

# прокси и ключи без ввода в интерфейсе
docker run --rm -p 8501:8501 \
  -v "$PWD/.streamlit/secrets.toml:/app/.streamlit/secrets.toml:ro" frequency-app
```

Контейнер работает не из-под root и отдаёт healthcheck по `/healthz`, так что
годится для Render, Cloud Run и Kubernetes без доработок.

### Работа через прокси

Если WB, Ozon или Google Trends не открываются напрямую (корпоративная сеть,
блокировки, VPN), укажите прокси — он применяется сразу ко всем источникам.

- **В интерфейсе:** боковая панель → «Сеть» → адрес прокси → «Проверить
  соединение». Поддерживаются `http://`, `https://` и `socks5://`, в том числе
  с логином и паролем: `http://user:pass@host:port`.
- **Из окружения:** галочка «Использовать системный прокси» подхватывает
  `HTTPS_PROXY` / `HTTP_PROXY`, если поле пустое.
- **В CLI:** `python check_sources.py --proxy socks5://127.0.0.1:1080 "запрос"`
  (`--no-system-proxy` — игнорировать переменные окружения).

Для схемы `socks5://` нужен пакет `requests[socks]`, он уже в
`requirements.txt`.

### Проверка источников из терминала

```bash
python check_sources.py "ароматизатор в машину"
```

Печатает ответ каждого источника и сразу показывает, доступны ли с этой машины
Google Trends, WB и Ozon (код возврата 1, если не ответил никто).

### Ключи (по желанию, для точных цифр)

| Источник | Реальные данные | Что нужно |
|---|---|---|
| Яндекс | Wordstat API или XMLRiver | OAuth-токен Вордстата / user+key XMLRiver |
| Wildberries | отчёт «Поисковые запросы» | токен продавца с правом «Аналитика» |
| Ozon | статистика фраз Performance API | Client Id + Client Secret |

Ключи вводятся в боковой панели и нигде не сохраняются. Карточки с точными
данными помечаются зелёным бейджем, оценки — жёлтым.

## Telegram-бот для DeepSeek

В каталоге `telegram_bot/` лежит бот, через который можно переписываться с
DeepSeek прямо в Telegram. По умолчанию используется рассуждающая модель
`deepseek-reasoner`. Бот помнит контекст диалога, режет длинные ответы на
части и работает через long polling — домен и открытый порт не нужны.

### Что понадобится

1. **Токен бота** — напишите [@BotFather](https://t.me/BotFather) → `/newbot`.
2. **Ключ DeepSeek** — [platform.deepseek.com](https://platform.deepseek.com) → API keys
   (на балансе должны быть средства).
3. **Ваш Telegram ID** — запустите бота без `ALLOWED_USER_IDS` и напишите ему:
   он ответит вашим ID. Впишите его и перезапустите.

### Запуск

```bash
export TELEGRAM_BOT_TOKEN=123456:ABC...
export DEEPSEEK_API_KEY=sk-...
export ALLOWED_USER_IDS=123456789
pip install "requests[socks]"
python -m telegram_bot.bot
```

Или в Docker (сам перезапускается, история хранится в томе):

```bash
docker build -f Dockerfile.bot -t deepseek-bot .
docker run -d --restart unless-stopped --name deepseek-bot \
  -e TELEGRAM_BOT_TOKEN=... -e DEEPSEEK_API_KEY=... -e ALLOWED_USER_IDS=... \
  -v deepseek-bot-data:/data deepseek-bot
```

Боту нужна машина, которая работает постоянно (VPS, домашний сервер, любой
хостинг контейнеров) и с которой открываются `api.telegram.org` и
`api.deepseek.com`.

### Команды в чате

| Команда | Что делает |
|---|---|
| `/new` | начать новый диалог, забыть контекст |
| `/model reasoner` / `/model chat` | переключить модель (рассуждающая / быстрая) |
| `/think on` / `/think off` | показывать ли ход рассуждений перед ответом |
| `/id` | показать ваш Telegram ID |
| `/help` | справка |

### Настройки (переменные окружения)

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | — | токен от @BotFather (обязательно) |
| `DEEPSEEK_API_KEY` | — | ключ DeepSeek (обязательно) |
| `ALLOWED_USER_IDS` | пусто | ID через запятую, кому бот отвечает; `*` — всем |
| `DEEPSEEK_MODEL` | `deepseek-reasoner` | модель по умолчанию |
| `SYSTEM_PROMPT` | пусто | постоянная инструкция для модели |
| `HISTORY_LIMIT` | `30` | сколько последних сообщений помнить |
| `TELEGRAM_PROXY` | пусто | прокси для Telegram (`socks5://…`, `http://…`) |
| `STATE_FILE` | `bot_state.json` | файл с историей диалогов |

Пока `ALLOWED_USER_IDS` пуст, бот никому не отвечает по существу — так чужие
люди не смогут тратить ваш баланс DeepSeek.
