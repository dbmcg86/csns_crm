#!/usr/bin/env bash
# One-time setup. Creates a local Python environment and installs dependencies.
set -euo pipefail
cd "$(dirname "$0")"

PY="${PYTHON:-}"
if [ -z "$PY" ]; then
  for c in python3.13 python3.12 python3.11 python3; do
    if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(sys.version_info < (3, 10))'; then PY="$c"; break; fi
  done
fi
[ -n "$PY" ] || { echo "Need Python 3.10+. On a Mac: brew install python@3.12"; exit 1; }

echo "Using $($PY --version)"
"$PY" -m venv .venv
.venv/bin/pip install --upgrade pip -q
.venv/bin/pip install -q -r backend/requirements.txt

if [ "$(uname -s)" = "Darwin" ] && [ "$(uname -m)" = "arm64" ]; then
  echo "Apple Silicon detected: installing mlx-whisper (GPU transcription)"
  .venv/bin/pip install -q -r backend/requirements-mac.txt
fi

echo
echo "Done. Start the app with: ./run.sh"
