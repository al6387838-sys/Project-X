#!/usr/bin/env bash
# LifeOS — Staging Deploy Script
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_CONFIG="$(cd "$SCRIPT_DIR/../.." && pwd)/config/release.json"
LIFEOS_VERSION="$(sed -n 's/^[[:space:]]*"release"[[:space:]]*:[[:space:]]*"\\([^"\\]*\\)".*/\\1/p' "$RELEASE_CONFIG" | head -n 1)"
[[ "$LIFEOS_VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Invalid release in $RELEASE_CONFIG" >&2; exit 1; }
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
