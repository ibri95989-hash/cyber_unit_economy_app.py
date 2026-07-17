import io

import numpy as np
import pandas as pd
import plotly.express as px
import streamlit as st

st.set_page_config(
    page_title='Wildberries — юнит-экономика',
    page_icon=':bar_chart:',
    layout='wide',
)

# -----------------------------------------------------------------------------
# Column detection helpers

ALIASES = {
    'sku': ['артикул продавца', 'артикул поставщика', 'sku', 'артикул'],
    'name': ['наименование', 'предмет', 'название товара', 'товар'],
    'qty': ['выкупили', 'кол-во', 'количество', 'кол во', 'шт'],
    'revenue': [
        'вайлдберриз реализовал товар',
        'сумма продаж',
        'выручка',
        'сумма реализации',
        'розничная цена',
        'сумма заказов минус комиссия',
    ],
    'commission': ['размер квв', 'комиссия', 'вознаграждение вб', 'удержано комиссии'],
    'logistics': ['логистика', 'услуги по доставке', 'доставка'],
    'storage': ['хранение', 'платная приемка'],
    'fines': ['штраф', 'прочие удержания', 'удержания'],
    'payout': ['к перечислению', 'перечислено продавцу', 'выплата'],
    'cost_price': ['себестоимость', 'закупочная цена', 'закуп'],
}


def guess_column(columns, keywords):
    lower_map = {c: str(c).strip().lower() for c in columns}
    for keyword in keywords:
        for col, lower in lower_map.items():
            if keyword in lower:
                return col
    return None


def column_picker(label, columns, guessed, required=False, key=None):
    options = (['— нет —'] if not required else []) + list(columns)
    default_index = options.index(guessed) if guessed in options else 0
    return st.selectbox(label, options, index=default_index, key=key)


def clean_numeric(val):
    if pd.isna(val):
        return np.nan
    s = str(val).strip()
    s = s.replace(' ', '').replace(',', '.')
    try:
        return float(s)
    except (ValueError, TypeError):
        return np.nan


def find_header_row(df):
    for i in range(min(10, len(df))):
        cols = [str(c).strip().lower() for c in df.iloc[i] if pd.notna(c)]
        cols_text = ' '.join(cols)
        matching_kws = sum(1 for alias_list in ALIASES.values() for kw in alias_list if len(kw) > 2 and kw in cols_text)
        if matching_kws >= 3:
            return i
    return 0


# -----------------------------------------------------------------------------
# Header

st.title(':bar_chart: Анализ юнит-экономики Wildberries')
st.caption(
    'Загрузите выгрузку из личного кабинета продавца WB (отчёт о продажах, детализация '
    'по неделям и т.п.) — приложение посчитает выручку, издержки маркетплейса, '
    'себестоимость, прибыль и маржинальность по каждому товару.'
)

uploaded_file = st.file_uploader('Файл отчёта (CSV или Excel)', type=['csv', 'xlsx', 'xls'])

if uploaded_file is None:
    st.info(
        'Файл должен быть плоской таблицей с заголовками в первой строке '
        '(если в отчёте WB есть служебные шапки/объединённые ячейки — уберите их перед загрузкой).'
    )
    st.stop()

# -----------------------------------------------------------------------------
# Load the file

if uploaded_file.name.lower().endswith(('.xlsx', '.xls')):
    excel_file = pd.ExcelFile(uploaded_file)
    sheet_name = excel_file.sheet_names[0]
    if len(excel_file.sheet_names) > 1:
        sheet_name = st.selectbox('Лист Excel', excel_file.sheet_names)
    df = excel_file.parse(sheet_name, header=None)
    header_row = find_header_row(df)
    df.columns = [str(c).strip() for c in df.iloc[header_row]]
    df = df.iloc[header_row + 1:].reset_index(drop=True)
else:
    raw_bytes = uploaded_file.getvalue()
    df = None
    for encoding in ('utf-8', 'cp1251'):
        for sep in (',', ';'):
            try:
                candidate = pd.read_csv(io.BytesIO(raw_bytes), encoding=encoding, sep=sep, header=None)
                if candidate.shape[1] > 1:
                    header_row = find_header_row(candidate)
                    candidate.columns = [str(c).strip() for c in candidate.iloc[header_row]]
                    candidate = candidate.iloc[header_row + 1:].reset_index(drop=True)
                    df = candidate
                    break
            except Exception:
                continue
        if df is not None:
            break
    if df is None:
        st.error('Не удалось прочитать CSV-файл. Проверьте кодировку и разделитель.')
        st.stop()

df.columns = [str(c).strip() for c in df.columns]

if df.empty:
    st.error('Файл не содержит данных.')
    st.stop()

st.success(f'Загружено строк: {len(df):,}'.replace(',', ' '))
with st.expander('Просмотр исходных данных'):
    st.dataframe(df.head(50), width='stretch')

# -----------------------------------------------------------------------------
# Column mapping

st.header('Сопоставление колонок', divider='gray')
st.caption('Приложение попыталось угадать колонки автоматически — проверьте и поправьте при необходимости.')

columns = list(df.columns)

col1, col2, col3 = st.columns(3)
with col1:
    sku_col = column_picker('Артикул / SKU *', columns, guess_column(columns, ALIASES['sku']), required=True, key='sku')
    name_col = column_picker('Название товара', columns, guess_column(columns, ALIASES['name']), key='name')
with col2:
    qty_col = column_picker('Количество, шт *', columns, guess_column(columns, ALIASES['qty']), required=True, key='qty')
    revenue_col = column_picker('Выручка / сумма продаж', columns, guess_column(columns, ALIASES['revenue']), key='revenue')
with col3:
    payout_col = column_picker('К перечислению продавцу', columns, guess_column(columns, ALIASES['payout']), key='payout')
    cost_price_col = column_picker('Себестоимость за единицу (если есть)', columns, guess_column(columns, ALIASES['cost_price']), key='cost')

st.markdown('**Издержки Wildberries** (используются только если не указана колонка «К перечислению»)')
col4, col5, col6, col7 = st.columns(4)
with col4:
    commission_col = column_picker('Комиссия WB', columns, guess_column(columns, ALIASES['commission']), key='commission')
with col5:
    logistics_col = column_picker('Логистика', columns, guess_column(columns, ALIASES['logistics']), key='logistics')
with col6:
    storage_col = column_picker('Хранение', columns, guess_column(columns, ALIASES['storage']), key='storage')
with col7:
    fines_col = column_picker('Штрафы/удержания', columns, guess_column(columns, ALIASES['fines']), key='fines')

missing_required = [
    label for label, value in [('Артикул / SKU', sku_col), ('Количество', qty_col)]
    if value == '— нет —'
]
if missing_required:
    st.warning('Укажите обязательные колонки: ' + ', '.join(missing_required))
    st.stop()

if revenue_col == '— нет —' and payout_col == '— нет —':
    st.warning('Укажите хотя бы одну из колонок: «Выручка» или «К перечислению продавцу»')
    st.stop()

# -----------------------------------------------------------------------------
# Aggregate by SKU

numeric_cols = [qty_col, revenue_col, commission_col, logistics_col, storage_col, fines_col, payout_col, cost_price_col]
for c in numeric_cols:
    if c and c != '— нет —' and c in df.columns:
        df[c] = df[c].apply(clean_numeric).fillna(0)

agg = {qty_col: 'sum'}
if revenue_col != '— нет —':
    agg[revenue_col] = 'sum'
if name_col != '— нет —':
    agg[name_col] = 'first'
for c in [commission_col, logistics_col, storage_col, fines_col, payout_col]:
    if c != '— нет —':
        agg[c] = 'sum'
if cost_price_col != '— нет —':
    agg[cost_price_col] = 'mean'

grouped = df.groupby(sku_col, as_index=False).agg(agg)

rename_map = {sku_col: 'sku', qty_col: 'qty'}
if revenue_col != '— нет —':
    rename_map[revenue_col] = 'revenue'
if name_col != '— нет —':
    rename_map[name_col] = 'name'
if commission_col != '— нет —':
    rename_map[commission_col] = 'commission'
if logistics_col != '— нет —':
    rename_map[logistics_col] = 'logistics'
if storage_col != '— нет —':
    rename_map[storage_col] = 'storage'
if fines_col != '— нет —':
    rename_map[fines_col] = 'fines'
if payout_col != '— нет —':
    rename_map[payout_col] = 'payout'
if cost_price_col != '— нет —':
    rename_map[cost_price_col] = 'cost_price'
grouped = grouped.rename(columns=rename_map)

if 'name' not in grouped.columns:
    grouped['name'] = ''

if 'revenue' not in grouped.columns and 'payout' in grouped.columns:
    grouped['revenue'] = grouped['payout']

for c in ['commission', 'logistics', 'storage', 'fines']:
    if c not in grouped.columns:
        grouped[c] = 0.0

grouped['wb_fees'] = grouped['commission'] + grouped['logistics'] + grouped['storage'] + grouped['fines']

if 'payout' in grouped.columns:
    grouped['net_payout'] = grouped['payout']
else:
    grouped['net_payout'] = grouped['revenue'] - grouped['wb_fees']

# -----------------------------------------------------------------------------
# Cost price (себестоимость)

st.header('Себестоимость', divider='gray')

if 'cost_price' not in grouped.columns:
    st.caption(
        'В отчёте WB обычно нет себестоимости — впишите её вручную для каждого артикула, '
        'чтобы посчитать реальную прибыль (можно оставить 0, тогда прибыль будет равна выплате WB).'
    )
    editor_df = grouped[['sku', 'name', 'qty']].copy()
    editor_df['cost_price'] = 0.0
    edited = st.data_editor(
        editor_df,
        column_config={
            'sku': st.column_config.TextColumn('Артикул', disabled=True),
            'name': st.column_config.TextColumn('Название', disabled=True),
            'qty': st.column_config.NumberColumn('Кол-во, шт', disabled=True),
            'cost_price': st.column_config.NumberColumn('Себестоимость за 1 шт, ₽', min_value=0.0, step=1.0),
        },
        width='stretch',
        hide_index=True,
        key='cost_editor',
    )
    grouped = grouped.merge(edited[['sku', 'cost_price']], on='sku', how='left')

grouped['cost_price'] = grouped['cost_price'].fillna(0)
grouped['cogs'] = grouped['qty'] * grouped['cost_price']
grouped['gross_profit'] = grouped['net_payout'] - grouped['cogs']
grouped['margin_pct'] = grouped['gross_profit'] / grouped['revenue'].replace(0, np.nan) * 100
grouped['profit_per_unit'] = grouped['gross_profit'] / grouped['qty'].replace(0, np.nan)
grouped['roi_pct'] = grouped['gross_profit'] / grouped['cogs'].replace(0, np.nan) * 100

# -----------------------------------------------------------------------------
# KPIs

st.header('Итоги', divider='gray')

total_revenue = grouped['revenue'].sum()
total_fees = grouped['wb_fees'].sum()
total_payout = grouped['net_payout'].sum()
total_cogs = grouped['cogs'].sum()
total_profit = grouped['gross_profit'].sum()
avg_margin = (total_profit / total_revenue * 100) if total_revenue else 0

kpi1, kpi2, kpi3, kpi4, kpi5 = st.columns(5)
kpi1.metric('Выручка', f'{total_revenue:,.0f} ₽'.replace(',', ' '))
kpi2.metric('Издержки WB', f'{total_fees:,.0f} ₽'.replace(',', ' '))
kpi3.metric('Себестоимость', f'{total_cogs:,.0f} ₽'.replace(',', ' '))
kpi4.metric('Валовая прибыль', f'{total_profit:,.0f} ₽'.replace(',', ' '))
kpi5.metric('Средняя маржа', f'{avg_margin:,.1f} %')

# -----------------------------------------------------------------------------
# Table

st.header('По товарам', divider='gray')

display_df = grouped[[
    'sku', 'name', 'qty', 'revenue', 'wb_fees', 'cogs', 'net_payout',
    'gross_profit', 'margin_pct', 'profit_per_unit', 'roi_pct',
]].sort_values('gross_profit', ascending=False)

st.dataframe(
    display_df,
    width='stretch',
    hide_index=True,
    column_config={
        'sku': st.column_config.TextColumn('Артикул'),
        'name': st.column_config.TextColumn('Название'),
        'qty': st.column_config.NumberColumn('Кол-во, шт'),
        'revenue': st.column_config.NumberColumn('Выручка, ₽', format='%.0f'),
        'wb_fees': st.column_config.NumberColumn('Издержки WB, ₽', format='%.0f'),
        'cogs': st.column_config.NumberColumn('Себестоимость, ₽', format='%.0f'),
        'net_payout': st.column_config.NumberColumn('Выплата WB, ₽', format='%.0f'),
        'gross_profit': st.column_config.NumberColumn('Валовая прибыль, ₽', format='%.0f'),
        'margin_pct': st.column_config.NumberColumn('Маржа, %', format='%.1f'),
        'profit_per_unit': st.column_config.NumberColumn('Прибыль/шт, ₽', format='%.1f'),
        'roi_pct': st.column_config.NumberColumn('ROI, %', format='%.1f'),
    },
)

st.download_button(
    'Скачать таблицу (CSV)',
    display_df.to_csv(index=False).encode('utf-8-sig'),
    file_name='wb_unit_economics.csv',
    mime='text/csv',
)

# -----------------------------------------------------------------------------
# Charts

st.header('Графики', divider='gray')

chart_col1, chart_col2 = st.columns(2)

with chart_col1:
    top_n = display_df.head(10).sort_values('gross_profit')
    if not top_n.empty:
        fig_top = px.bar(
            top_n, x='gross_profit', y='sku', orientation='h',
            title='Топ-10 товаров по прибыли',
            labels={'gross_profit': 'Валовая прибыль, ₽', 'sku': 'Артикул'},
        )
        st.plotly_chart(fig_top, width='stretch')

with chart_col2:
    worst_n = display_df.tail(10).sort_values('gross_profit')
    if not worst_n.empty:
        fig_worst = px.bar(
            worst_n, x='gross_profit', y='sku', orientation='h',
            title='Аутсайдеры по прибыли',
            labels={'gross_profit': 'Валовая прибыль, ₽', 'sku': 'Артикул'},
        )
        st.plotly_chart(fig_worst, width='stretch')

cost_structure = pd.DataFrame({
    'Статья': ['Комиссия WB', 'Логистика', 'Хранение', 'Штрафы/удержания', 'Себестоимость', 'Чистая прибыль'],
    'Сумма': [
        grouped['commission'].sum(),
        grouped['logistics'].sum(),
        grouped['storage'].sum(),
        grouped['fines'].sum(),
        total_cogs,
        max(total_profit, 0),
    ],
})
cost_structure = cost_structure[cost_structure['Сумма'] > 0]
if not cost_structure.empty:
    fig_pie = px.pie(cost_structure, names='Статья', values='Сумма', title='Структура выручки', hole=0.45)
    st.plotly_chart(fig_pie, width='stretch')
