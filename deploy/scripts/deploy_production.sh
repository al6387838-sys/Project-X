#!/usr/bin/env bash
# LifeOS — Production Deploy Script
# Usage: ./deploy/scripts/deploy_production.sh
set -euo pipefail

# ─── Configuration ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
RELEASE_CONFIG="$ROOT_DIR/config/release.json"
LIFEOS_VERSION="$(sed -n 's/^[[:space:]]*"release"[[:space:]]*:[[:space:]]*"\\([^"\\]*\\)".*/\\1/p' "$RELEASE_CONFIG" | head -n 1)"
[[ "$LIFEOS_VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Invalid release in $RELEASE_CONFIG" >&2; exit 1; }
DEPLOY_ENV="production"
COMPOSE_FILE="docker-compose.yml"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deploy_$(date +%Y%m%d_%H%M%S).log"
HEALTH_CHECK_RETRIES=10
HEALTH_CHECK_INTERVAL=5

# ─── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓ $1${NC}" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠ $1${NC}" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[$(date '+%H:%M:%S')] ✗ $1${NC}" | tee -a "$LOG_FILE"; exit 1; }

# ─── Pre-flight Checks ──────────────────────────────────────────────────────
preflight_checks() {
    log "Running pre-flight checks..."
    
    command -v docker >/dev/null 2>&1 || error "Docker not found"
    command -v docker-compose >/dev/null 2>&1 || error "Docker Compose not found"
    
    [[ -f ".env" ]] || warn ".env file not found — using defaults"
    [[ -n "${ENCRYPTION_KEY:-}" ]] || error "ENCRYPTION_KEY must be set"
    
    success "Pre-flight checks passed"
}

# ─── Backup ─────────────────────────────────────────────────────────────────
create_backup() {
    log "Creating backup before deploy..."
    mkdir -p "$BACKUP_DIR"
    
    BACKUP_NAME="lifeos_backup_${LIFEOS_VERSION}_$(date +%Y%m%d_%H%M%S)"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    mkdir -p "$BACKUP_PATH"
    
    # Backup data volumes
    if docker volume ls | grep -q "lifeos-data"; then
        docker run --rm \
            -v lifeos-data:/data \
            -v "$(pwd)/$BACKUP_PATH":/backup \
            alpine tar czf /backup/lifeos-data.tar.gz -C /data . 2>/dev/null || warn "Data backup skipped (no data volume)"
    fi
    
    # Backup current config
    cp -r deploy/ "$BACKUP_PATH/deploy_config/" 2>/dev/null || true
    
    success "Backup created: $BACKUP_PATH"
    echo "$BACKUP_PATH" > /tmp/lifeos_last_backup
}

# ─── Run Tests ──────────────────────────────────────────────────────────────
run_tests() {
    log "Running test suite before deploy..."
    python3 -m pytest --tb=short -q 2>&1 | tail -3
    [[ ${PIPESTATUS[0]} -eq 0 ]] || error "Tests failed — aborting deploy"
    success "All tests passed"
}

# ─── Build ──────────────────────────────────────────────────────────────────
build_image() {
    log "Building LifeOS Docker image v${LIFEOS_VERSION}..."
    docker build \
        --target production \
        --tag "lifeos:${LIFEOS_VERSION}" \
        --tag "lifeos:latest" \
        --build-arg LIFEOS_VERSION="${LIFEOS_VERSION}" \
        --label "build.date=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --label "build.version=${LIFEOS_VERSION}" \
        . 2>&1 | tail -5
    success "Image built: lifeos:${LIFEOS_VERSION}"
}

# ─── Deploy ─────────────────────────────────────────────────────────────────
deploy() {
    log "Deploying LifeOS ${LIFEOS_VERSION} to ${DEPLOY_ENV}..."
    
    export LIFEOS_VERSION
    export LIFEOS_ENV="$DEPLOY_ENV"
    
    docker-compose -f "$COMPOSE_FILE" up -d --remove-orphans 2>&1 | tail -10
    success "Services started"
}

# ─── Health Check ───────────────────────────────────────────────────────────
health_check() {
    log "Running health checks..."
    
    for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
        if docker-compose -f "$COMPOSE_FILE" exec -T lifeos-core \
            python3 -c "from life_kernel.core import LifeKernel; print('OK')" 2>/dev/null; then
            success "Health check passed (attempt $i)"
            return 0
        fi
        warn "Health check attempt $i/$HEALTH_CHECK_RETRIES failed — waiting ${HEALTH_CHECK_INTERVAL}s..."
        sleep $HEALTH_CHECK_INTERVAL
    done
    
    error "Health check failed after $HEALTH_CHECK_RETRIES attempts"
}

# ─── Post-deploy ────────────────────────────────────────────────────────────
post_deploy() {
    log "Post-deploy verification..."
    docker-compose -f "$COMPOSE_FILE" ps
    success "Deploy complete — LifeOS ${LIFEOS_VERSION} is running"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  LifeOS ${LIFEOS_VERSION} deployed to ${DEPLOY_ENV}"
    echo "  Grafana:    http://localhost:3000"
    echo "  Prometheus: http://localhost:9090"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ─── Main ───────────────────────────────────────────────────────────────────
main() {
    mkdir -p logs
    log "Starting LifeOS ${LIFEOS_VERSION} production deploy"
    
    preflight_checks
    create_backup
    run_tests
    build_image
    deploy
    health_check
    post_deploy
}

main "$@"
