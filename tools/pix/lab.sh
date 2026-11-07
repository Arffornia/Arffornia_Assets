#!/usr/bin/env bash
# Generate one concept image on Brian's image-generation-lab.
#   tools/pix/lab.sh <seed> <out-dir> "<prompt>" [workflow=qwen21-q4]
# qwen21-q4 fits the 16 GB GPU (~30 s/image); qwen21-bf16 spills into RAM and fails.
set -euo pipefail
LAB_DIR=${IMAGE_LAB_DIR:-$HOME/Documents/aepita/other-project/image-generation-lab}
export LAB_URL=${LAB_URL:-http://127.0.0.1:8080}
export LAB_TOKEN=${LAB_TOKEN:-$(grep '^API_TOKEN=' "$LAB_DIR/.env" | cut -d= -f2-)}
BIN=${LAB_CLIENT:-${XDG_CACHE_HOME:-$HOME/.cache}/arffornia/labclient}
[ -x "$BIN" ] || { mkdir -p "$(dirname "$BIN")"; (cd "$LAB_DIR/client" && go build -o "$BIN" .); }
mkdir -p "$2"
exec "$BIN" -workflow "$LAB_DIR/workflows/${4:-qwen21-q4}.json" -seed "$1" -out "$2" -prompt "$3"
