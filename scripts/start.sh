#!/usr/bin/env bash
# Starts all ForemanAI services in a single terminal using background processes.
# Run from the project root: bash scripts/start.sh
# Stop everything: Ctrl+C

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[start]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }

cleanup() {
    echo ""
    log "Shutting down..."
    kill "$PHOENIX_PID" "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    wait 2>/dev/null || true
    log "Done."
}
trap cleanup EXIT INT TERM

# 1. Redis
log "Starting Redis Stack..."
if redis-cli -p 6380 ping &>/dev/null; then
    warn "Redis already running on :6380, skipping."
elif redis-cli ping &>/dev/null; then
    warn "Redis already running on :6379, skipping."
else
    redis-stack-server --port 6380 --daemonize yes
    log "Redis started on :6380"
fi

# 2. Arize Phoenix
if lsof -i :6006 &>/dev/null; then
    warn "Phoenix already running on :6006, skipping."
    PHOENIX_PID=""
else
    log "Starting Arize Phoenix on :6006..."
    python3.11 -m phoenix.server.main serve > /tmp/phoenix.log 2>&1 &
    PHOENIX_PID=$!
fi

# 3. FastAPI backend
log "Starting FastAPI backend on :8001..."
python3.11 -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001 > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# 4. Vite frontend
log "Starting Vite frontend on :5173..."
cd "$ROOT/frontend"
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
cd "$ROOT"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Backend   → http://localhost:8001"
echo "  Frontend  → http://localhost:5173"
echo "  Phoenix   → http://localhost:6006"
echo "  Logs      → /tmp/backend.log  /tmp/frontend.log"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Press Ctrl+C to stop all services."
echo ""

wait
