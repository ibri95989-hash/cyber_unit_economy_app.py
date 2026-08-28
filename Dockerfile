# Образ для запуска агрегатора частотности запросов.
#   docker build -t frequency-app .
#   docker run --rm -p 8501:8501 frequency-app
# Открыть: http://localhost:8501

FROM python:3.11-slim

# Streamlit пишет в свой каталог конфигурации, поэтому нужен домашний каталог.
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HOME=/home/app \
    PORT=8501 \
    STREAMLIT_SERVER_ADDRESS=0.0.0.0 \
    STREAMLIT_SERVER_HEADLESS=true \
    STREAMLIT_BROWSER_GATHER_USAGE_STATS=false

WORKDIR /app

# Зависимости ставим отдельным слоем: пересобираются только при их изменении.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Приложение работает без root: так безопаснее и совпадает с политиками
# большинства хостингов (Render, Cloud Run, Kubernetes).
RUN useradd --create-home --home-dir /home/app --uid 10001 app \
    && chown -R app:app /app /home/app
USER app

EXPOSE 8501

# Хостинги проверяют живость контейнера по этому эндпоинту Streamlit.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,os,sys; \
sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('PORT','8501') + '/healthz', timeout=4).status == 200 else 1)"

# PORT переопределяют Render, Cloud Run и Heroku; по умолчанию 8501.
CMD ["sh", "-c", "streamlit run search_frequency_app.py --server.port=${PORT:-8501} --server.address=0.0.0.0"]
