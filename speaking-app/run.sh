#!/usr/bin/env bash
# Start Voice Coach on http://localhost:8000 (local only).
set -euo pipefail
cd "$(dirname "$0")"
[ -x .venv/bin/python ] || { echo "Run ./setup.sh first."; exit 1; }
PORT="${PORT:-8000}"
echo "Voice Coach → http://localhost:$PORT"
( sleep 2; command -v open >/dev/null && open "http://localhost:$PORT" ) >/dev/null 2>&1 &
cd backend
exec ../.venv/bin/python -m uvicorn voicecoach.server:app --host 127.0.0.1 --port "$PORT"
