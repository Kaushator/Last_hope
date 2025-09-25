# FinGPT AI Service
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY docker/fingpt/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy FinGPT application
COPY docker/fingpt/ .

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start the service
CMD ["python", "app.py"]