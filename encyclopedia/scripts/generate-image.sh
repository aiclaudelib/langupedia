#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."
CONFIG_FILE="$SCRIPT_DIR/.cloudflare.json"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Error: Config file not found: $CONFIG_FILE" >&2
  exit 1
fi

PROJECT=""
if [[ "${1:-}" == "--project" ]]; then
  PROJECT="${2:?Error: --project requires a project id (e.g. tainted-grail)}"
  shift 2
fi

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 [--project <id>] <word> \"<image prompt>\"" >&2
  exit 1
fi

WORD="$1"
IMAGE_PROMPT="$2"

API_TOKEN=$(jq -r '.apiToken' "$CONFIG_FILE")
ACCOUNT_ID=$(jq -r '.accountId' "$CONFIG_FILE")
MODEL=$(jq -r '.model // "@cf/bytedance/stable-diffusion-xl-lightning"' "$CONFIG_FILE")
NUM_STEPS=$(jq -r '.numSteps // 6' "$CONFIG_FILE")
WIDTH=$(jq -r '.width // 1024' "$CONFIG_FILE")
HEIGHT=$(jq -r '.height // 1024' "$CONFIG_FILE")
GUIDANCE=$(jq -r '.guidance // 7.5' "$CONFIG_FILE")

if [[ -z "$API_TOKEN" || "$API_TOKEN" == "null" ]]; then
  echo "Error: apiToken not found in $CONFIG_FILE" >&2
  exit 1
fi
if [[ -z "$ACCOUNT_ID" || "$ACCOUNT_ID" == "null" ]]; then
  echo "Error: accountId not found in $CONFIG_FILE" >&2
  exit 1
fi

if [[ -n "$PROJECT" ]]; then
  OUTPUT_DIR="$PROJECT_ROOT/public/data/projects/${PROJECT}/images/words"
  RELATIVE_PATH="/data/projects/${PROJECT}/images/words/${WORD}.jpg"
else
  OUTPUT_DIR="$PROJECT_ROOT/public/images/words"
  RELATIVE_PATH="images/words/${WORD}.jpg"
fi

mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="$OUTPUT_DIR/${WORD}.jpg"

# Build request body. flux-* models use {prompt, steps}; SDXL/DreamShaper use
# {prompt, num_steps, width, height, guidance}. We always include everything;
# models ignore unknown fields.
REQUEST_BODY=$(jq -n \
  --arg prompt "$IMAGE_PROMPT" \
  --argjson num_steps "$NUM_STEPS" \
  --argjson steps "$NUM_STEPS" \
  --argjson width "$WIDTH" \
  --argjson height "$HEIGHT" \
  --argjson guidance "$GUIDANCE" \
  '{prompt: $prompt, num_steps: $num_steps, steps: $steps, width: $width, height: $height, guidance: $guidance}')

HEADERS_FILE=$(mktemp)
trap 'rm -f "$HEADERS_FILE"' EXIT

HTTP_CODE=$(curl -sS -D "$HEADERS_FILE" -o "$OUTPUT_FILE" -w "%{http_code}" -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_BODY")

if [[ "$HTTP_CODE" -lt 200 || "$HTTP_CODE" -ge 300 ]]; then
  echo "Error: Cloudflare API returned HTTP $HTTP_CODE" >&2
  cat "$OUTPUT_FILE" >&2
  echo >&2
  rm -f "$OUTPUT_FILE"
  exit 1
fi

CONTENT_TYPE=$(awk -F': ' 'tolower($1)=="content-type"{print tolower($2)}' "$HEADERS_FILE" | tr -d '\r' | tail -1)

if [[ "$CONTENT_TYPE" == application/json* ]]; then
  # JSON response => flux-style {result:{image:"<base64>"}}
  IMAGE_B64=$(jq -r '.result.image // empty' "$OUTPUT_FILE")
  if [[ -z "$IMAGE_B64" ]]; then
    echo "Error: No image payload in JSON response" >&2
    cat "$OUTPUT_FILE" >&2
    rm -f "$OUTPUT_FILE"
    exit 1
  fi
  base64 -d <<< "$IMAGE_B64" > "${OUTPUT_FILE}.tmp" && mv "${OUTPUT_FILE}.tmp" "$OUTPUT_FILE"
fi
# else: response body is already the raw image, saved directly.

if [[ ! -s "$OUTPUT_FILE" ]]; then
  echo "Error: Generated file is empty" >&2
  rm -f "$OUTPUT_FILE"
  exit 1
fi

echo "$RELATIVE_PATH"
