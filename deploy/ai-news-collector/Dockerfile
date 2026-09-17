FROM python:3.11-slim-bookworm

# The official image includes CA certificates and tzdata; verify at build time.
ENV TZ=Asia/Tokyo PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY scripts/collect-ai-news.py scripts/schedule-ai-news.py scripts/ai_news_safety.py /app/
RUN mkdir -p /data/items /data/runs /data/scheduler \
    && python -B -c "import ssl; from zoneinfo import ZoneInfo; ZoneInfo('Asia/Tokyo'); assert ssl.create_default_context().get_ca_certs()"
USER 65532:65532
ENTRYPOINT ["python", "-B", "/app/schedule-ai-news.py"]
