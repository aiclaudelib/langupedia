#!/usr/bin/env bash
# Shim delegating to Node CLI (SQLite-backed).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/lexicon.mjs" "$@"
