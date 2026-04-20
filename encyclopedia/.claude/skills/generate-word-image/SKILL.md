---
name: generate-word-image
description: Generates a mnemonic/associative image for an existing word in the lexicon and links it to the SQLite DB. Use when the user asks to generate, create, or add an image/picture/illustration for a word.
argument-hint: "<project-id> <word>"
allowed-tools: Bash, Read
context: fork
agent: general-purpose
---

# Generate Mnemonic Image for a Word

Generate an associative image for the word specified in `$ARGUMENTS` and link it in the lexicon.

`$ARGUMENTS` format: `<project-id> <word>` (e.g. `tainted-grail abhor`).

Parse the first token as `PROJECT` and the rest as `WORD`.

Working directory: `/Users/dkuznetsov/Work/English/encyclopedia`.

## Backend

The script `./scripts/generate-image.sh` calls Cloudflare Workers AI with **`@cf/black-forest-labs/flux-1-schnell`** (beta, 4-step distilled). Output is always **1024×1024 JPEG**. Credentials + model choice live in `scripts/.cloudflare.json`.

### Flux-1-Schnell parameters

| Param | Type | Default | Range | Notes |
|---|---|---|---|---|
| `prompt` | string | — | max 2048 chars | required |
| `steps` | int | 4 | 1–8 | quality ↑ with more steps |
| ~~width / height~~ | — | — | — | **not supported** — fixed 1024×1024 |
| ~~guidance~~ | — | — | — | **not supported** — Flux is distilled without CFG |

Unknown fields are silently ignored by Cloudflare, so the shell script stays model-agnostic — switching back to SDXL-Lightning is just a config change.

### Why Flux over SDXL-Lightning

- Much stronger prompt adherence — handles 5+ supporting details in one scene reliably.
- Almost never produces the "shark-fang teeth" SDXL shows on any `howling / open mouth / yelling` prompt.
- Handles hands/fingers correctly ~90% of the time.
- Holds a requested visual style (flat cartoon, noir, watercolor…) far more consistently.
- Rarely leaks paragraph-style gibberish text onto the image (still occasional short labels on signs/boxes).

### Tariff note

Flux-Schnell uses ~11 neurons per image → **~900 images/day** on the free tier (10 000 neurons/day). For bulk runs (thousands of words) switch the config back to `@cf/bytedance/stable-diffusion-xl-lightning` with `numSteps=8, guidance=0` — it's beta-free (0 neurons) and effectively unlimited, at the cost of lower fidelity.

## Prompt rules

1. **One clear focal subject** + as many supporting props as the scene demands. Flux is competent enough to render «angry toddler in a messy playroom with a tipped sippy cup, a knocked-down block tower and a teddy bear on its back» as a coherent composition — don't needlessly strip detail.

2. **Write one integrated paragraph**, not bullet points. Concrete nouns and verbs, not adjectives stacked on adjectives. Flux reads long prompts sequentially; earlier phrases dominate, later phrases refine.

3. **Lead with the archetype.** Start the prompt with the *kind of image* you want: «A cartoon illustration of…», «A cinematic painterly scene of…», «A visual pun showing…». The first phrase locks the style before the subject renders.

4. **Exaggerate the emotion / quality.** Mnemonic strength = readability at a glance. If the word is `fury`, the face must be unmistakably furious, not merely annoyed. Use extreme descriptors: `squeezed tightly shut`, `flushed deep red`, `arms thrown wide`, `eyes bulging`, `crimson`, `shimmering`.

5. **Forbidden trigger words** that still occasionally leak gibberish text even on Flux:
   `advertisements, graffiti, writing, lettering, text, letters, signs, labels, caption, words, logos, slogans, posters, newspaper headlines`.
   Never use these. Always include the anti-text clause in the style suffix.

6. **Describe decay / ugliness visually, not textually.** Use physical markers: `rusted, crumbling, peeling paint, broken, bent, collapsing, moss-covered, weather-beaten, overgrown` — never `scrawled` / `graffitied` / `labelled`.

## Default style suffix

Pick one of the two style anchors below based on word register, then always end with the anti-text clause.

### Cartoon (preferred for everyday / figurative / character-driven words)

```
Clean 2D cartoon illustration, bold uniform black outlines, flat vibrant colors, soft cel shading, rounded friendly shapes, expressive exaggerated caricature, modern western animation style. Absolutely no text, no letters, no words anywhere in the image.
```

Good match for: verbs of action, emotion adjectives, character traits, everyday nouns, idioms.

### Painterly (for literary / atmospheric / period words)

```
Beautiful painterly illustration style, vibrant saturated colors, cinematic composition, atmospheric lighting, detailed. Absolutely no text, no letters, no words anywhere in the image.
```

Good match for: words drawn from specific literary projects with established atmosphere (`great-gatsby` → 1920s; `tainted-grail` → dark Arthurian), archaic vocabulary, nature / landscape terms.

Either style suffix is safe — the choice is aesthetic, not functional.

## Workflow

### Step 1 — Get word data

```bash
./scripts/lexicon.sh --project $PROJECT --lang en get "$WORD"
```

If the word is not found, respond **"Слово «$WORD» не найдено в лексиконе."** and stop.

Note from the output:
- `partOfSpeech` — word type
- `definitions[0].text` — primary sense
- `definitions[0].context` — sense context
- `mainExamples[0]` for literary projects — atmospheric hints

### Step 2 — Choose a category and craft the prompt

Pick ONE category below. Produce a single flowing paragraph describing one focal subject with supporting context, then append the chosen style suffix.

#### A) Action verbs (run, abhor, endeavor, shatter, whisper, jut out…)
One figure performing the action in an exaggerated, over-the-top way, in an evocative setting.
- «abhor» → *A lone figure violently recoiling in extreme disgust from a foul heap on the ground, face scrunched, hands thrown up in rejection, in a dim moody alley with cold moonlight.*
- «jut out» → *A rocky stone pier dramatically jutting far out into a moonlit bay, narrow finger of land, crashing waves, Long Island Sound, dramatic perspective.*
- «whisper» → *Two figures huddled close together in a dim candlelit corridor, one leaning in with a hand cupped around the mouth, conspiratorial expressions, warm shadowy lighting.*

#### B) Emotion / state adjectives (eloquent, furious, melancholy, fractious, wistful…)
One figure visibly expressing the emotion — readable from face and posture alone.
- «melancholy» → *A lone figure sitting hunched on a park bench under slow autumn rain, hands in lap, yellow leaves scattered around, soft grey diffused light.*
- «fractiousness» → *A chubby toddler mid-tantrum standing on a wooden playroom floor, cheeks flushed deep red, eyes squeezed shut into tight curved lines, mouth wide open in a huge howl, one fist raised high, around him a tipped sippy cup, knocked-down block tower, teddy bear on its back and scattered crayons.*
- «wistful» → *A lone figure at a balcony railing gazing across dark water toward a distant lit mansion, soft longing on her face, night breeze lifting her hair.*

#### C) Concrete nouns (fortress, candle, sundial, throne, amulet…)
The object large and central with atmospheric lighting and context.
- «sundial» → *An ornate weathered bronze sundial in a manicured formal garden casting a sharp shadow across its engraved face, roses and ivy curling around its stone pedestal.*
- «amulet» → *A glowing magical amulet on a silver chain resting on an open leather-bound book, surrounded by melting candles and scattered dried herbs in a dim ancient library.*

#### D) Abstract nouns (serendipity, justice, resilience, revelation, levity…)
A metaphorical scene with one figure or symbolic object embodying the concept.
- «revelation» → *A heavy velvet curtain being pulled aside to reveal a glowing figure standing in brilliant backlight, dust motes floating, dramatic moment of unveiling.*
- «levity» → *A young flapper in a sequined headband laughing with head thrown back, champagne spilling from a coupe glass, confetti floating in the air, giddy joy.*
- «resilience» → *A lone ancient oak tree standing tall and unbroken on a windswept field after a storm, branches gnarled but strong, sunlight breaking through parting clouds.*

#### E) Qualities applied to objects (pristine, decrepit, sturdy, swank, eyesore…)
One object showing the quality at an extreme.
- «sturdy» → *A massive solid oak chair built with thick legs and heavy carved frame, planted firmly on a wooden floor, unmoved by time, warm afternoon light.*
- «swank» → *An opulent Art Deco hotel lobby with gleaming marble floors, gold chandeliers, bold geometric patterns, a lavish velvet armchair, ostentatious luxury.*
- «eyesore» → *A massive ugly rusted abandoned brick factory with a crumbling smokestack and broken boarded-up windows, standing conspicuously in a pristine lush green meadow filled with colorful wildflowers, rolling hills on the horizon.*

#### F) Adverbs / manner words (hastily, reluctantly, snobbishly, meticulously…)
A figure performing a common action in that manner, exaggerated.
- «snobbishly» → *An aristocratic woman tilting her chin up and looking down her nose through a jeweled lorgnette, disdainful expression, ornate feathered headpiece.*
- «hastily» → *A frantic figure stuffing papers into an overflowing briefcase while halfway out a door, shoes half-on, coat flying, items spilling to the floor, morning light.*

#### G) Visual puns (idioms, compound words, figurative phrases)
Combine the literal and figurative meanings in ONE anthropomorphic or object-level pun. This is the **single strongest mnemonic** format when it fits — both meanings render as one unforgettable image.
- «hard-boiled» → *A cartoon anthropomorphic hard-boiled egg in a noir detective costume, tough white eggshell body with part of the shell cracked away, dark gray fedora tilted low, tan trench coat with collar up, a cigarette dangling from the mouth, cynical squinted glare, a rainy alley with a single amber streetlamp behind.* (literal: boiled egg; figurative: tough cynical detective)
- «ragged edge» → *A frayed torn edge of a delicate lace curtain blowing in a broken open window, threads pulled loose, dusk light filtering through.* (literal + «on the brink»)
- «bite the bullet» → *A grim-faced soldier clenching a literal brass bullet between his teeth on a battlefield, knuckles white on the hilt of a rifle, smoke drifting by.*

**Prefer category G for:** phrasal verbs, idioms, compound adjectives, figurative expressions — any word whose literal meaning is concrete enough to anchor the figurative one.

### Step 3 — Generate the image

```bash
./scripts/generate-image.sh --project $PROJECT "$WORD" "<your prompt + style suffix>"
```

The script prints the relative image path on success (e.g. `/data/projects/tainted-grail/images/words/abhor.jpg`). On failure, respond in Russian with the error and stop.

### Step 4 — Link the image in the DB

Image is a language-neutral field stored once in the `words` table:

```bash
./scripts/lexicon.sh --project $PROJECT set-field "$WORD" "image" "<path from step 3>"
```

### Step 5 — Restart the dev server

```bash
npx pm2 restart lexicon
```

If the process isn't running, skip silently.

### Step 6 — Report

Respond in Russian: **"Картинка для $WORD сгенерирована и привязана."**

Nothing else. Keep the response short.
