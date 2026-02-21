#!/usr/bin/env bash
set -euo pipefail

# Fetch pronunciation audio URLs for a word from free public APIs.
# Outputs a JSON object with CDN URLs (no file downloads).
#
# Usage: ./fetch-audio-urls.sh "hello"
# Output: {"us":"https://...mp3","uk":"https://...mp3","au":"https://...mp3"}

WORD="${1:?Usage: fetch-audio-urls.sh <word>}"
WORD_LOWER="$(echo "$WORD" | tr '[:upper:]' '[:lower:]')"
# URL-encode the word (handles spaces in phrasal verbs like "come across")
WORD_ENCODED="$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.stdin.read().strip()))" <<< "$WORD_LOWER")"

us_url=""
uk_url=""
au_url=""

# --- Primary: Free Dictionary API ---
api_response="$(curl -s -f "https://api.dictionaryapi.dev/api/v2/entries/en/${WORD_ENCODED}" 2>/dev/null || echo "")"

if [[ -n "$api_response" ]] && echo "$api_response" | jq -e '.[0].phonetics' >/dev/null 2>&1; then
  # Extract audio URLs by accent suffix
  us_url="$(echo "$api_response" | jq -r '[.[0].phonetics[] | select(.audio != "" and (.audio | test("-us\\.mp3$"))) | .audio] | first // empty')"
  uk_url="$(echo "$api_response" | jq -r '[.[0].phonetics[] | select(.audio != "" and (.audio | test("-uk\\.mp3$"))) | .audio] | first // empty')"
  au_url="$(echo "$api_response" | jq -r '[.[0].phonetics[] | select(.audio != "" and (.audio | test("-au\\.mp3$"))) | .audio] | first // empty')"

  # If no accent-specific match, try any available audio as US fallback
  if [[ -z "$us_url" && -z "$uk_url" && -z "$au_url" ]]; then
    us_url="$(echo "$api_response" | jq -r '[.[0].phonetics[] | select(.audio != "") | .audio] | first // empty')"
  fi
fi

# --- Fallback: Wiktionary/Wikimedia Commons ---
if [[ -z "$us_url" && -z "$uk_url" && -z "$au_url" ]]; then
  # Try lowercase first (most Wiktionary entries), then capitalized
  for wiki_title in "$WORD_LOWER" "$(echo "${WORD_LOWER:0:1}" | tr '[:lower:]' '[:upper:]')${WORD_LOWER:1}"; do
    title_encoded="$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.stdin.read().strip()))" <<< "$wiki_title")"
    wiki_response="$(curl -s -f "https://en.wiktionary.org/w/api.php?action=query&titles=${title_encoded}&prop=images&format=json" 2>/dev/null || echo "")"

    if [[ -n "$wiki_response" ]]; then
      # Look for English audio: "En-us-*.ext" or "LL-Q1860 (eng)-*.ext"
      us_file="$(echo "$wiki_response" | jq -r '[.. | strings | select(test("^File:(En-us-|LL-Q1860 \\(eng\\)-).*\\.(ogg|oga|wav|mp3)$"; "i"))] | first // empty')"
      if [[ -n "$us_file" ]]; then
        # Resolve actual URL via Wikimedia Commons imageinfo API
        file_encoded="$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.stdin.read().strip()))" <<< "$us_file")"
        file_info="$(curl -s -f "https://commons.wikimedia.org/w/api.php?action=query&titles=${file_encoded}&prop=imageinfo&iiprop=url&format=json" 2>/dev/null || echo "")"
        if [[ -n "$file_info" ]]; then
          us_url="$(echo "$file_info" | jq -r '[.query.pages[].imageinfo[]?.url] | first // empty')"
        fi
        [[ -n "$us_url" ]] && break
      fi
    fi
  done
fi

# --- Build output JSON ---
result="{"
comma=""

if [[ -n "$us_url" ]]; then
  result="${result}${comma}\"us\":\"${us_url}\""
  comma=","
fi

if [[ -n "$uk_url" ]]; then
  result="${result}${comma}\"uk\":\"${uk_url}\""
  comma=","
fi

if [[ -n "$au_url" ]]; then
  result="${result}${comma}\"au\":\"${au_url}\""
  comma=","
fi

result="${result}}"

if [[ "$result" == "{}" ]]; then
  echo "No audio found for: $WORD" >&2
  exit 1
fi

echo "$result"
