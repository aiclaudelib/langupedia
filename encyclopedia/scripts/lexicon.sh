#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."

PROJECT=""
LANG_CODE="ru"

# Parse --project before --lang
if [[ "${1:-}" == "--project" ]]; then
  PROJECT="${2:?Error: --project requires a project id (e.g. tainted-grail)}"
  shift 2
fi

if [[ "${1:-}" == "--lang" ]]; then
  LANG_CODE="${2:?Error: --lang requires a language code (e.g. ru, en)}"
  shift 2
fi

if [[ -z "$PROJECT" ]]; then
  echo "Error: --project <id> is required (e.g. --project tainted-grail)" >&2
  exit 1
fi

DATA_FILE="$PROJECT_ROOT/public/data/projects/${PROJECT}/words.${LANG_CODE}.json"

usage() {
  cat <<'EOF'
Usage: lexicon.sh --project <id> [--lang <code>] <command> [args]

Options:
  --project <id>  Project to operate on (required)
  --lang <code>   Language file to use (default: ru)
                  Reads public/data/projects/<id>/words.<code>.json

Commands:
  last [N]      Show last N entries (default: 2)
  add           Read JSON object from stdin, append & re-sort
  count         Print total word count
  get <word>    Print a single word entry (case-insensitive)
  list          Print all word names, one per line
  set-field <word> <field> <value>
                Set a top-level field on an existing word entry
EOF
  exit 1
}

require_data() {
  if [[ ! -f "$DATA_FILE" ]]; then
    echo "Error: $DATA_FILE not found" >&2
    exit 1
  fi
}

cmd_last() {
  require_data
  local n="${1:-2}"
  jq ".[-${n}:]" "$DATA_FILE"
}

cmd_add() {
  require_data
  local input
  input="$(cat)"

  if [[ -z "$input" ]]; then
    echo "Error: no JSON provided on stdin" >&2
    exit 1
  fi

  # Validate it's valid JSON with a "word" field
  if ! echo "$input" | jq -e '.word' >/dev/null 2>&1; then
    echo "Error: input must be a JSON object with a \"word\" field" >&2
    exit 1
  fi

  # Validate that 'forms' is a string or null (never an object/array)
  if echo "$input" | jq -e '.forms and (.forms | type != "string")' 2>/dev/null | grep -q true; then
    echo "Error: 'forms' must be a string or null, got $(echo "$input" | jq -r '.forms | type')" >&2
    exit 1
  fi

  local today
  today="$(date +%Y-%m-%d)"

  # Auto-fill missing meta fields
  local entry
  entry="$(echo "$input" | jq --arg today "$today" '
    .meta = (.meta // {}) |
    .meta.timesAccessed = (.meta.timesAccessed // 0) |
    .meta.lastReviewed = (.meta.lastReviewed // null) |
    .meta.srsLevel = (.meta.srsLevel // 0) |
    .meta.dateAdded = (.meta.dateAdded // $today)
  ')"

  local tmp
  tmp="$(mktemp "${DATA_FILE}.XXXXXX")"

  if jq --argjson new "$entry" '. + [$new] | sort_by(.word | ascii_downcase)' "$DATA_FILE" > "$tmp"; then
    mv "$tmp" "$DATA_FILE"
    local word
    word="$(echo "$entry" | jq -r '.word')"
    echo "Added \"$word\" ($(cmd_count) words total)"
  else
    rm -f "$tmp"
    echo "Error: failed to update $DATA_FILE" >&2
    exit 1
  fi
}

cmd_count() {
  require_data
  jq 'length' "$DATA_FILE"
}

cmd_get() {
  require_data
  local word="$1"
  local result
  result="$(jq --arg w "$word" '[.[] | select(.word | ascii_downcase == ($w | ascii_downcase))] | first // empty' "$DATA_FILE")"

  if [[ -z "$result" ]]; then
    echo "Word not found: $word" >&2
    exit 1
  fi
  echo "$result"
}

cmd_list() {
  require_data
  jq -r '.[].word' "$DATA_FILE"
}

cmd_set_field() {
  require_data
  local word="$1"
  local field="$2"
  local value="$3"

  # Check word exists
  local idx
  idx="$(jq --arg w "$word" 'to_entries | map(select(.value.word | ascii_downcase == ($w | ascii_downcase))) | first | .key // empty' "$DATA_FILE")"

  if [[ -z "$idx" ]]; then
    echo "Word not found: $word" >&2
    exit 1
  fi

  local tmp
  tmp="$(mktemp "${DATA_FILE}.XXXXXX")"

  local jq_flag="--arg"
  if echo "$value" | jq -e '.' >/dev/null 2>&1; then
    jq_flag="--argjson"
  fi

  if jq --argjson i "$idx" --arg f "$field" $jq_flag v "$value" '.[$i][$f] = $v' "$DATA_FILE" > "$tmp"; then
    mv "$tmp" "$DATA_FILE"
    echo "Set \"$field\" on \"$word\""
  else
    rm -f "$tmp"
    echo "Error: failed to update $DATA_FILE" >&2
    exit 1
  fi
}

[[ $# -lt 1 ]] && usage

case "$1" in
  last)  cmd_last "${2:-2}" ;;
  add)   cmd_add ;;
  count) cmd_count ;;
  get)   [[ $# -lt 2 ]] && { echo "Error: get requires a word argument" >&2; exit 1; }; cmd_get "$2" ;;
  list)  cmd_list ;;
  set-field) [[ $# -lt 4 ]] && { echo "Error: set-field requires <word> <field> <value>" >&2; exit 1; }; cmd_set_field "$2" "$3" "$4" ;;
  *)     usage ;;
esac
