#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECTS_DIR="$SCRIPT_DIR/public/data/projects"

PROJECT=""
if [[ "${1:-}" == "--project" ]]; then
  PROJECT="${2:?Error: --project requires a project id (e.g. tainted-grail)}"
  shift 2
fi

validate_project() {
  local project_id="$1"
  local DATA_DIR="$PROJECTS_DIR/$project_id"

  echo "==============================="
  echo "Validating project: $project_id"
  echo "==============================="

  local errors=0

  # Discover all language files
  lang_files=("$DATA_DIR"/words.*.json)

  if [[ ${#lang_files[@]} -lt 2 ]]; then
    echo "ERROR: Expected at least 2 language files, found ${#lang_files[@]}" >&2
    return 1
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

  neutral_fields=("word" "pronunciation" "partOfSpeech" "forms" "audio" "cefrLevel")

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
    echo "All checks passed for $project_id."
    return 0
  else
    echo "Found $errors error(s) in $project_id." >&2
    return 1
  fi
}

# Main logic
total_errors=0

if [[ -n "$PROJECT" ]]; then
  # Validate single project
  if [[ ! -d "$PROJECTS_DIR/$PROJECT" ]]; then
    echo "Error: Project '$PROJECT' not found in $PROJECTS_DIR" >&2
    exit 1
  fi
  validate_project "$PROJECT" || total_errors=$((total_errors + 1))
else
  # Validate all projects
  if [[ ! -d "$PROJECTS_DIR" ]]; then
    echo "Error: No projects directory found at $PROJECTS_DIR" >&2
    exit 1
  fi
  for project_dir in "$PROJECTS_DIR"/*/; do
    project_id=$(basename "$project_dir")
    validate_project "$project_id" || total_errors=$((total_errors + 1))
    echo ""
  done
fi

if [[ $total_errors -eq 0 ]]; then
  echo "All validations passed."
  exit 0
else
  echo "Failed: $total_errors project(s) had errors." >&2
  exit 1
fi
