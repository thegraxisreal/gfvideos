# CLAUDE.md — FGVideos

This file provides guidance for AI assistants working in this repository.

## Project Overview

**FGVideos** is a video streaming search and discovery single-page application (SPA). It lets users search YouTube, watch embedded videos, and chat with an integrated AI assistant called **Graxybot**.

- **Frontend:** Vanilla JavaScript, HTML5, CSS3 — all in a single `index.html` file (no framework, no build step)
- **Backend:** Two Vercel Serverless Functions in `/api/` (Node.js ESM)
- **External APIs:** YouTube Data API v3, OpenAI API (`/v1/responses` endpoint)
- **Deployment:** Vercel (auto-deploys on git push)
- **Storage:** Browser `localStorage` only — no database

---

## Repository Structure

```
gfvideos/
├── index.html          # Entire frontend: HTML, CSS (~900 lines), JS (~800 lines)
├── api/
│   ├── youtube.js      # Serverless proxy → YouTube Data API v3
│   └── openai.js       # Serverless proxy → OpenAI /v1/responses
├── vercel.json         # Vercel config: rewrites /api/* to serverless handlers
└── .gitignore          # Ignores .env files, .vercel/, node_modules/
```

There is no `package.json`, no bundler, no test suite, and no CI/CD pipeline beyond Vercel's automatic git integration.

---

## Architecture

### API Security Model

API keys are **never exposed to the client**. The frontend calls its own Vercel serverless proxies at `/api/youtube` and `/api/openai`. The proxy functions inject the real keys from Vercel environment variables:

| Env Var | Used By | Set In |
|---|---|---|
| `YT_API_KEY` | `api/youtube.js` | Vercel dashboard |
| `OPENAI_KEY` | `api/openai.js` | Vercel dashboard |

The client-side constants `API_KEY` and `OPENAI_KEY` are set to the string `'proxy'` as a truthy placeholder — they carry no real credentials.

### Serverless Functions

**`api/youtube.js`** — GET only
- Accepts all query params forwarded from the client
- Reads `?endpoint=` to select the YouTube API resource (e.g. `search`, `videos`)
- Injects `key=YT_API_KEY` and forwards to `https://www.googleapis.com/youtube/v3/{endpoint}`
- Returns the raw YouTube JSON response

**`api/openai.js`** — POST only
- Forwards the entire request body to `https://api.openai.com/v1/responses`
- Injects `Authorization: Bearer OPENAI_KEY` header
- Returns the raw OpenAI JSON response

### Frontend (`index.html`)

The JavaScript is organized into clearly commented sections:

| Section (line approx.) | Responsibility |
|---|---|
| `CONFIG & STATE` (~936) | Proxy URLs, global state vars, system prompts, suggestion topics |
| `OPENAI API CALLS` (~1014) | `openAIChat()` — builds prompt, calls proxy, parses response |
| `YOUTUBE API CALLS` (~1052) | `ytFetch()`, `searchVideos()`, `getTrending()`, `getVideoDetails()`, `getRelatedVideos()` |
| `DATA NORMALIZATION` (~1120) | `normaliseSearchItem()`, `normaliseVideoItem()` — unified video object shape |
| `UI RENDERING` (~1197) | Grid rendering, skeleton loading, search suggestions |
| `VIDEO PLAYER` (~1449) | Modal player with YouTube iframe embed + related videos panel |
| `GRAXYBOT` (~1524) | AI chat sidebar: send/receive, search trigger, video summarization |
| `HISTORY MANAGEMENT` (~1713) | Watch history (50 max) and search history (20 max) via localStorage |
| `THEME & ACCESSIBILITY` (~1729) | Dark/light toggle, keyboard shortcuts |

#### Normalised Video Object Shape

Both search results and direct video lookups are normalised to this shape before use anywhere in the UI:

```js
{
  id: string,          // YouTube video ID
  title: string,
  channel: string,
  thumbnail: string,   // URL
  duration: string,    // e.g. "12:34" or "LIVE"
  views: string,       // formatted, e.g. "1.2M views" (may be "" for search results)
  published: string,   // relative, e.g. "3 days ago" (may be "" for video items)
}
```

---

## Key Conventions

### CSS Custom Properties (Theming)

All colours are CSS variables on `:root` (dark mode defaults) with overrides on `body.light`. When adding UI elements, always use these variables — never hardcode colours:

| Variable | Purpose |
|---|---|
| `--bg`, `--bg2`, `--bg3`, `--bg4` | Background layers (dark to slightly lighter) |
| `--line` | Border/divider colour |
| `--t1`, `--t2`, `--t3` | Text — primary, secondary, muted |
| `--red` | Brand accent (logo, highlights) |
| `--red-dim` | Semi-transparent red for hover states |
| `--warning` | Warning/caution colour |

### Graxybot Prompt Rules

Graxybot always responds with **strict JSON only**:

```json
{
  "reply": "lowercase message to the user",
  "wants_search": false,
  "search_query": ""
}
```

- `reply` must be entirely lowercase, casual, no markdown
- If `wants_search` is `true`, `search_query` must be a clean 2–4 word YouTube search term
- If `wants_search` is `false`, `search_query` must be `""`

Do not alter the system prompts (`GRAXY_SYSTEM_PROMPT`, `GRAXY_VIDEO_SYSTEM_PROMPT`) without understanding these constraints — the client JSON-parses every response and will silently fail if the format changes.

### OpenAI Integration

The app uses the **Responses API** (`/v1/responses`), not the Chat Completions API. The model is `gpt-5-mini`. The client sends a single `input` string (not a messages array) and reads the reply from:

```js
data.output?.find(o => o.type === 'message')?.content?.[0]?.text
```

### YouTube Quota Awareness

Every `ytFetch()` call consumes YouTube Data API quota. The expensive calls are:
- `search` — 100 units per call (called on user search and Graxybot search triggers)
- `videos` — 1 unit per call (used for trending, video details, related videos)

Avoid adding new `search` endpoint calls without considering quota impact.

### localStorage Keys

| Key | Contents | Max |
|---|---|---|
| `watchHistory` | Array of normalised video objects | 50 items |
| `searchHistory` | Array of query strings | 20 items |

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + K` | Focus search input |
| `Ctrl/Cmd + G` | Toggle Graxybot panel |
| `Escape` | Close open modals |

---

## Development Workflow

### Local Development

There is no build step. Edit `index.html` directly and refresh the browser.

For local development with real API keys you need the Vercel CLI:

```bash
# Install once
npm i -g vercel

# Pull env vars from Vercel project (requires login)
vercel env pull .env.local

# Run locally (serves index.html + serverless functions)
vercel dev
```

Without `vercel dev`, the `/api/*` proxies won't work and all API calls will fail.

### Environment Variables

Never commit `.env`, `.env.local`, or any file containing real keys. The `.gitignore` already covers common patterns. Keys are managed exclusively through the Vercel dashboard under **Project Settings → Environment Variables**.

### Deployment

Vercel auto-deploys every push to the linked git remote. No manual deploy step is needed. The `vercel.json` rewrite rule is the only Vercel-specific config required — everything else is inferred.

### Making Changes

Because the entire frontend is one file, be careful about:
- **Section ordering** — JavaScript relies on functions and globals being defined before use; maintain the existing top-to-bottom declaration order
- **CSS specificity** — styles are global; scope new selectors carefully to avoid unintended overrides
- **No build pipeline** — there is no tree-shaking, minification, or dead-code elimination; keep additions lean

---

## No Tests

This project has no automated tests. Verify changes manually in the browser. Key flows to check after any significant change:

1. Search returns and renders video grid
2. Video player modal opens, plays, and closes
3. Related videos load in the player sidebar
4. Graxybot panel opens, sends a message, receives a reply
5. Graxybot search trigger (`wants_search: true`) fires a new video search
6. Dark/light theme toggle works
7. Watch history persists across page refreshes

---

## Out of Scope

Do not add unless explicitly requested:
- A JavaScript framework (React, Vue, Svelte, etc.)
- A bundler or build tool (Vite, Webpack, etc.)
- A test framework
- A database or server-side session management
- User authentication
