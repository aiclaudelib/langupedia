#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/public/data"

errors=0

# Discover all language files
lang_files=("$DATA_DIR"/words.*.json)

if [[ ${#lang_files[@]} -lt 2 ]]; then
  echo "ERROR: Expected at least 2 language files, found ${#lang_files[@]}" >&2
  exit 1
fi

echo "Found ${#lang_files[@]} language files:"
for f in "${lang_files[@]}"; do
  lang=$(basename "$f" | sed 's/words\.\(.*\)\.json/\1/')
  count=$(jq 'length' "$f")
  echo "  $lang: $count words ($(basename "$f"))"
done
echo ""

# Extract language codes
langs=()
for f in "${lang_files[@]}"; do
  lang=$(basename "$f" | sed 's/words\.\(.*\)\.json/\1/')
  langs+=("$lang")
done

# --- Check 1: Word parity ---
echo "=== Word Parity ==="
ref_lang="${langs[0]}"
ref_file="$DATA_DIR/words.${ref_lang}.json"
ref_words=$(jq -r '.[].word' "$ref_file" | sort)

for lang in "${langs[@]:1}"; do
  file="$DATA_DIR/words.${lang}.json"
  lang_words=$(jq -r '.[].word' "$file" | sort)

  missing_in_lang=$(comm -23 <(echo "$ref_words") <(echo "$lang_words"))
  extra_in_lang=$(comm -13 <(echo "$ref_words") <(echo "$lang_words"))

  if [[ -n "$missing_in_lang" ]]; then
    echo "ERROR: Words in $ref_lang but missing in $lang:"
    echo "$missing_in_lang" | sed 's/^/  - /'
    errors=$((errors + 1))
  fi

  if [[ -n "$extra_in_lang" ]]; then
    echo "ERROR: Words in $lang but missing in $ref_lang:"
    echo "$extra_in_lang" | sed 's/^/  - /'
    errors=$((errors + 1))
  fi

  if [[ -z "$missing_in_lang" && -z "$extra_in_lang" ]]; then
    echo "OK: $ref_lang and $lang have the same $(echo "$ref_words" | wc -l | tr -d ' ') words"
  fi
done
echo ""

# --- Check 2: Neutral field consistency ---
echo "=== Neutral Field Consistency ==="

neutral_fields=("word" "pronunciation" "partOfSpeech" "forms")

for lang in "${langs[@]:1}"; do
  file="$DATA_DIR/words.${lang}.json"

  for field in "${neutral_fields[@]}"; do
    ref_vals=$(jq -r --arg f "$field" '[.[] | {word: .word, val: (.[$f] | tostring)}] | sort_by(.word) | .[] | "\(.word)|\(.val)"' "$ref_file")
    lang_vals=$(jq -r --arg f "$field" '[.[] | {word: .word, val: (.[$f] | tostring)}] | sort_by(.word) | .[] | "\(.word)|\(.val)"' "$file")

    diff_output=$(diff <(echo "$ref_vals") <(echo "$lang_vals") || true)

    if [[ -n "$diff_output" ]]; then
      echo "ERROR: Field '$field' differs between $ref_lang and $lang:"
      echo "$diff_output" | head -20
      errors=$((errors + 1))
    fi
  done

  if [[ $errors -eq 0 ]]; then
    echo "OK: Neutral fields match between $ref_lang and $lang"
  fi
done
echo ""

# --- Summary ---
if [[ $errors -eq 0 ]]; then
  echo "All checks passed."
  exit 0
else
  echo "Found $errors error(s)." >&2
  exit 1
fi
