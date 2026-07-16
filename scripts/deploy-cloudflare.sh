#!/usr/bin/env bash
# LifeOS Enterprise — Cloudflare Pages Deploy Script
# Version: 17.5.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="lifeos-enterprise"
VERSION="17.5.0"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   LifeOS Enterprise — Cloudflare Deploy     ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

cd "$ROOT_DIR"

# 1. Build
echo "→ [1/4] Executando build de produção..."
node scripts/build.mjs

# 2. Verificar wrangler
echo "→ [2/4] Verificando wrangler..."
npx wrangler --version

# 3. Deploy para Cloudflare Pages
echo "→ [3/4] Fazendo deploy para Cloudflare Pages..."
npx wrangler pages deploy dist \
  --project-name "$PROJECT_NAME" \
  --branch main \
  --commit-dirty=true

# 4. Verificar deploy
echo "→ [4/4] Deploy concluído!"
echo ""
echo "  Projeto : $PROJECT_NAME"
echo "  Versão  : $VERSION"
echo "  URL     : https://${PROJECT_NAME}.pages.dev"
echo ""
