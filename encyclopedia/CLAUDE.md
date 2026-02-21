# Lexicon

Multi-project React app — personal English vocabulary encyclopedia with bilingual support (RU/EN).

## Tech stack

- React 19 + TypeScript 5.7 (strict mode)
- Vite 6 (dev server + build + API middleware)
- TanStack Router (code-based routing, 3 routes)
- TanStack Query (data fetching)
- Playwright (e2e tests)
- PM2 (process manager)

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
  main.tsx            # Entry point (QueryClient + RouterProvider)
  router.tsx          # TanStack Router config (3 routes)
  App.css             # All styles (single file)
  pages/
    Dashboard.tsx     # Project list + create new project
    LexiconView.tsx   # Word cards view (moved from App.tsx)
    NotFound.tsx      # 404 page
  components/
    Header.tsx        # Title + subtitle + back link
    Sidebar.tsx       # Word list navigation + search
    WordCard.tsx      # Single word entry card
    WordHistory.tsx   # Collapsible etymology section
    ContextStory.tsx  # Collapsible context story section
    ProjectCard.tsx   # Dashboard project card
    ProjectFormModal.tsx   # Create / edit project form
    HamburgerButton.tsx
    ScrollTopButton.tsx
  types/
    word.ts           # Word, Definition, Comparison, Idiom, etc.
    project.ts        # Project interface
  lib/
    queryKeys.ts      # TanStack Query key factories
  server/
    api.ts            # API request handler (Node.js)
    vite-plugin.ts    # Vite plugin mounting API middleware
  utils/
    formatText.ts     # Markdown-like formatting (bold, italic)
    slugify.ts        # Word → URL-safe id
public/
  data/
    projects/
      <project-id>/
        project.json      # { name, title, subtitle, createdAt }
        words.ru.json     # Russian definitions
        words.en.json     # English definitions
        images/words/     # Mnemonic images
```

## Routes

| Path | Page |
|------|------|
| `/` | Dashboard — project list |
| `/projects/$projectId` | LexiconView — word cards |
| catch-all | NotFound (404) |

## API endpoints (Vite middleware)

| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create new project |
| GET | `/api/projects/:id` | Get project metadata |
| PUT | `/api/projects/:id` | Update project metadata |
| DELETE | `/api/projects/:id` | Delete project |
| GET | `/api/projects/:id/words?lang=xx` | Get words for project |

## Key conventions

- Language state is global per project — switching on any card changes all cards
- Language preference is persisted in `localStorage` (key: `lexicon-lang-{projectId}`)
- Word data is fetched via API: `/api/projects/{id}/words?lang={lang}`
- Words are sorted alphabetically on load
- Sidebar tracks active word via scroll position
- All styles live in `App.css` — no CSS modules, no CSS-in-JS
- Fonts: "Source Serif 4" (body), "Inter" (UI elements) — loaded from Google Fonts

## Adding words

Use the CLI script with `--project` flag:
```bash
./lexicon.sh --project tainted-grail add < word.json              # Add to RU (default)
./lexicon.sh --project tainted-grail --lang en add < word.json    # Add to EN
./lexicon.sh --project tainted-grail list                          # List all words
./lexicon.sh --project tainted-grail get "abhor"                   # Get single word
```

## Validation

```bash
./validate-lexicon.sh --project tainted-grail    # Validate single project
./validate-lexicon.sh                             # Validate all projects
```

## Image generation

```bash
./generate-image-pollinations.sh --project tainted-grail "<word>" "<prompt>"
```

## Pronunciation audio

Words can have an `audio` field storing external CDN URLs for pronunciation playback:

```typescript
audio?: { us?: string; uk?: string; au?: string }
```

Audio URLs are fetched via `fetch-audio-urls.sh` (no local file downloads):
```bash
./fetch-audio-urls.sh "hello"      # Prints JSON: {"us":"https://...","uk":"https://..."}
```

The script queries Free Dictionary API (primary) and Wiktionary/Wikimedia Commons (fallback). URLs point to external CDNs (CloudFront, Wikimedia) — no `resolveAssetPath()` needed.

The `audio` field is language-neutral (identical in `words.ru.json` and `words.en.json`), same as `image`.

## Testing

Tests are in `tests/e2e/`. Playwright config uses `http://localhost:4173` as base URL and runs `yarn build && yarn preview` as web server. Tests cover both the dashboard and lexicon views.
