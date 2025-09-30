FROM python:3.11-slim
WORKDIR /app
COPY apps/backend/pyproject.toml /app/
RUN pip install --no-cache-dir -U pip && (pip install -e . || true) || true
COPY apps/backend /app
EXPOSE 8000
CMD ["uvicorn","uvicorn_app:app","--host","0.0.0.0","--port","8000"]
