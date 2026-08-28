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
    page_title="Частотность запросов — WB, Ozon, Яндекс, Google",
    page_icon="🔎",
    layout="wide",
)

ACCENT = {
    "Яндекс": "#ff3333",
    "Wildberries": "#cb11ab",
    "Ozon": "#005bff",
    "Google": "#34a853",
}

# Куда пойти, чтобы перепроверить цифру руками на самой площадке.
SOURCE_LINKS = {
    "Яндекс": "https://wordstat.yandex.ru/?region=225&words={q}",
    "Wildberries": "https://www.wildberries.ru/catalog/0/search.aspx?search={q}",
    "Ozon": "https://www.ozon.ru/search/?text={q}",
    "Google": "https://trends.google.com/trends/explore?geo=RU&q={q}",
}

STATUS_STYLE = {
    Status.EXACT: ("#0f9d58", "точные данные"),
    Status.ESTIMATE: ("#e8a33d", "оценка"),
    Status.NO_KEY: ("#8a8f98", "нужен ключ"),
    Status.ERROR: ("#d93025", "нет ответа"),
}

st.markdown(
    """
    <style>
      .block-container {padding-top: 2.2rem; max-width: 1180px;}
      .hero h1 {font-size: 2.5rem; margin-bottom: .2rem; letter-spacing: -.02em;}
      .hero p {color: #7c828c; font-size: 1.02rem; margin-top: 0;}
      .card {
        border: 1px solid rgba(140,140,150,.22); border-radius: 18px;
        padding: 18px 20px; height: 100%;
        background: linear-gradient(180deg, rgba(140,140,150,.06), rgba(140,140,150,0));
      }
      .card .src {font-weight: 650; font-size: .95rem; display:flex; align-items:center; gap:.5rem;}
      .card .dot {width:10px; height:10px; border-radius:50%; display:inline-block;}
      .card .value {font-size: 2.15rem; font-weight: 700; letter-spacing: -.03em; margin: .35rem 0 .1rem;}
      .card .unit {font-size: .85rem; color:#7c828c; margin-bottom:.6rem;}
      .badge {
        display:inline-block; font-size:.72rem; font-weight:600; padding:2px 9px;
        border-radius: 999px; color:#fff;
      }
      .card .note {font-size:.8rem; color:#7c828c; margin-top:.6rem; line-height:1.35;}
      .card .check {
        display:inline-block; margin-top:.7rem; font-size:.8rem; font-weight:600;
        text-decoration:none; color:#5b5bd6;
      }
      .card .check:hover {text-decoration: underline;}
      div[data-testid="stMetricValue"] {font-size: 1.8rem;}
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
      <span class="badge" style="background:{color}">{res.label}</span>
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
    fig.update_layout(
        title=f"«{query}» — показов в месяц",
        height=90 + 58 * len(points),
        margin=dict(l=10, r=40, t=50, b=10),
        xaxis=dict(showgrid=True, gridcolor="rgba(140,140,150,.18)", zeroline=False),
        yaxis=dict(autorange="reversed"),
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
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
