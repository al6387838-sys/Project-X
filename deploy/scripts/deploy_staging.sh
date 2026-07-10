#!/usr/bin/env bash
# LifeOS V1.0 RC — Staging Deploy Script
set -euo pipefail

LIFEOS_VERSION="${LIFEOS_VERSION:-1.0.0-rc}"
DEPLOY_ENV="staging"

echo "[STAGING] Deploying LifeOS ${LIFEOS_VERSION}..."

# Run tests
python3 -m pytest --tb=short -q 2>&1 | tail -3
[[ ${PIPESTATUS[0]} -eq 0 ]] || { echo "Tests failed"; exit 1; }

# Build and deploy with staging overrides
export LIFEOS_ENV=staging
export LOG_LEVEL=DEBUG

docker-compose \
    -f docker-compose.yml \
    -f docker-compose.staging.yml \
    up -d --build --remove-orphans

echo "[STAGING] LifeOS ${LIFEOS_VERSION} deployed to staging"
echo "  Grafana:    http://localhost:13000"
echo "  Prometheus: http://localhost:19090"
