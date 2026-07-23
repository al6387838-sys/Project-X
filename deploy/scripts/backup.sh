#!/usr/bin/env bash
# LifeOS — Backup Script
# Usage: ./deploy/scripts/backup.sh
# Cron: 0 2 * * * /path/to/backup.sh (daily at 2am)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_CONFIG="$(cd "$SCRIPT_DIR/../.." && pwd)/config/release.json"
LIFEOS_VERSION="$(sed -n 's/^[[:space:]]*"release"[[:space:]]*:[[:space:]]*"\\([^"\\]*\\)".*/\\1/p' "$RELEASE_CONFIG" | head -n 1)"
[[ "$LIFEOS_VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Invalid release in $RELEASE_CONFIG" >&2; exit 1; }
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="lifeos_backup_${LIFEOS_VERSION}_${TIMESTAMP}"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓ $1${NC}"; }

mkdir -p "$BACKUP_PATH"
log "Starting LifeOS backup: $BACKUP_NAME"

# ─── Backup data volume ─────────────────────────────────────────────────────
if docker volume ls | grep -q "lifeos-data"; then
    log "Backing up data volume..."
    docker run --rm \
        -v lifeos-data:/data \
        -v "$(pwd)/$BACKUP_PATH":/backup \
        alpine tar czf /backup/lifeos-data.tar.gz -C /data .
    success "Data volume backed up"
fi

# ─── Backup configuration ───────────────────────────────────────────────────
log "Backing up configuration..."
cp -r deploy/ "$BACKUP_PATH/deploy_config/" 2>/dev/null || true
cp docker-compose.yml "$BACKUP_PATH/" 2>/dev/null || true
cp .env "$BACKUP_PATH/.env.backup" 2>/dev/null || true
success "Configuration backed up"

# ─── Create manifest ────────────────────────────────────────────────────────
cat > "$BACKUP_PATH/MANIFEST.json" << EOF
{
  "backup_name": "$BACKUP_NAME",
  "lifeos_version": "$LIFEOS_VERSION",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "hostname": "$(hostname)",
  "contents": ["lifeos-data.tar.gz", "deploy_config/", "docker-compose.yml"]
}
EOF

# ─── Cleanup old backups ────────────────────────────────────────────────────
log "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -maxdepth 1 -type d -name "lifeos_backup_*" \
    -mtime +${RETENTION_DAYS} -exec rm -rf {} + 2>/dev/null || true

# ─── Record last backup ─────────────────────────────────────────────────────
echo "$BACKUP_PATH" > /tmp/lifeos_last_backup

BACKUP_SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
success "Backup complete: $BACKUP_PATH ($BACKUP_SIZE)"
