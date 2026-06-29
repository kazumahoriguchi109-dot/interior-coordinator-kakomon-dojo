#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"

PORT="${1:-8000}"

echo "Serving interior-coordinator-dojo at http://127.0.0.1:${PORT}"
python3 -m http.server "${PORT}"
