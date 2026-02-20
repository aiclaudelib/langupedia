#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/.gemini.json"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Error: Config file not found: $CONFIG_FILE" >&2
  exit 1
fi

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <word> \"<definition>\"" >&2
  exit 1
fi

WORD="$1"
DEFINITION="$2"

API_KEY=$(jq -r '.apiKey' "$CONFIG_FILE")
MODEL=$(jq -r '.model' "$CONFIG_FILE")

if [[ -z "$API_KEY" || "$API_KEY" == "null" ]]; then
  echo "Error: apiKey not found in $CONFIG_FILE" >&2
  exit 1
fi

PROMPT="Generate a vivid, memorable mnemonic illustration for learning the English word \"${WORD}\".
The word means: ${DEFINITION}.
Create a surreal, exaggerated, colorful scene that creates a strong visual association with this meaning.
Style: clean illustration, bright saturated colors, single clear scene, no text or letters in the image."

ENDPOINT="https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent"

BODY=$(jq -n --arg prompt "$PROMPT" '{
  contents: [{parts: [{text: $prompt}]}],
  generationConfig: {responseModalities: ["IMAGE"]}
}')

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: $API_KEY" \
  -d "$BODY")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" -lt 200 || "$HTTP_CODE" -ge 300 ]]; then
  echo "Error: API returned HTTP $HTTP_CODE" >&2
  echo "$RESPONSE_BODY" | jq -r '.error.message // .' >&2
  exit 1
fi

IMAGE_DATA=$(echo "$RESPONSE_BODY" | jq -r '
  .candidates[0].content.parts[]
  | select(.inlineData.mimeType != null)
  | select(.inlineData.mimeType | startswith("image/"))
  | .inlineData.data
' 2>/dev/null)

if [[ -z "$IMAGE_DATA" ]]; then
  echo "Error: No image data found in API response" >&2
  echo "$RESPONSE_BODY" | jq '.' >&2
  exit 1
fi

OUTPUT_DIR="$SCRIPT_DIR/public/images/words"
mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="$OUTPUT_DIR/${WORD}.png"

echo "$IMAGE_DATA" | base64 -D > "$OUTPUT_FILE"

if [[ ! -s "$OUTPUT_FILE" ]]; then
  echo "Error: Generated file is empty" >&2
  rm -f "$OUTPUT_FILE"
  exit 1
fi

echo "images/words/${WORD}.png"
