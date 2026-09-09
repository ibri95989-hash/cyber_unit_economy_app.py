"""Панель управления кабинетом Ozon — то же, что делает CLI, но кнопками.

Запуск на своём компьютере:

    pip install -r requirements-ozon.txt
    streamlit run ozon_app.py

Ключи вводятся один раз в форме слева и сохраняются в файл .env рядом с
приложением. Никуда, кроме api-seller.ozon.ru и api-performance.ozon.ru,
они не уходят.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import pandas as pd
import streamlit as st

from ozon.config import load_credentials, mask, save_env
from ozon.errors import OzonApiError, OzonWriteBlocked
from ozon.performance import PerformanceApi
from ozon.safety import WriteGuard
from ozon.seller import SellerApi
from ozon.workflows import SupplyPlan, create_supply, plan_supply

st.set_page_config(page_title="Ozon — поставки и реклама", page_icon=":package:", layout="wide")

CACHE_TTL = 300  # ответы Ozon живут 5 минут, чтобы не дёргать API на каждый клик


# --------------------------------------------------------------------- утилиты


def to_table(payload: Any) -> pd.DataFrame:
    """Достать из ответа Ozon первый список записей и показать его таблицей."""
    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        rows = []
        for value in payload.values():
            if isinstance(value, list) and value and isinstance(value[0], dict):
                rows = value
                break
        else:
            rows = [payload]
    else:
        return pd.DataFrame()
    try:
        return pd.json_normalize(rows)
    except Exception:  # noqa: BLE001 - структура бывает вложенной как угодно
        return pd.DataFrame(rows)


def show(payload: Any, empty: str = "Ozon вернул пустой ответ.") -> pd.DataFrame:
    table = to_table(payload)
    if table.empty:
        st.info(empty)
    else:
        st.dataframe(table, width="stretch", hide_index=True)
    with st.expander("Ответ Ozon целиком"):
        st.json(payload)
    return table


def fail(exc: Exception) -> None:
    st.error(str(exc))
    attempts = getattr(exc, "attempts", None)
    if attempts:
        # Ozon меняет форму запросов между версиями. Если не подошло ничего,
        # показываем все попытки: по ним сразу видно, чего именно он хочет.
        with st.expander("Что именно спрашивали у Ozon"):
            st.dataframe(
                pd.DataFrame(attempts, columns=["метод", "код", "ответ Ozon"]),
                width="stretch",
                hide_index=True,
            )


@st.cache_data(ttl=CACHE_TTL, show_spinner="Спрашиваю Ozon…")
def seller_call(name: str, **kwargs: Any) -> Any:
    return getattr(SellerApi(), name)(**kwargs)


@st.cache_data(ttl=CACHE_TTL, show_spinner="Спрашиваю Ozon…")
def perf_call(name: str, **kwargs: Any) -> Any:
    return getattr(PerformanceApi(), name)(**kwargs)


# ------------------------------------------------------------------ боковая панель

creds = load_credentials()

with st.sidebar:
    st.header("Ключи Ozon")
    st.caption("Вводятся один раз. Сохраняются в файл .env на этом компьютере.")

    if creds.has_seller:
        st.success(f"Seller API: {mask(creds.seller_client_id)}")
    else:
        st.warning("Seller API: ключей нет")
    if creds.has_performance:
        st.success(f"Performance API: {mask(creds.perf_client_id)}")
    else:
        st.warning("Performance API: ключей нет")

    with st.form("keys"):
        st.markdown("**Seller API** — ЛК продавца → Настройки → Seller API")
        client_id = st.text_input("Client-Id", type="password")
        api_key = st.text_input("Api-Key", type="password")
        st.markdown("**Performance API** — Реклама → API-ключи")
        perf_id = st.text_input("Client ID", type="password")
        perf_secret = st.text_input("Client Secret", type="password")
        if st.form_submit_button("Сохранить ключи", width="stretch"):
            path = save_env(
                {
                    "OZON_CLIENT_ID": client_id,
                    "OZON_API_KEY": api_key,
                    "OZON_PERF_CLIENT_ID": perf_id,
                    "OZON_PERF_CLIENT_SECRET": perf_secret,
                }
            )
            st.cache_data.clear()
            st.success(f"Записал в {path.name}. Пустые поля оставил как было.")
            st.rerun()

    st.divider()
    st.header("Изменения")
    allow = st.toggle(
        "Разрешить менять кабинет",
        value=os.environ.get("OZON_ALLOW_WRITES", "0") == "1",
        help="Пока выключено — приложение только смотрит и показывает предпросмотр.",
    )
    os.environ["OZON_ALLOW_WRITES"] = "1" if allow else "0"
    max_bid = st.number_input("Потолок ставки, ₽", min_value=1.0, value=500.0, step=10.0)
    max_step = st.number_input("Шаг ставки не больше, %", min_value=1.0, value=50.0, step=5.0)
    os.environ["OZON_MAX_BID"] = str(max_bid)
    os.environ["OZON_MAX_BID_CHANGE_PCT"] = str(max_step)
    if allow:
        st.warning("Кнопки «Отправить в Ozon» теперь работают по-настоящему.")

    st.divider()
    if st.button("Обновить данные", width="stretch"):
        st.cache_data.clear()
        st.rerun()


# ------------------------------------------------------------------------ шапка

st.title(":package: Кабинет Ozon")
st.caption(
    "Поставки, остатки, рекламные кампании и ставки — без выгрузок и таблиц вручную. "
    "Приложение работает на вашем компьютере: ключи остаются в файле .env рядом с ним."
)

if not creds.has_seller and not creds.has_performance:
    st.info(
        "Начните слева: вставьте ключи и нажмите «Сохранить». Нужны два комплекта — "
        "Seller API из личного кабинета продавца (поставки и остатки) и Performance API "
        "из рекламного кабинета (кампании и ставки). Можно ввести только один: "
        "тогда будет работать соответствующая часть."
    )
    st.stop()

supplies_tab, new_supply_tab, stocks_tab, ads_tab, bids_tab = st.tabs(
    ["Поставки", "Новая поставка", "Остатки", "Реклама", "Ставки"]
)


# ---------------------------------------------------------------------- поставки

with supplies_tab:
    if not creds.has_seller:
        st.info("Нужен ключ Seller API — введите его слева.")
    else:
        st.subheader("Заявки на поставку")
        # Больше сотни за запрос Ozon не отдаёт.
        limit = st.slider("Сколько показать", 10, 100, 50, step=10, key="supply_limit")
        try:
            payload = seller_call("supply_orders", limit=limit)
            table = show(payload, "Активных заявок на поставку нет.")
        except OzonApiError as exc:
            fail(exc)
            table = pd.DataFrame()

        st.divider()
        st.subheader("Подробности заявки")
        order_id = st.number_input(
            "Номер заявки", min_value=0, step=1, value=0, key="supply_id",
            help="Возьмите supply_order_id из таблицы выше.",
        )
        if order_id:
            col_a, col_b = st.columns(2)
            with col_a:
                st.markdown("**Состав и статус**")
                try:
                    show(seller_call("supply_order", order_ids=[int(order_id)]))
                except OzonApiError as exc:
                    fail(exc)
            with col_b:
                st.markdown("**Свободные интервалы приёмки**")
                try:
                    show(seller_call("timeslots", supply_order_id=int(order_id)),
                         "Свободных интервалов Ozon не предложил.")
                except OzonApiError as exc:
                    fail(exc)


# ------------------------------------------------------------------ новая поставка

with new_supply_tab:
    if not creds.has_seller:
        st.info("Нужен ключ Seller API — введите его слева.")
    elif not allow:
        st.info(
            "Черновик поставки — это уже изменение в кабинете (хоть и безобидное: "
            "ничего не едет и денег не стоит). Включите тумблер «Разрешить менять "
            "кабинет» слева, чтобы посчитать поставку."
        )
    else:
        st.subheader("Собрать поставку FBO")
        st.caption(
            "Шаг 1 — черновик: Ozon посчитает, на какие склады можно везти и когда. "
            "Шаг 2 — заявка: только после вашего подтверждения."
        )
        positions = st.text_area(
            "Что везём — по строке на позицию, «SKU количество»",
            placeholder="123456789 10\n987654321 5",
            height=120,
        )
        items: List[Dict[str, Any]] = []
        for line in positions.splitlines():
            parts = line.replace(":", " ").replace(",", " ").split()
            if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                items.append({"sku": int(parts[0]), "quantity": int(parts[1])})

        if positions.strip() and not items:
            st.warning("Не разобрал строки. Формат: номер SKU, пробел, количество.")

        if st.button("Посчитать черновик", width="stretch", disabled=not items):
            try:
                plan = plan_supply(SellerApi(), items=items)
                st.session_state["supply_plan"] = plan
                st.session_state["supply_summary"] = plan.summary()
            except (OzonApiError, OzonWriteBlocked) as exc:
                fail(exc)

        plan: Optional[SupplyPlan] = st.session_state.get("supply_plan")
        if plan is not None:
            st.success(f"Черновик №{plan.draft_id} готов. В Ozon заявки ещё нет.")
            st.code(st.session_state.get("supply_summary", ""))

            warehouses = {
                str(w.get("name") or w.get("warehouse_name") or w.get("warehouse_id")):
                    int(w.get("warehouse_id") or w.get("id"))
                for w in plan.warehouses
                if str(w.get("warehouse_id") or w.get("id", "")).isdigit()
            }
            slots = {
                f"{s.get('from_in_timezone')} — {s.get('to_in_timezone')}": s
                for s in plan.timeslots
            }

            col_w, col_t = st.columns(2)
            with col_w:
                warehouse_name = st.selectbox("Склад", list(warehouses) or ["—"])
            with col_t:
                slot_name = st.selectbox("Интервал приёмки", list(slots) or ["—"])

            agreed = st.checkbox("Проверил состав, склад и интервал — создаём заявку")
            if st.button(
                "Создать заявку на поставку",
                type="primary",
                width="stretch",
                disabled=not (warehouses and slots and agreed),
            ):
                slot = slots[slot_name]
                try:
                    result = create_supply(
                        SellerApi(),
                        plan,
                        warehouse_id=warehouses[warehouse_name],
                        timeslot_from=str(slot["from_in_timezone"]),
                        timeslot_to=str(slot["to_in_timezone"]),
                        confirm=True,
                    )
                    st.success(f"Заявка создана: №{result['supply_order_id']}")
                    st.json(result)
                    st.session_state.pop("supply_plan", None)
                    st.session_state.pop("supply_summary", None)
                    st.cache_data.clear()
                except OzonWriteBlocked as exc:
                    st.warning(str(exc))
                except OzonApiError as exc:
                    fail(exc)


# ----------------------------------------------------------------------- остатки

with stocks_tab:
    if not creds.has_seller:
        st.info("Нужен ключ Seller API — введите его слева.")
    else:
        st.subheader("Остатки товаров")
        by_warehouse = st.checkbox("В разрезе складов FBO", value=True)
        try:
            payload = seller_call(
                "stocks_on_warehouses" if by_warehouse else "stocks", limit=100
            )
            show(payload, "Остатков нет.")
        except OzonApiError as exc:
            fail(exc)


# ------------------------------------------------------------------------ реклама

with ads_tab:
    if not creds.has_performance:
        st.info("Нужны ключи Performance API — введите их слева.")
    else:
        st.subheader("Кампании")
        try:
            campaigns = perf_call("campaigns")
            show(campaigns, "Кампаний в кабинете нет.")
        except OzonApiError as exc:
            fail(exc)

        st.divider()
        st.subheader("Что приводит трафик")
        st.caption("Показы и расход по поисковым фразам за последние 30 дней.")
        if st.button("Показать фразы"):
            try:
                show(perf_call("phrases"), "Статистики по фразам пока нет.")
            except OzonApiError as exc:
                fail(exc)


# ------------------------------------------------------------------------ ставки

with bids_tab:
    if not creds.has_performance:
        st.info("Нужны ключи Performance API — введите их слева.")
    else:
        st.subheader("Ставки в кампании")
        campaign_id = st.number_input(
            "Номер кампании", min_value=0, step=1, value=0, key="campaign_id",
            help="Возьмите id кампании на вкладке «Реклама».",
        )

        if campaign_id:
            try:
                products = perf_call("products", campaign_id=int(campaign_id))
                show(products, "В кампании нет товаров.")
            except OzonApiError as exc:
                fail(exc)

            st.divider()
            st.markdown("**Изменить ставку**")
            col_sku, col_bid = st.columns(2)
            with col_sku:
                sku_raw = st.text_input("SKU — через запятую", placeholder="123456789, 987654321")
            with col_bid:
                new_bid = st.number_input("Новая ставка, ₽", min_value=0.0, value=30.0, step=1.0)

            skus: List[int] = []
            for part in sku_raw.replace(";", ",").split(","):
                part = part.strip()
                if part.isdigit():
                    skus.append(int(part))

            preview, send = st.columns(2)
            with preview:
                if st.button("Посмотреть, что изменится", width="stretch", disabled=not skus):
                    try:
                        PerformanceApi().set_bids(int(campaign_id), {s: new_bid for s in skus}, apply=False)
                    except OzonWriteBlocked as exc:
                        current = {}
                        try:
                            current = PerformanceApi().current_bids(int(campaign_id))
                        except OzonApiError:
                            pass
                        rows: List[Dict[str, Any]] = []
                        for sku in skus:
                            was: Optional[float] = current.get(sku)
                            rows.append(
                                {
                                    "SKU": sku,
                                    "было": was if was is not None else "—",
                                    "станет": new_bid,
                                    "изменение": (
                                        f"{(new_bid - was) / was * 100:+.0f}%" if was else "—"
                                    ),
                                }
                            )
                        st.dataframe(pd.DataFrame(rows), width="stretch", hide_index=True)
                        st.info(str(exc))
                    except OzonApiError as exc:
                        fail(exc)

            with send:
                if st.button(
                    "Отправить в Ozon",
                    type="primary",
                    width="stretch",
                    disabled=not skus or not allow,
                    help="Включите «Разрешить менять кабинет» слева." if not allow else None,
                ):
                    try:
                        result = PerformanceApi().set_bids(
                            int(campaign_id), {s: new_bid for s in skus}, apply=True
                        )
                        st.success(f"Ставка {new_bid} ₽ отправлена по {len(skus)} SKU.")
                        st.json(result)
                        st.cache_data.clear()
                    except OzonWriteBlocked as exc:
                        st.warning(str(exc))
                    except OzonApiError as exc:
                        fail(exc)
