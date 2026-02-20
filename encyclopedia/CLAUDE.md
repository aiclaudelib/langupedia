# Lexicon of the Tainted Grail

Single-page React app — personal English vocabulary encyclopedia with bilingual support (RU/EN).

## Tech stack

- React 19 + TypeScript 5.7 (strict mode)
- Vite 6 (dev server + build)
- Playwright (e2e tests)
- PM2 (process manager)
- No router, no state management library — plain React state

## Commands

```bash
yarn dev              # Vite dev server (default port 5173)
yarn build            # tsc + vite build → dist/
yarn test             # Playwright e2e tests
yarn pm2              # Start via PM2 on port 4173 (vite dev with HMR)
yarn pm2:restart      # Restart PM2 process
yarn pm2:stop         # Stop PM2 process
```

## Project structure

```
src/
  App.tsx             # Root component — state, scroll logic, layout
  App.css             # All styles (single file)
  main.tsx            # Entry point
  components/
    Header.tsx        # Title + subtitle
    Sidebar.tsx       # Word list navigation + search
    WordCard.tsx      # Single word entry card (with per-card lang toggle)
    WordHistory.tsx   # Collapsible etymology section
    HamburgerButton.tsx
    ScrollTopButton.tsx
  types/
    word.ts           # Word, Definition, Comparison, Idiom, etc.
  utils/
    formatText.ts     # Markdown-like formatting (bold, italic)
    slugify.ts        # Word → URL-safe id
public/
  data/
    words.ru.json     # Russian definitions
    words.en.json     # English definitions
lexicon.sh            # CLI tool: add/get/list/count words (uses jq)
validate-lexicon.sh   # JSON schema validation
```

## Key conventions

- Language state is global — switching on any card changes all cards
- Language preference is persisted in `localStorage` (key: `lexicon-lang`)
- Word data is loaded via `fetch()` from `public/data/words.{lang}.json`
- Words are sorted alphabetically on load
- Sidebar tracks active word via scroll position
- All styles live in `App.css` — no CSS modules, no CSS-in-JS
- Fonts: "Source Serif 4" (body), "Inter" (UI elements) — loaded from Google Fonts

## Adding words

Use the CLI script:
```bash
./lexicon.sh add < word.json              # Add to RU (default)
./lexicon.sh --lang en add < word.json    # Add to EN
./lexicon.sh list                          # List all words
./lexicon.sh get "abhor"                   # Get single word
```

## Testing

Tests are in `tests/e2e/`. Playwright config uses `http://localhost:4173` as base URL and runs `yarn build && yarn preview` as web server.
