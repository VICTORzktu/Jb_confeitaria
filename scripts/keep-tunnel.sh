#!/usr/bin/env bash
# Mantém app + túnel de pé e troca o endereço automaticamente quando o túnel cai.
set -u
cd "$(dirname "$0")/.."
LOG=/tmp/fitai-guard.log
URLFILE=/tmp/fitai-tunnel-url.txt

export DATABASE_URL="${DATABASE_URL:-postgresql://postgres.jhnoeprirdxdlcteecft:FitAI%23Demo2026!@aws-1-us-east-1.pooler.supabase.com:5432/postgres}"
export JWT_SECRET="${JWT_SECRET:-fitai-prod-8f2a1c9e4b7d6350a91e2f8c4d7b0a36e5c9f1d8b4a72e0c6f3d9a5b8e1c4f70}"
export SHOW_DEMO_ACCOUNTS=1
export NODE_ENV=production

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

# app
if ! curl -sf --max-time 5 http://127.0.0.1:3000/api/public/health >/dev/null 2>&1; then
  log "app fora do ar — subindo"
  nohup node server/index.js >> /tmp/fitai-app.log 2>&1 &
  for i in $(seq 1 30); do
    sleep 2
    curl -sf --max-time 5 http://127.0.0.1:3000/api/public/health >/dev/null 2>&1 && break
  done
fi
log "app OK"

while true; do
  if ! pgrep -f "cloudflared tunnel --url" >/dev/null 2>&1; then
    log "túnel caiu — criando novo"
    rm -f /tmp/cloudflared-out.log
    nohup /tmp/cloudflared tunnel --url http://127.0.0.1:3000 --no-autoupdate --logfile /tmp/cloudflared-out.log >/dev/null 2>&1 &
    NEW=""
    for i in $(seq 1 40); do
      sleep 2
      NEW=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared-out.log 2>/dev/null | head -1)
      [ -n "$NEW" ] && break
    done
    if [ -n "$NEW" ]; then
      # espera o DNS/edge do Cloudflare começar a responder antes de publicar o endereço
      OK=0
      for j in $(seq 1 18); do
        C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$NEW/api/public/health" 2>/dev/null)
        [ "$C" = "200" ] && { OK=1; break; }
        sleep 8
      done
      if [ "$OK" = "1" ]; then echo "$NEW" > "$URLFILE"; log "NOVO ENDEREÇO (ativo): $NEW"
      else log "endereço $NEW não respondeu — tentará de novo no próximo ciclo"; fi
    fi
  fi
  URL=$(cat "$URLFILE" 2>/dev/null || true)
  if [ -n "$URL" ]; then
    CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 25 "$URL/api/public/health" 2>/dev/null || echo 000)
    log "checagem → $CODE ($URL)"
    if [ "$CODE" != "200" ]; then
      FAILS=$(( ${FAILS:-0} + 1 ))
      log "sem resposta ($FAILS/2)"
      if [ "$FAILS" -ge 2 ]; then
        log "duas falhas seguidas — reciclando túnel"
        pkill -f "cloudflared tunnel --url" 2>/dev/null
        FAILS=0
        sleep 5
      fi
    else
      FAILS=0
    fi
  fi
  sleep 60
done
