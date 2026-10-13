# STD-19 — not used in production until Phase 5 (prod/staging run under systemd, see docs/deploy.md).
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install deps before copying source (better layer cache).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Non-root user; source is owned by root and read-only for the app user.
RUN useradd --create-home --uid 10001 appuser
COPY app/ ./app/
USER appuser

EXPOSE 8087

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8087/health/live', timeout=3).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8087", "--workers", "1", "--no-server-header", "--no-access-log"]
