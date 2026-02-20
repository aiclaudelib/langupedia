#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/.pollinations.json"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Error: Config file not found: $CONFIG_FILE" >&2
  exit 1
fi

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <word> \"<image prompt>\"" >&2
  exit 1
fi

WORD="$1"
IMAGE_PROMPT="$2"

API_KEY=$(jq -r '.apiKey' "$CONFIG_FILE")
MODEL=$(jq -r '.model // "flux"' "$CONFIG_FILE")
WIDTH=$(jq -r '.width // 512' "$CONFIG_FILE")
HEIGHT=$(jq -r '.height // 512' "$CONFIG_FILE")

if [[ -z "$API_KEY" || "$API_KEY" == "null" ]]; then
  echo "Error: apiKey not found in $CONFIG_FILE" >&2
  exit 1
fi

# URL-encode the prompt
ENCODED_PROMPT=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.stdin.read()))" <<< "$IMAGE_PROMPT")

OUTPUT_DIR="$SCRIPT_DIR/public/images/words"
mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="$OUTPUT_DIR/${WORD}.jpg"

HTTP_CODE=$(curl -s -L -o "$OUTPUT_FILE" -w "%{http_code}" \
  "https://gen.pollinations.ai/image/${ENCODED_PROMPT}?model=${MODEL}&width=${WIDTH}&height=${HEIGHT}&nologo=true" \
  -H "Authorization: Bearer ${API_KEY}")

if [[ "$HTTP_CODE" -lt 200 || "$HTTP_CODE" -ge 300 ]]; then
  echo "Error: API returned HTTP $HTTP_CODE" >&2
  rm -f "$OUTPUT_FILE"
  exit 1
fi

if [[ ! -s "$OUTPUT_FILE" ]]; then
  echo "Error: Generated file is empty" >&2
  rm -f "$OUTPUT_FILE"
  exit 1
fi

echo "images/words/${WORD}.jpg"
