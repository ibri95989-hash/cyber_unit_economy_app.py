"""Частотность запросов: Яндекс, Wildberries, Ozon и Google в одном окне.

Запуск:  streamlit run search_frequency_app.py
"""
from __future__ import annotations

import io
from typing import Optional
from urllib.parse import quote_plus

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from frequency.aggregator import Credentials, collect
from frequency.http import check_connection, configure as configure_network
from frequency.models import SourceResult, Status

st.set_page_config(
    page_title="IBRX — частотность запросов",
    page_icon="🔎",
    layout="wide",
)

ACCENT = {
    "Яндекс": "#ff453a",
    "Wildberries": "#e045c0",
    "Ozon": "#0a84ff",
    "Google": "#30d158",
}

# Куда пойти, чтобы перепроверить цифру руками на самой площадке.
SOURCE_LINKS = {
    "Яндекс": "https://wordstat.yandex.ru/?region=225&words={q}",
    "Wildberries": "https://www.wildberries.ru/catalog/0/search.aspx?search={q}",
    "Ozon": "https://www.ozon.ru/search/?text={q}",
    "Google": "https://trends.google.com/trends/explore?geo=RU&q={q}",
}

# Цвета статусов из системной палитры iOS: читаются на чёрном фоне.
STATUS_STYLE = {
    Status.EXACT: ("#30d158", "точные данные"),
    Status.ESTIMATE: ("#ff9f0a", "оценка"),
    Status.NO_KEY: ("#8e8e93", "нужен ключ"),
    Status.ERROR: ("#ff453a", "нет ответа"),
}

st.markdown(
    """
    <style>
      /* Системный шрифт Apple там, где он есть; на остальных — ближайший гротеск. */
      html, body, [class*="css"], .stApp {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display",
          "SF Pro Text", "Helvetica Neue", "Inter", "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .stApp {
        background:
          radial-gradient(1100px 620px at 50% -8%, rgba(10,132,255,.20), transparent 62%),
          radial-gradient(760px 460px at 88% 4%, rgba(191,90,242,.13), transparent 60%),
          #000;
      }
      .block-container {padding-top: 3.4rem; padding-bottom: 4rem; max-width: 1140px;}

      /* Шапка: разрядка марки, крупный заголовок с мягким градиентом. */
      .hero {text-align: center; margin-bottom: 2.6rem;}
      .hero .brand {
        font-size: .7rem; font-weight: 600; letter-spacing: .38em;
        color: #6e6e73; text-transform: uppercase; margin-bottom: 1rem;
      }
      .hero h1 {
        font-size: clamp(2.6rem, 5.4vw, 4.1rem); font-weight: 700;
        letter-spacing: -.035em; line-height: 1.04; margin: 0 0 .85rem;
        background: linear-gradient(180deg, #fff 28%, #a9a9b2 100%);
        -webkit-background-clip: text; background-clip: text; color: transparent;
      }
      .hero p {
        color: #86868b; font-size: 1.09rem; line-height: 1.5;
        max-width: 620px; margin: 0 auto;
      }

      /* Карточка источника: стекло на тёмном фоне, тонкая рамка, подъём при наведении. */
      .card {
        position: relative; height: 100%;
        border: 1px solid rgba(255,255,255,.10); border-radius: 22px;
        padding: 22px 22px 20px;
        background: linear-gradient(180deg, rgba(255,255,255,.075), rgba(255,255,255,.028));
        backdrop-filter: blur(22px) saturate(150%);
        -webkit-backdrop-filter: blur(22px) saturate(150%);
        box-shadow: 0 1px 0 rgba(255,255,255,.07) inset, 0 18px 42px rgba(0,0,0,.5);
        transition: transform .28s cubic-bezier(.2,.7,.3,1), border-color .28s ease;
      }
      .card:hover {transform: translateY(-3px); border-color: rgba(255,255,255,.20);}
      .card .src {
        display:flex; align-items:center; gap:.55rem;
        font-size: .82rem; font-weight: 600; letter-spacing: .01em; color: #d2d2d7;
      }
      .card .dot {
        width: 9px; height: 9px; border-radius: 50%; display:inline-block; flex: none;
      }
      .card .value {
        font-size: 2.6rem; font-weight: 700; letter-spacing: -.045em;
        line-height: 1.05; margin: .75rem 0 .1rem; color: #fff;
        font-variant-numeric: tabular-nums;
      }
      .card .unit {font-size: .8rem; color: #6e6e73; margin-bottom: .85rem;}
      .badge {
        display:inline-block; font-size: .68rem; font-weight: 600; letter-spacing: .02em;
        padding: 3px 10px; border-radius: 999px;
        border: 1px solid currentColor; background: transparent;
      }
      .card .note {
        font-size: .78rem; color: #86868b; margin-top: .8rem; line-height: 1.45;
      }
      .card .check {
        display:inline-block; margin-top: .9rem; font-size: .78rem; font-weight: 500;
        text-decoration: none; color: #0a84ff;
      }
      .card .check:hover {text-decoration: underline;}

      /* Верхняя панель Streamlit не должна разрезать фон белой полосой. */
      [data-testid="stHeader"] {background: transparent !important;}
      [data-testid="stToolbar"] {right: .6rem;}

      /* Поля ввода: контейнер, а не сам textarea — фон рисует именно он. */
      .stTextArea > div > div, .stTextInput > div > div,
      div[data-baseweb="textarea"], div[data-baseweb="input"], div[data-baseweb="base-input"] {
        background: rgba(255,255,255,.06) !important;
        border: 1px solid rgba(255,255,255,.12) !important;
        border-radius: 16px !important;
      }
      .stTextArea > div > div:focus-within, .stTextInput > div > div:focus-within,
      div[data-baseweb="textarea"]:focus-within, div[data-baseweb="input"]:focus-within {
        border-color: rgba(10,132,255,.85) !important;
        box-shadow: 0 0 0 4px rgba(10,132,255,.16) !important;
      }
      .stTextArea textarea, .stTextInput input,
      div[data-baseweb="textarea"] textarea, div[data-baseweb="input"] input {
        background: transparent !important; color: #f5f5f7 !important;
        font-size: 1.02rem !important; padding: .8rem 1rem !important;
      }
      .stTextArea textarea::placeholder, .stTextInput input::placeholder {color: #6e6e73 !important;}
      div[data-baseweb="select"] > div {
        background: rgba(255,255,255,.06) !important;
        border: 1px solid rgba(255,255,255,.12) !important;
        border-radius: 14px !important; color: #f5f5f7 !important;
      }
      .stButton button {
        border-radius: 980px !important; border: none !important;
        font-weight: 600 !important; letter-spacing: .01em;
        padding: .72rem 1.5rem !important;
        transition: transform .2s ease, filter .2s ease;
      }
      .stButton button:hover {transform: scale(1.02); filter: brightness(1.08);}
      .stButton button[kind="primary"] {
        background: linear-gradient(180deg, #0a84ff, #0060df) !important; color: #fff !important;
        box-shadow: 0 8px 24px rgba(10,132,255,.32) !important;
      }
      .stButton button[kind="secondary"] {
        background: rgba(255,255,255,.08) !important; color: #f5f5f7 !important;
        border: 1px solid rgba(255,255,255,.14) !important;
      }

      /* Заголовок запроса, разделители и сервисные блоки. */
      h3 {
        font-size: 1.55rem !important; font-weight: 650 !important; color: #f5f5f7 !important;
        letter-spacing: -.02em !important; margin: 2.4rem 0 1.1rem !important;
      }
      hr, [data-testid="stDivider"] {border-color: rgba(255,255,255,.08) !important;}
      [data-testid="stExpander"] {
        border: 1px solid rgba(255,255,255,.10) !important; border-radius: 18px !important;
        background: rgba(255,255,255,.03) !important;
      }
      [data-testid="stSidebar"] {
        background: #0a0a0b; border-right: 1px solid rgba(255,255,255,.08);
      }
      [data-testid="stSidebar"] h2 {font-size: 1.2rem; letter-spacing: -.01em;}
    </style>
    """,
    unsafe_allow_html=True,
)


def fmt(value: Optional[int]) -> str:
    if value is None:
        return "—"
    return f"{value:,}".replace(",", " ")


def card(res: SourceResult) -> str:
    color, _ = STATUS_STYLE[res.status]
    note = res.detail if len(res.detail) <= 220 else res.detail[:217] + "…"
    link = SOURCE_LINKS.get(res.source, "").format(q=quote_plus(res.query))
    accent = ACCENT.get(res.source, "#666")
    return f"""
    <div class="card">
      <div class="src"><span class="dot" style="background:{accent}"></span>{res.source}</div>
      <div class="value">{fmt(res.monthly)}</div>
      <div class="unit">показов в месяц</div>
      <span class="badge" style="color:{color}">{res.label}</span>
      <div class="note">{note}</div>
      <a class="check" href="{link}" target="_blank" rel="noopener">Проверить на площадке →</a>
    </div>
    """


def chart(results: list[SourceResult], query: str) -> Optional[go.Figure]:
    points = [r for r in results if r.is_number]
    if not points:
        return None
    fig = go.Figure(
        go.Bar(
            x=[r.monthly for r in points],
            y=[r.source for r in points],
            orientation="h",
            marker_color=[ACCENT.get(r.source, "#666") for r in points],
            text=[fmt(r.monthly) for r in points],
            textposition="outside",
            hovertemplate="%{y}: %{x:,} показов/мес<extra></extra>",
        )
    )
    # cliponaxis=False + запас по оси: подпись длинного столбца не обрезается.
    fig.update_traces(
        marker_line_width=0, textfont_color="#f5f5f7", width=0.52, cliponaxis=False
    )
    top = max(r.monthly for r in points)
    fig.update_layout(
        title=dict(text=f"«{query}» — показов в месяц", font=dict(size=15, color="#86868b")),
        height=100 + 62 * len(points),
        margin=dict(l=10, r=30, t=54, b=16),
        font=dict(
            family='-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
            color="#d2d2d7",
            size=13,
        ),
        xaxis=dict(
            showgrid=True, gridcolor="rgba(255,255,255,.07)", zeroline=False,
            showline=False, showticklabels=False, range=[0, top * 1.18],
        ),
        yaxis=dict(autorange="reversed", showgrid=False),
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
        bargap=0.42,
        showlegend=False,
    )
    return fig


def secret(name: str, default: str = "") -> str:
    """Значение из Streamlit secrets — удобно на Streamlit Cloud.

    На Cloud ключи и прокси задаются один раз в Settings → Secrets, и поля
    ниже подставляются автоматически. Локально файла с секретами может не
    быть — тогда просто пустая строка.
    """
    try:
        return str(st.secrets.get(name, default))
    except Exception:  # noqa: BLE001 - без secrets.toml обращение бросает исключение
        return default


with st.sidebar:
    st.header("Настройки")
    st.caption(
        "Сайт считает частотность без каких-либо ключей. Поля ниже — "
        "необязательные: если у вас есть доступ к API площадки, оценка в её "
        "карточке заменится точными цифрами."
    )
    with st.expander("Яндекс.Вордстат (необязательно)"):
        yandex_oauth = st.text_input(
            "OAuth-токен Wordstat API", value=secret("yandex_oauth"), type="password"
        )
        st.caption("Получить: yandex.ru/dev/wordstat — приложение в Яндекс ID.")
        xmlriver_user = st.text_input("XMLRiver user id", value=secret("xmlriver_user"))
        xmlriver_key = st.text_input(
            "XMLRiver key", value=secret("xmlriver_key"), type="password"
        )
    with st.expander("Wildberries (необязательно)"):
        wb_token = st.text_input(
            "Токен продавца (категория «Аналитика»)",
            value=secret("wb_token"),
            type="password",
        )
    with st.expander("Ozon (необязательно)"):
        ozon_client_id = st.text_input(
            "Performance API Client Id", value=secret("ozon_client_id")
        )
        ozon_client_secret = st.text_input(
            "Performance API Client Secret",
            value=secret("ozon_client_secret"),
            type="password",
        )

    st.divider()
    st.subheader("Сеть")
    st.caption(
        "Если площадки не открываются напрямую — укажите прокси. "
        "Поддерживаются http://, https:// и socks5:// (в том числе с логином "
        "и паролем: http://user:pass@host:port)."
    )
    proxy = st.text_input(
        "Адрес прокси",
        value=secret("proxy"),
        placeholder="socks5://127.0.0.1:1080",
    )
    trust_env = st.checkbox(
        "Использовать системный прокси",
        value=True,
        help="Берёт HTTPS_PROXY / HTTP_PROXY из окружения, если поле выше пустое.",
    )
    configure_network(proxy or None, trust_env)
    if st.button("Проверить соединение", use_container_width=True):
        ok, message = check_connection()
        (st.success if ok else st.error)(message)

    st.divider()
    region = st.selectbox(
        "Регион Вордстата",
        options=[("Россия", [225]), ("Москва и область", [1]), ("Весь мир", [])],
        format_func=lambda x: x[0],
    )

creds = Credentials(
    wb_token=wb_token or None,
    ozon_client_id=ozon_client_id or None,
    ozon_client_secret=ozon_client_secret or None,
    yandex_oauth=yandex_oauth or None,
    xmlriver_user=xmlriver_user or None,
    xmlriver_key=xmlriver_key or None,
    regions=region[1],
)

st.markdown(
    """
    <div class="hero">
      <div class="brand">IBRX</div>
      <h1>Частотность запроса за месяц</h1>
      <p>Один запрос — сразу Яндекс, Wildberries, Ozon и Google. Без регистрации,
         ключей и токенов. Например: «ароматизатор в машину», «магнитный держатель
         для телефона».</p>
    </div>
    """,
    unsafe_allow_html=True,
)

col_input, col_button = st.columns([5, 1])
with col_input:
    raw = st.text_area(
        "Запросы",
        placeholder="ароматизатор в машину\nмагнитный держатель для телефона",
        height=96,
        label_visibility="collapsed",
    )
with col_button:
    st.write("")
    go_clicked = st.button("Проверить", type="primary", use_container_width=True)

queries = [line.strip() for line in (raw or "").splitlines() if line.strip()][:20]

if go_clicked and not queries:
    st.warning("Введите хотя бы один запрос.")

if go_clicked and queries:
    rows: list[dict] = []
    configure_network(proxy or None, trust_env)
    for query in queries:
        with st.spinner(f"Считаю частотность: «{query}»"):
            results = collect(query, creds)

        st.markdown(f"### {query}")
        for column, res in zip(st.columns(len(results)), results):
            column.markdown(card(res), unsafe_allow_html=True)

        figure = chart(results, query)
        if figure is not None:
            st.plotly_chart(figure, use_container_width=True)

        if not any(r.is_number for r in results):
            st.error(
                "Ни один источник не ответил — почти всегда это закрытый выход "
                "в интернет. Укажите прокси в разделе «Сеть» слева и нажмите "
                "«Проверить соединение»; подробности по каждому источнику — "
                "в карточках выше."
            )

        total = sum(r.monthly for r in results if r.is_number)
        if total:
            st.caption(f"Суммарно по доступным источникам: **{fmt(total)}** показов в месяц.")

        related_sources = [r for r in results if r.related]
        if related_sources:
            with st.expander("Похожие запросы, которые вводят люди"):
                for res in related_sources:
                    phrases = ", ".join(
                        f"{p} ({fmt(c)})" if c else p for p, c in res.related[:10]
                    )
                    st.markdown(f"**{res.source}** — {phrases}")

        row = {"Запрос": query}
        for res in results:
            row[res.source] = res.monthly
            row[f"{res.source}: статус"] = res.label
        rows.append(row)
        st.divider()

    table = pd.DataFrame(rows)
    st.markdown("### Сводная таблица")
    st.dataframe(table, use_container_width=True, hide_index=True)

    buffer = io.StringIO()
    table.to_csv(buffer, index=False)
    st.download_button(
        "Скачать CSV",
        buffer.getvalue().encode("utf-8-sig"),
        file_name="chastotnost.csv",
        mime="text/csv",
    )

with st.expander("Откуда берутся цифры"):
    st.markdown(
        """
**Без ключей (режим по умолчанию).** Основа — Google Trends: он открыт для всех и
показывает относительный интерес к запросу. Абсолютные показы получаются
калибровкой: запрос сравнивается с опорным словом, месячная частотность
которого известна заранее (список опор — в `frequency/trends.py`).

- **Яндекс** — калиброванный замер Trends по России.
- **Wildberries** и **Ozon** — среднее геометрическое двух независимых сигналов:
  сколько товаров площадка показывает под запрос (её публичный поиск) и какая
  доля веб-спроса доходит до маркетплейса.
- **Google** — доля Google в поиске РФ от того же замера.

Если Trends временно ограничил частоту обращений, спрос восстанавливается
обратным ходом по выдаче WB и Ozon — цифры остаются на месте.

**С ключами (по желанию).** Токен продавца WB даёт отчёт «Поисковые запросы»,
Performance API Ozon — показы по фразе, Wordstat API или XMLRiver — точные
показы Яндекса. Такие карточки помечаются зелёным бейджем «точные данные API».

Оценки помечены жёлтым бейджем: они годятся для сравнения запросов между собой
и оценки порядка величины. Коэффициенты модели лежат в `frequency/estimate.py`
— их можно откалибровать под свою нишу.
        """
    )
