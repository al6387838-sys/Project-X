# LifeOS — Production Dockerfile
# Multi-stage build for minimal production image

# ─── Stage 1: Builder ───────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ─── Stage 2: Production ────────────────────────────────────────────────────
FROM python:3.12-slim AS production
ARG LIFEOS_VERSION

LABEL maintainer="LifeOS Team"
LABEL version="${LIFEOS_VERSION}"
LABEL description="LifeOS — AI-Powered Life Operating System"

WORKDIR /app

# Create non-root user for security
RUN groupadd -r lifeos && useradd -r -g lifeos -d /app -s /sbin/nologin lifeos

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY --chown=lifeos:lifeos . .

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    LIFEOS_ENV=production \
    LIFEOS_VERSION=${LIFEOS_VERSION} \
    LOG_LEVEL=INFO

# Switch to non-root user
USER lifeos

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python3 -c "from life_kernel.core import LifeKernel; print('OK')" || exit 1

# Default command
CMD ["python3", "-m", "life_orchestrator.main"]
