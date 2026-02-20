---
name: generate-context-story
description: Generates a context story for an existing word in the lexicon and saves it to both JSON data files. Use when the user asks to generate, create, or add a context story for a word.
argument-hint: "<word>"
allowed-tools: Bash, Read
context: fork
agent: general-purpose
---

# Generate Context Story for a Word

Generate a vivid context story for the word `$ARGUMENTS` and save it to both language files.

## Workflow

### Step 1 — Get word data

```bash
cd /Users/dkuznetsov/Work/English/encyclopedia
./lexicon.sh --lang en get "$ARGUMENTS"
```

If the word is not found, respond: **"Слово «$ARGUMENTS» не найдено в лексиконе."** and stop.

From the output, note:
- `word` — the word itself
- `partOfSpeech` — the word type(s)
- `definitions[0].text` — the primary definition

### Step 2 — Generate TWO context stories

Create a short (4-6 sentences), vivid, emotionally charged micro-story where the word appears **at least 3 times** in natural context. Each occurrence must be wrapped in `**bold**` markup.

Guidelines:
- The story must be emotionally engaging — use humor, drama, surprise, or tenderness
- The word must appear naturally, not forced — vary grammatical forms if appropriate
- DO NOT define the word in the story — show it in action, let context teach the meaning
- Keep it concise: 4-6 sentences max, aim for ~80-120 words

**Russian version:** The story is written in Russian, but the English word appears in bold within the Russian text (e.g. `Она **endeavored** сделать всё идеально...`).

**English version:** The story is written entirely in English, with the word in bold.

### Step 3 — Save to both language files

```bash
cd /Users/dkuznetsov/Work/English/encyclopedia
./lexicon.sh --lang en set-field "$ARGUMENTS" contextStory "<english story>"
./lexicon.sh --lang ru set-field "$ARGUMENTS" contextStory "<russian story>"
```

### Step 4 — Restart the dev server

```bash
cd /Users/dkuznetsov/Work/English/encyclopedia
npx pm2 delete lexicon 2>/dev/null; npx pm2 start ecosystem.config.cjs
```

### Step 5 — Report

Respond in Russian: **"Context story для «$ARGUMENTS» сгенерирован и сохранён."**

Nothing else. Keep the response short.
