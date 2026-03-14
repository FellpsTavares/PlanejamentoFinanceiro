#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.production.yml)
ENV_FILE="fintech-saas/.env.docker.production"
SKIP_EXTERNAL="${1:-}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[ERRO] Arquivo $ENV_FILE não encontrado."
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

DOMAIN="${DOMAIN:-elofinanceiro.com.br}"
DB_NAME_EFFECTIVE="${DB_NAME:-${POSTGRES_DB:-elofinanceiro}}"
DB_USER_EFFECTIVE="${DB_USER:-${POSTGRES_USER:-elofinanceiro}}"

echo "[1/8] Validando configuração do Compose (produção)..."
"${COMPOSE[@]}" config > /dev/null

echo "[2/8] Verificando serviços em execução..."
"${COMPOSE[@]}" ps

for svc in db backend web; do
  if ! "${COMPOSE[@]}" ps --services --filter status=running | grep -qx "$svc"; then
    echo "[ERRO] Serviço '$svc' não está em execução."
    exit 1
  fi
done

echo "[3/8] Validando disponibilidade do PostgreSQL..."
"${COMPOSE[@]}" exec -T db pg_isready -U "$DB_USER_EFFECTIVE" -d "$DB_NAME_EFFECTIVE"

echo "[4/8] Validando migrations..."
"${COMPOSE[@]}" exec -T backend python manage.py migrate --noinput

echo "[5/8] Validando check de deploy do Django..."
"${COMPOSE[@]}" exec -T backend python manage.py check --deploy

echo "[6/8] Validando health interno no backend..."
"${COMPOSE[@]}" exec -T backend python - <<'PY'
import urllib.request
req = urllib.request.Request(
    'http://127.0.0.1:8000/healthz/',
    headers={'X-Forwarded-Proto': 'https'}
)
print(urllib.request.urlopen(req, timeout=15).read().decode())
PY

echo "[7/8] Validando health externo no domínio..."
if [[ "$SKIP_EXTERNAL" == "--skip-external" ]]; then
  echo "[INFO] Validação externa ignorada (--skip-external)."
else
  curl -fsS --max-time 20 "https://${DOMAIN}/healthz" | grep -q '"status"'
  echo "[OK] Health externo respondeu em https://${DOMAIN}/healthz"
fi

echo "[8/8] Pré-go-live concluído com sucesso."
echo "[OK] Stack validada para produção."
