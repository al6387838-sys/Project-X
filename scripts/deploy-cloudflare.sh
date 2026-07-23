#!/usr/bin/env bash
# LifeOS Enterprise — Cloudflare Pages deploy script

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="lifeos-enterprise"

cd "$ROOT_DIR"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   LifeOS Enterprise — Cloudflare Pages Deploy            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo "→ [1/5] Removendo artefatos e caches de build anteriores..."
node scripts/clean-build.mjs

echo "→ [2/5] Executando build de produção limpo..."
node scripts/build.mjs

release_field() {
  local field="$1"
  sed -n "s/^[[:space:]]*\"${field}\": \"\([^\"]*\)\".*/\1/p" dist/release.json | head -n 1
}

RELEASE="$(release_field release)"
BUILD_ID="$(release_field buildId)"
COMMIT_SHA="$(release_field commit)"

if [[ -z "$RELEASE" || -z "$BUILD_ID" || -z "$COMMIT_SHA" ]]; then
  echo "Erro: dist/release.json não contém os identificadores obrigatórios." >&2
  exit 1
fi

echo "→ [3/5] Verificando publicação e metadados..."
npx wrangler --version
node scripts/verify-production.mjs

echo "→ [4/5] Publicando o artefato limpo..."
npx wrangler pages deploy dist \
  --project-name "$PROJECT_NAME" \
  --branch main \
  --commit-dirty=true

echo "→ [5/5] Deploy concluído."
echo ""
echo "  Projeto    : $PROJECT_NAME"
echo "  Release    : $RELEASE"
echo "  Build ID   : $BUILD_ID"
echo "  Commit SHA : $COMMIT_SHA"
echo "  URL        : https://${PROJECT_NAME}.pages.dev"
echo ""
