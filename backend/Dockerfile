FROM python:3.12-slim

WORKDIR /app

# зависимости отдельно — кешируется
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV MEDIA_DIR=/app/media
EXPOSE 8000

# PORT подставляет хостинг (Render и пр.); локально по умолчанию 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
