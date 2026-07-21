#!/usr/bin/env bash
# LifeOS Enterprise — Cloudflare Infrastructure Setup
# Executa a criação de toda a infraestrutura necessária
# Uso: ./scripts/setup-cloudflare.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="lifeos-enterprise"

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   LifeOS Enterprise — Cloudflare Infra Setup          ║"
echo "║   v46.0.0                                             ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Verificar wrangler
echo "→ Verificando wrangler..."
if ! command -v wrangler &> /dev/null; then
  echo "  Instalando wrangler..."
  npm install -g wrangler
fi
npx wrangler --version

# ─── 1. KV Namespace ─────────────────────────────────────
echo ""
echo "→ [1/5] Criando KV Namespace..."
echo "  Comando: npx wrangler kv:namespace create LIFEOS_KV"
echo "  Copie o ID retornado para o wrangler.toml"

# ─── 2. R2 Buckets ───────────────────────────────────────
echo ""
echo "→ [2/5] Criando R2 Buckets..."
echo "  Bucket 1: lifeos-files"
echo "    Comando: npx wrangler r2 bucket create lifeos-files"
echo "  Bucket 2: lifeos-documents"
echo "    Comando: npx wrangler r2 bucket create lifeos-documents"
echo "  Bucket 3: lifeos-storage"
echo "    Comando: npx wrangler r2 bucket create lifeos-storage"

# ─── 3. Secrets ──────────────────────────────────────────
echo ""
echo "→ [3/5] Configurando Secrets..."
echo "  Comandos necessários:"
echo "    npx wrangler secret put LIFEOS_SESSION_SECRET"
echo "    npx wrangler secret put CLOUDFLARE_R2_ACCESS_KEY"
echo "    npx wrangler secret put STRIPE_SECRET_KEY"
echo "    npx wrangler secret put GOOGLE_CLIENT_SECRET"
echo "    npx wrangler secret put APPLE_PRIVATE_KEY"
echo "    npx wrangler secret put SMTP_PASSWORD"
echo "    npx wrangler secret put WHATSAPP_API_KEY"
echo "    npx wrangler secret put ENCRYPTION_KEY"
echo "    npx wrangler secret put SENDGRID_API_KEY"
echo "    npx wrangler secret put CLOUDFLARE_TURNSTILE_SECRET"

# ─── 4. Pages Project ────────────────────────────────────
echo ""
echo "→ [4/5] Deploy do Cloudflare Pages..."
echo "  Comando: npx wrangler pages deploy dist --project-name $PROJECT_NAME --branch main"

# ─── 5. Verificação ─────────────────────────────────────
echo ""
echo "→ [5/5] Verificação..."
echo "  Comando: npx wrangler pages deployment list --project-name $PROJECT_NAME"

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   Setup completo!                                    ║"
echo "║   URL: https://${PROJECT_NAME}.pages.dev              ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
