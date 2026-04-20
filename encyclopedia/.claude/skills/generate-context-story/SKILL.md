---
name: generate-context-story
description: Generates a context story for an existing word in the lexicon and saves it to both language entries in the SQLite DB. Use when the user asks to generate, create, or add a context story for a word.
argument-hint: "<project-id> <word>"
allowed-tools: Bash, Read
context: fork
agent: general-purpose
---

# Generate Context Story for a Word

Generate a vivid context story for the word specified in `$ARGUMENTS` and save it to both language entries (RU + EN).

`$ARGUMENTS` format: `<project-id> <word>` (e.g. `tainted-grail abhor`).

Parse the first token as `PROJECT` and the rest as `WORD`.

Working directory: `/Users/dkuznetsov/Work/English/encyclopedia`.

## Workflow

### Step 1 — Get word data

```bash
./scripts/lexicon.sh --project $PROJECT --lang en get "$WORD"
```

If the word is not found, respond: **"Слово «$WORD» не найдено в лексиконе."** and stop.

From the output, note:
- `word` — the word itself
- `partOfSpeech` — the word type(s)
- `definitions[0].text` — the primary definition

### Step 2 — Generate TWO context stories

Short (4-6 sentences), vivid, emotionally charged micro-story where the word appears **at least 3 times** in natural context. Each occurrence wrapped in `**bold**`.

Guidelines:
- Emotionally engaging — humor, drama, surprise, tenderness
- Word appears naturally — vary grammatical forms if appropriate
- DO NOT define the word in the story — show it in action
- Keep it concise: 4-6 sentences, aim for ~80-120 words

**Russian version:** Story in Russian, English word in bold inside Russian text (e.g. `Она **endeavored** сделать всё идеально...`).

**English version:** Story entirely in English, word in bold.

### Step 3 — Save to both language entries

```bash
./scripts/lexicon.sh --project $PROJECT --lang en set-field "$WORD" contextStory "<english story>"
./scripts/lexicon.sh --project $PROJECT --lang ru set-field "$WORD" contextStory "<russian story>"
```

Note: `contextStory` is a per-language field, so it must be set separately for each lang.

### Step 4 — Restart the dev server

```bash
npx pm2 restart lexicon
```

If the process isn't running, skip silently.

### Step 5 — Report

Respond in Russian: **"Context story для «$WORD» сгенерирован и сохранён."**

Nothing else. Keep the response short.
