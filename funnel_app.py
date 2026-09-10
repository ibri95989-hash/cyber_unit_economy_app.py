"""Воронка продаж Wildberries: где теряются покупатели и сколько это стоит.

Запуск:  streamlit run funnel_app.py

Данные берутся тремя способами: из API продавца по токену «Аналитика», из
выгрузки «Воронка продаж» (Excel/CSV) или из демо-набора, чтобы посмотреть
разбор без доступа к кабинету.
"""
from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from frequency.http import SourceError, check_connection, configure as configure_network
from funnel import schema, wb_api
from funnel.metrics import (
    TRANSITION_ORDER,
    active_transitions,
    analyze,
    funnel_steps,
    has_impressions,
    totals,
)
from funnel.schema import STAGE_LABELS, TRANSITIONS

st.set_page_config(page_title="IBRX — воронка продаж WB", page_icon="🫙", layout="wide")

STAGE_COLORS = ["#5e5ce6", "#0a84ff", "#30d158", "#ff9f0a", "#e045c0"]

# Что чинить, когда узкое место найдено. Формулировки короткие: это подсказка
# к действию, а не учебник.
ADVICE = {
    "ctr": (
        "Показы есть, а в карточку не заходят — работает обложка и первый экран: "
        "главное фото, инфографика на нём, заголовок и цена в выдаче. "
        "Проверьте, по каким запросам идут показы: нерелевантный трафик даёт тот же эффект."
    ),
    "cr_cart": (
        "В карточку заходят, а в корзину не кладут — вопрос к самой карточке: "
        "фото и видео, описание и характеристики, рейтинг и отзывы, цена относительно "
        "соседей в выдаче, наличие размеров и остатков."
    ),
    "cr_order": (
        "Корзина есть, а заказа нет — обычно цена и условия доставки: "
        "покупатель сравнивает с другими карточками и ждёт скидку. "
        "Смотрите срок доставки со склада и остатки в регионах спроса."
    ),
    "cr_buyout": (
        "Заказывают, но не выкупают — товар не совпал с ожиданием: "
        "размерная сетка, реальный цвет и материал, качество упаковки, "
        "расхождение фото и описания с тем, что приехало."
    ),
}

st.markdown(
    """
    <style>
      html, body, [class*="css"], .stApp {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display",
          "SF Pro Text", "Helvetica Neue", "Inter", "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .stApp {
        background:
          radial-gradient(1100px 620px at 50% -8%, rgba(94,92,230,.20), transparent 62%),
          radial-gradient(760px 460px at 88% 4%, rgba(224,69,192,.12), transparent 60%),
          #000;
      }
      .block-container {padding-top: 3.2rem; padding-bottom: 4rem; max-width: 1240px;}
      [data-testid="stHeader"] {background: transparent !important;}

      .hero {text-align: center; margin-bottom: 2.2rem;}
      .hero .brand {
        font-size: .7rem; font-weight: 600; letter-spacing: .38em;
        color: #6e6e73; text-transform: uppercase; margin-bottom: 1rem;
      }
      .hero h1 {
        font-size: clamp(2.4rem, 5vw, 3.8rem); font-weight: 700;
        letter-spacing: -.035em; line-height: 1.05; margin: 0 0 .8rem;
        background: linear-gradient(180deg, #fff 28%, #a9a9b2 100%);
        -webkit-background-clip: text; background-clip: text; color: transparent;
      }
      .hero p {color: #86868b; font-size: 1.05rem; line-height: 1.5; max-width: 660px; margin: 0 auto;}

      .card {
        border: 1px solid rgba(255,255,255,.10); border-radius: 20px;
        padding: 18px 20px; height: 100%;
        background: linear-gradient(180deg, rgba(255,255,255,.075), rgba(255,255,255,.028));
        box-shadow: 0 1px 0 rgba(255,255,255,.07) inset, 0 18px 42px rgba(0,0,0,.5);
      }
      .card .label {font-size: .78rem; font-weight: 600; color: #86868b; letter-spacing: .01em;}
      .card .value {
        font-size: 2.1rem; font-weight: 700; letter-spacing: -.04em; color: #fff;
        margin: .5rem 0 .1rem; font-variant-numeric: tabular-nums;
      }
      .card .note {font-size: .76rem; color: #6e6e73; line-height: 1.4;}

      .fix {
        border: 1px solid rgba(255,255,255,.10); border-radius: 18px;
        padding: 16px 18px; margin-bottom: .8rem;
        background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      }
      .fix .top {display:flex; justify-content:space-between; gap:1rem; align-items:baseline;}
      .fix .sku {font-size: .95rem; font-weight: 600; color: #f5f5f7;}
      .fix .money {font-size: .95rem; font-weight: 700; color: #30d158; white-space: nowrap;}
      .fix .stage {
        display:inline-block; margin-top:.5rem; font-size:.7rem; font-weight:600;
        padding: 3px 10px; border-radius: 999px; color:#ff9f0a; border:1px solid currentColor;
      }
      .fix .text {font-size: .82rem; color: #a1a1a6; line-height: 1.5; margin-top:.6rem;}
    </style>
    """,
    unsafe_allow_html=True,
)


def rub(value: float) -> str:
    return f"{value:,.0f} ₽".replace(",", " ")


def num(value: float) -> str:
    return f"{value:,.0f}".replace(",", " ")


def pct(value: float, digits: int = 1) -> str:
    if value is None or pd.isna(value):
        return "—"
    return f"{value * 100:.{digits}f} %"


def metric_card(column, label: str, value: str, note: str = "") -> None:
    column.markdown(
        f'<div class="card"><div class="label">{label}</div>'
        f'<div class="value">{value}</div><div class="note">{note}</div></div>',
        unsafe_allow_html=True,
    )


def secret(name: str, default: str = "") -> str:
    try:
        return str(st.secrets.get(name, default))
    except Exception:  # noqa: BLE001 - без secrets.toml обращение бросает исключение
        return default


# -----------------------------------------------------------------------------
# Боковая панель: доступ, период, сеть, эталон

with st.sidebar:
    st.header("Данные")
    token = st.text_input(
        "Токен продавца WB (категория «Аналитика»)",
        value=secret("wb_token"),
        type="password",
        help="ЛК продавца → Настройки → Доступ к API → создать токен с категорией «Аналитика».",
    )

    today = date.today()
    period = st.date_input(
        "Период",
        value=(today - timedelta(days=30), today - timedelta(days=1)),
        max_value=today,
        format="DD.MM.YYYY",
    )
    max_pages = st.slider(
        "Максимум страниц (по 1000 карточек)", 1, wb_api.MAX_PAGES, 3,
        help="У метода лимит 3 запроса в минуту, поэтому между страницами приложение ждёт ~20 секунд.",
    )
    load_api = st.button("Выгрузить из API", type="primary", use_container_width=True)
    check_api = st.button("Проверить токен", use_container_width=True)

    st.divider()
    st.subheader("Сеть")
    proxy = st.text_input("Прокси", value=secret("proxy"), placeholder="socks5://127.0.0.1:1080")
    trust_env = st.checkbox("Использовать системный прокси", value=True)
    configure_network(proxy or None, trust_env)
    if st.button("Проверить соединение", use_container_width=True):
        ok, message = check_connection("https://common-api.wildberries.ru/ping")
        (st.success if ok else st.error)(message)

    st.divider()
    st.subheader("Эталон конверсий")
    st.caption(
        "По умолчанию эталон — ваш же портфель: суммарная конверсия по всем "
        "выбранным товарам. Если знаете нормы своей ниши — впишите их, и «узкие "
        "места» пересчитаются относительно них."
    )
    overrides: dict = {}
    for key in TRANSITION_ORDER:
        value = st.number_input(
            TRANSITIONS[key][2] + ", %",
            min_value=0.0,
            max_value=100.0,
            value=0.0,
            step=0.5,
            key=f"bench_{key}",
            help="0 — считать по портфелю.",
        )
        if value > 0:
            overrides[key] = value / 100

st.markdown(
    """
    <div class="hero">
      <div class="brand">IBRX</div>
      <h1>Воронка продаж Wildberries</h1>
      <p>Показы → карточка → корзина → заказ → выкуп. Приложение считает конверсию
         каждого перехода, находит этап, на котором товар теряет больше всего, и
         переводит потерю в рубли.</p>
    </div>
    """,
    unsafe_allow_html=True,
)

# -----------------------------------------------------------------------------
# Загрузка данных

if "funnel_df" not in st.session_state:
    st.session_state["funnel_df"] = None
    st.session_state["funnel_source"] = ""

if check_api:
    if not token:
        st.sidebar.error("Сначала впишите токен.")
    else:
        ok, message = wb_api.check_token(token)
        (st.sidebar.success if ok else st.sidebar.error)(message)

if load_api:
    if not token:
        st.error("Нужен токен продавца с категорией «Аналитика» — впишите его в боковой панели.")
    else:
        begin, end = (period if isinstance(period, (tuple, list)) and len(period) == 2
                      else (today - timedelta(days=30), today))
        status = st.status("Запрашиваю отчёт у Wildberries…", expanded=True)
        try:
            def _progress(page: int, rows: int) -> None:
                status.write(f"Страница {page}: получено карточек — {rows}")

            df_api = wb_api.fetch_funnel(token, begin, end, max_pages=max_pages, progress=_progress)
        except SourceError as exc:
            status.update(label="Не получилось", state="error")
            st.error(str(exc))
        else:
            status.update(label=f"Готово: {len(df_api)} карточек", state="complete")
            st.session_state["funnel_df"] = df_api
            st.session_state["funnel_source"] = (
                f"API продавца, {begin:%d.%m.%Y} — {end:%d.%m.%Y}"
            )

upload_col, demo_col = st.columns([3, 1])
with upload_col:
    uploaded = st.file_uploader(
        "Или загрузите выгрузку «Воронка продаж» из ЛК (Аналитика → Товары → Воронка продаж)",
        type=["csv", "xlsx", "xls"],
    )
with demo_col:
    st.markdown('<div style="height:1.9rem"></div>', unsafe_allow_html=True)
    if st.button("Показать на демо-данных", use_container_width=True):
        st.session_state["funnel_df"] = wb_api.demo_frame()
        st.session_state["funnel_source"] = "демо-набор (синтетические цифры)"

if uploaded is not None:
    try:
        raw = schema.read_table(uploaded)
    except Exception as exc:  # noqa: BLE001 - показываем причину пользователю
        st.error(f"Не удалось прочитать файл: {exc}")
        st.stop()

    st.success(f"Прочитано строк: {num(len(raw))}")
    mapping = schema.guess_mapping(raw.columns)
    with st.expander("Сопоставление колонок", expanded=any(
        f not in mapping for f in ("open_card", "add_to_cart", "orders", "buyouts")
    )):
        st.caption("Приложение угадало колонки по названиям — проверьте и поправьте.")
        options = ["— нет —"] + list(raw.columns)
        fields = [
            ("nm_id", "Артикул WB"), ("vendor_code", "Артикул продавца"), ("name", "Наименование"),
            ("impressions", "Показы (если есть)"), ("open_card", "Переходы в карточку *"),
            ("add_to_cart", "Положили в корзину *"), ("orders", "Заказали, шт *"),
            ("orders_rub", "Заказали на сумму"), ("buyouts", "Выкупили, шт *"),
            ("buyouts_rub", "Выкупили на сумму"), ("cancels", "Отмены"), ("stocks", "Остатки"),
        ]
        picked = {}
        grid = st.columns(3)
        for i, (field, label) in enumerate(fields):
            guess = mapping.get(field, "— нет —")
            index = options.index(guess) if guess in options else 0
            choice = grid[i % 3].selectbox(label, options, index=index, key=f"map_{field}")
            if choice != "— нет —":
                picked[field] = choice

    required = [f for f in ("open_card", "add_to_cart", "orders", "buyouts") if f not in picked]
    if required:
        st.warning(
            "Не хватает обязательных колонок: "
            + ", ".join(dict(fields)[f].rstrip(" *") for f in required)
        )
        st.stop()

    st.session_state["funnel_df"] = schema.normalize(raw, picked)
    st.session_state["funnel_source"] = f"файл «{uploaded.name}»"

df = st.session_state["funnel_df"]
if df is None or df.empty:
    st.info(
        "Данных пока нет. Выгрузите их из API по токену, загрузите файл отчёта "
        "или нажмите «Показать на демо-данных», чтобы увидеть, как выглядит разбор."
    )
    st.stop()

st.caption(f"Источник: {st.session_state['funnel_source']} · товаров: {num(len(df))}")

# -----------------------------------------------------------------------------
# Разбор

result, bench = analyze(df, overrides)
agg = totals(result)
transitions = active_transitions(result)
entry_stage = "impressions" if has_impressions(result) else "open_card"
entry_volume = agg.get(entry_stage, 0.0)

buyouts = agg.get("buyouts", 0.0)
buyouts_rub = agg.get("buyouts_rub", 0.0)
e2e = (buyouts / entry_volume) if entry_volume else np.nan
avg_check = (buyouts_rub / buyouts) if buyouts else np.nan
potential = float(result["lost_rub"].sum())

st.markdown("### Итоги периода")
k1, k2, k3, k4, k5 = st.columns(5)
metric_card(k1, STAGE_LABELS[entry_stage], num(entry_volume), "вход в воронку")
metric_card(k2, "Заказали, шт", num(agg.get("orders", 0.0)), rub(agg.get("orders_rub", 0.0)))
metric_card(k3, "Выкупили, шт", num(buyouts), rub(buyouts_rub))
metric_card(k4, "Сквозная конверсия", pct(e2e, 2), f"из «{STAGE_LABELS[entry_stage].lower()}» в выкуп")
metric_card(k5, "Средний чек выкупа", rub(avg_check) if not pd.isna(avg_check) else "—", "выручка / выкупы")

st.markdown(
    f'<p style="color:#86868b;font-size:.86rem;margin-top:1rem">'
    f"Если каждый товар подтянуть на его самом слабом переходе до эталона, "
    f"дополнительная выручка периода — <b style='color:#30d158'>{rub(potential)}</b>. "
    f"Это верхняя оценка при неизменном трафике и цене.</p>",
    unsafe_allow_html=True,
)

# -----------------------------------------------------------------------------
# Воронка и конверсии

st.markdown("### Воронка")
steps = funnel_steps(result)
left, right = st.columns([3, 2])

with left:
    fig = go.Figure(
        go.Funnel(
            y=[STAGE_LABELS[s] for s in steps["stage"]],
            x=steps["value"],
            textposition="inside",
            textinfo="value+percent previous",
            marker={"color": STAGE_COLORS[-len(steps):]},
            connector={"line": {"color": "rgba(255,255,255,.18)", "width": 1}},
        )
    )
    fig.update_layout(
        height=380,
        margin=dict(l=10, r=10, t=10, b=10),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#f5f5f7", size=13),
    )
    st.plotly_chart(fig, width="stretch")

with right:
    bench_rows = []
    for key in transitions:
        src, dst, label = TRANSITIONS[key]
        base, top = agg.get(src, 0.0), agg.get(dst, 0.0)
        bench_rows.append(
            {
                "Переход": label,
                "Факт": (top / base * 100) if base else np.nan,
                "Эталон": bench.get(key, np.nan) * 100,
                "Теряем, шт": max(base - top, 0.0),
            }
        )
    st.dataframe(
        pd.DataFrame(bench_rows),
        width="stretch",
        hide_index=True,
        column_config={
            "Факт": st.column_config.NumberColumn("Факт, %", format="%.2f"),
            "Эталон": st.column_config.NumberColumn("Эталон, %", format="%.2f"),
            "Теряем, шт": st.column_config.NumberColumn("Отвалилось, шт", format="%.0f"),
        },
    )
    st.caption(
        "«Отвалилось» — сколько покупателей не дошло до следующего этапа. "
        "Эталон совпадает с фактом, пока он считается по вашему же портфелю: "
        "его смысл — сравнивать товары между собой."
    )

# -----------------------------------------------------------------------------
# Куда смотреть в первую очередь

st.markdown("### Что чинить в первую очередь")
priority = result[result["lost_rub"] > 0].sort_values("lost_rub", ascending=False).head(5)

if priority.empty:
    st.info("Ни один товар не отстаёт от эталона — узких мест по этим данным нет.")
else:
    for _, row in priority.iterrows():
        stage_key = next(
            (k for k in TRANSITION_ORDER if TRANSITIONS[k][2] == row["bottleneck"]), None
        )
        title = row.get("name") or row.get("vendor_code") or row["item_key"]
        st.markdown(
            f'<div class="fix"><div class="top">'
            f'<span class="sku">{title} · {row["item_key"]}</span>'
            f'<span class="money">+{rub(row["lost_rub"])}</span></div>'
            f'<span class="stage">{row["bottleneck"]}: {pct(row.get(stage_key))} '
            f'против {pct(bench.get(stage_key))}</span>'
            f'<div class="text">{ADVICE.get(stage_key, "")} '
            f'Потенциал — примерно {num(row["lost_buyouts"])} доп. выкупов за период.</div></div>',
            unsafe_allow_html=True,
        )

# -----------------------------------------------------------------------------
# Таблица по товарам

st.markdown("### По товарам")

table_cols = ["item_key", "name"] + [s for s in schema.STAGES if s != "impressions" or has_impressions(result)]
table_cols += [k for k in transitions] + ["cr_e2e", "buyouts_rub", "bottleneck", "lost_buyouts", "lost_rub"]
table = result[[c for c in table_cols if c in result.columns]].sort_values("lost_rub", ascending=False)
for conversion in transitions + ["cr_e2e"]:
    if conversion in table.columns:
        table[conversion] = table[conversion] * 100

st.dataframe(
    table,
    width="stretch",
    hide_index=True,
    column_config={
        "item_key": st.column_config.TextColumn("Артикул"),
        "name": st.column_config.TextColumn("Товар"),
        "impressions": st.column_config.NumberColumn("Показы", format="%.0f"),
        "open_card": st.column_config.NumberColumn("Переходы", format="%.0f"),
        "add_to_cart": st.column_config.NumberColumn("Корзины", format="%.0f"),
        "orders": st.column_config.NumberColumn("Заказы", format="%.0f"),
        "buyouts": st.column_config.NumberColumn("Выкупы", format="%.0f"),
        "ctr": st.column_config.NumberColumn("CTR, %", format="%.2f"),
        "cr_cart": st.column_config.NumberColumn("→ корзина, %", format="%.2f"),
        "cr_order": st.column_config.NumberColumn("→ заказ, %", format="%.2f"),
        "cr_buyout": st.column_config.NumberColumn("→ выкуп, %", format="%.2f"),
        "cr_e2e": st.column_config.NumberColumn("Сквозная, %", format="%.2f"),
        "buyouts_rub": st.column_config.NumberColumn("Выручка, ₽", format="%.0f"),
        "bottleneck": st.column_config.TextColumn("Узкое место"),
        "lost_buyouts": st.column_config.NumberColumn("Недополучено, шт", format="%.1f"),
        "lost_rub": st.column_config.NumberColumn("Потенциал, ₽", format="%.0f"),
    },
)

st.download_button(
    "Скачать разбор (CSV)",
    table.to_csv(index=False).encode("utf-8-sig"),
    file_name="wb_funnel.csv",
    mime="text/csv",
)

# -----------------------------------------------------------------------------
# Трафик против конверсии

st.markdown("### Трафик и конверсия")
scatter_df = result[result["open_card"] > 0].copy()
if not scatter_df.empty:
    scatter_df["Узкое место"] = scatter_df["bottleneck"]
    fig_scatter = go.Figure()
    for stage_name, part in scatter_df.groupby("Узкое место"):
        fig_scatter.add_trace(
            go.Scatter(
                x=part["open_card"],
                y=part["cr_e2e"] * 100,
                mode="markers",
                name=str(stage_name),
                text=part["item_key"],
                marker=dict(
                    size=np.clip(np.sqrt(part["buyouts_rub"].clip(lower=0)) / 6, 7, 34),
                    opacity=.8,
                    line=dict(width=1, color="rgba(255,255,255,.35)"),
                ),
                hovertemplate="%{text}<br>Переходы: %{x:,.0f}<br>Сквозная: %{y:.2f} %<extra></extra>",
            )
        )
    fig_scatter.update_layout(
        height=440,
        margin=dict(l=10, r=10, t=10, b=10),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#f5f5f7", size=13),
        xaxis=dict(title="Переходы в карточку", type="log", gridcolor="rgba(255,255,255,.08)"),
        yaxis=dict(title="Сквозная конверсия, %", gridcolor="rgba(255,255,255,.08)"),
        legend=dict(orientation="h", y=-0.18),
    )
    st.plotly_chart(fig_scatter, width="stretch")
    st.caption(
        "Размер точки — выручка выкупов. Правый нижний угол — товары с трафиком "
        "и слабой конверсией: их починка даёт больше всего денег."
    )

with st.expander("Как это считается"):
    st.markdown(
        """
**Этапы.** Показы → переходы в карточку → корзины → заказы → выкупы. Показы
приходят только из отчётов по рекламе и поисковым запросам, поэтому при выгрузке
из «Воронки продаж» воронка начинается с переходов в карточку.

**Конверсии.** Каждый переход считается по своим двум этапам (корзины/переходы,
заказы/корзины, выкупы/заказы). Сквозная конверсия — выкупы, делённые на вход
воронки.

**Эталон.** По умолчанию это ваш же портфель: суммарная конверсия по всем
выбранным товарам (сумма делится на сумму, поэтому артикул с тремя переходами не
задирает планку). Средние по рынку у каждой ниши свои — если вы их знаете,
впишите в боковой панели, и весь разбор пересчитается относительно них.

**Узкое место и потенциал.** Для товара берётся цепочка его конверсий. Поочерёдно
один переход заменяется эталонным, остальные остаются как есть — разница в
выкупах и есть цена этого этапа. Узкое место — переход с наибольшей потерей,
потенциал в рублях — потерянные выкупы, умноженные на средний чек товара. Это
верхняя оценка: трафик и цена считаются неизменными.

**Данные.** API продавца (`/api/v2/nm-report/detail`, категория токена
«Аналитика») отдаёт те же цифры, что и отчёт «Воронка продаж» в кабинете.
У метода лимит 3 запроса в минуту — между страницами приложение ждёт ~20 секунд.
Токен нигде не сохраняется.
        """
    )
