# Шрифты

В папке лежат сабсеты, скачанные с Google Fonts (`fetch_fonts.py`):

- **Montserrat** (700/800/900) — заголовки и цифры;
- **Inter** (500/600/700/800) — подписи и интерфейсные элементы.

Оба шрифта распространяются под SIL Open Font License 1.1:
<https://openfontlicense.org>. Исходники:
<https://fonts.google.com/specimen/Montserrat>,
<https://fonts.google.com/specimen/Inter>.

Хранятся в репозитории, чтобы рендер собирался без доступа к сети: сабсеты
`cyrillic`, `cyrillic-ext`, `latin`, `latin-ext` (последний нужен для знака ₽,
U+20BD). `fetch_fonts.py` инлайнит их в `render/fonts.css` как base64.
