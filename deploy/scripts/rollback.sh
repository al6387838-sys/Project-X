#!/usr/bin/env bash
# LifeOS V1.0 RC — Rollback Script
# Usage: ./deploy/scripts/rollback.sh [VERSION]
set -euo pipefail

TARGET_VERSION="${1:-}"
BACKUP_DIR="./backups"
COMPOSE_FILE="docker-compose.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓ $1${NC}"; }
error() { echo -e "${RED}[$(date '+%H:%M:%S')] ✗ $1${NC}"; exit 1; }

log "Starting LifeOS rollback..."

# ─── Find target backup ─────────────────────────────────────────────────────
if [[ -z "$TARGET_VERSION" ]]; then
    LAST_BACKUP=$(cat /tmp/lifeos_last_backup 2>/dev/null || echo "")
    if [[ -z "$LAST_BACKUP" ]]; then
        # Find most recent backup
        LAST_BACKUP=$(ls -td "$BACKUP_DIR"/lifeos_backup_* 2>/dev/null | head -1 || echo "")
    fi
    TARGET_VERSION="$LAST_BACKUP"
fi

[[ -n "$TARGET_VERSION" ]] || error "No backup found. Specify version: ./rollback.sh VERSION"
[[ -d "$TARGET_VERSION" ]] || error "Backup not found: $TARGET_VERSION"

log "Rolling back to: $TARGET_VERSION"

# ─── Stop current services ──────────────────────────────────────────────────
log "Stopping current services..."
docker-compose -f "$COMPOSE_FILE" down 2>/dev/null || true

# ─── Restore data ───────────────────────────────────────────────────────────
if [[ -f "$TARGET_VERSION/lifeos-data.tar.gz" ]]; then
    log "Restoring data volume..."
    docker volume create lifeos-data 2>/dev/null || true
    docker run --rm \
        -v lifeos-data:/data \
        -v "$(pwd)/$TARGET_VERSION":/backup \
        alpine sh -c "cd /data && tar xzf /backup/lifeos-data.tar.gz"
    success "Data restored"
fi

# ─── Find and restore previous Docker image ─────────────────────────────────
PREV_IMAGE=$(docker images lifeos --format "{{.Tag}}" | grep -v "latest\|1.0.0-rc" | head -1 || echo "")

if [[ -n "$PREV_IMAGE" ]]; then
    log "Restoring image: lifeos:$PREV_IMAGE"
    docker tag "lifeos:$PREV_IMAGE" "lifeos:latest"
    LIFEOS_VERSION="$PREV_IMAGE" docker-compose -f "$COMPOSE_FILE" up -d
    success "Rolled back to lifeos:$PREV_IMAGE"
else
    log "No previous image found — rebuilding from backup config..."
    docker-compose -f "$COMPOSE_FILE" up -d --build
fi

success "Rollback complete"
docker-compose -f "$COMPOSE_FILE" ps
