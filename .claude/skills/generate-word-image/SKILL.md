---
name: generate-word-image
description: Generates a mnemonic/associative image for an existing word in the lexicon and links it to both JSON data files. Use when the user asks to generate, create, or add an image/picture/illustration for a word.
argument-hint: "<word>"
allowed-tools: Bash, Read
context: fork
agent: general-purpose
---

# Generate Mnemonic Image for a Word

Generate an associative image for the word `$ARGUMENTS` and link it to the lexicon JSON files.

## Workflow

### Step 1 — Get word data

```bash
cd /Users/dkuznetsov/Work/English/encyclopedia
./lexicon.sh --lang en get "$ARGUMENTS"
```

If the word is not found, respond: **"Слово «$ARGUMENTS» не найдено в лексиконе."** and stop.

From the output, note:
- `partOfSpeech` — the word type(s)
- `definitions[0].text` — the primary definition
- `definitions[0].context` — the sense context

### Step 2 — Craft the image prompt

Based on the word type and meaning, choose the appropriate visual approach and compose the image prompt in English. The prompt MUST always end with: `Style: bold outlines, flat bright colors, comic book cartoon, simple clean background. Close-up composition. IMPORTANT: absolutely no text, no letters, no words anywhere in the image.`

Use the decision tree below:

#### A) Action verbs (run, abhor, endeavor, shatter, whisper...)
Show a **cartoon person DOING the action** in an exaggerated, over-the-top way. The body language and the scene must make the action unmistakable.
- "abhor" → a person recoiling in extreme disgust, face scrunched up, hands pushing away from something gross
- "endeavor" → a person straining every muscle pushing a huge boulder uphill, sweat flying, face full of determination
- "whisper" → a person leaning in close with hand cupped around mouth, exaggerated secretive expression

#### B) Emotion / state adjectives (eloquent, furious, melancholy, bewildered...)
Show a **cartoon person FEELING or BEING that state**. The emotion must be readable from the face and posture alone, no context needed.
- "eloquent" → a confident person on a podium, mouth open mid-speech, audience of tiny figures mesmerized with hearts/stars in their eyes
- "furious" → a red-faced person with steam coming out of ears, clenched fists, vein popping on forehead
- "melancholy" → a person sitting alone on a bench in the rain, hunched over, single tear

#### C) Concrete nouns (fortress, candle, throne, amulet...)
Show the **object itself** large and central, with a distinctive visual detail that makes it memorable. Add a small cartoon person interacting with it for scale.
- "fortress" → a massive stone fortress with tiny person standing at its gates, looking up in awe
- "amulet" → a glowing magical amulet hanging from a chain, with a person clutching it protectively

#### D) Abstract nouns (serendipity, justice, resilience, fate...)
Show a **cartoon person in a metaphorical scene** that embodies the concept. Use a visual metaphor that makes the abstract idea concrete.
- "serendipity" → a person tripping and accidentally falling into a pot of gold, happy surprised face
- "resilience" → a person getting knocked down by a giant boxing glove but already springing back up with a grin
- "fate" → a person standing at a crossroads with giant invisible hands gently pushing them toward one path

#### E) Descriptive adjectives for things (pristine, decrepit, luminous, colossal...)
Show the **quality applied to a familiar object**, exaggerated to an extreme degree. Include a small cartoon person reacting to emphasize the quality.
- "pristine" → an impossibly sparkling clean room, person in awe with jaw dropped, everything gleaming
- "colossal" → a tiny person next to an absurdly enormous everyday object (like a shoe the size of a building)

#### F) Adverbs / manner words (hastily, reluctantly, meticulously...)
Show a **cartoon person performing a common action IN THAT MANNER**, exaggerated so the manner is obvious.
- "hastily" → a person frantically stuffing papers into a briefcase while running, items flying everywhere
- "reluctantly" → a person being dragged forward by an invisible force, feet digging in, face saying "I don't want to"

### Step 3 — Generate the image

Pass the complete prompt to the script:

```bash
cd /Users/dkuznetsov/Work/English/encyclopedia
./generate-image-pollinations.sh "$ARGUMENTS" "<your crafted prompt>"
```

The script prints the relative image path on success (e.g. `images/words/abhor.jpg`).

If it fails, respond in Russian with the error and stop.

### Step 4 — Link the image to both JSON files

```bash
cd /Users/dkuznetsov/Work/English/encyclopedia
./lexicon.sh --lang en set-field "$ARGUMENTS" "image" "<path from step 3>"
./lexicon.sh --lang ru set-field "$ARGUMENTS" "image" "<path from step 3>"
```

### Step 5 — Restart the dev server

```bash
cd /Users/dkuznetsov/Work/English/encyclopedia
npx pm2 delete lexicon 2>/dev/null; npx pm2 start ecosystem.config.cjs
```

### Step 6 — Report

Respond in Russian: **"Картинка для $ARGUMENTS сгенерирована и привязана."**

Nothing else. Keep the response short.
