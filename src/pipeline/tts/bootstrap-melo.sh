#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
VENV_DIR="${VF_TTS_MELO_VENV:-$ROOT_DIR/.venv-melotts}"

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required for MeloTTS bootstrap" >&2
  exit 1
fi

uv venv --python 3.10 "$VENV_DIR"
uv pip --python "$VENV_DIR/bin/python" install \
  "git+https://github.com/myshell-ai/MeloTTS.git" \
  "python-mecab-ko" \
  "faster-whisper==1.2.1"

echo "MeloTTS Korean venv ready: $VENV_DIR"
