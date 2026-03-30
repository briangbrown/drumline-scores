# Architecture

High-level overview of the RMPA Score Tracker codebase. Keep this document updated when adding new modules, changing data flow, or restructuring directories.

For the full design rationale see [`docs/designs/DESIGN.md`](designs/DESIGN.md). For the phased build plan see [`docs/plans/implementation-plan.md`](plans/implementation-plan.md).

---

## Directory Structure

```
drumline-scores/
├── public/                     # Static assets served by Vite (and Cloudflare Pages)
│   ├── data/                   # Runtime JSON — import tool output
│   │   ├── years.json          # Available seasons manifest (list of years)
│   │   ├── ensembles.json      # Global ensemble registry (canonical names, aliases, locations)
│   │   └── <year>/             # Per-season data (2015–2025)
│   │       ├── season.json     # Season metadata (show list, class list, incomplete flag)
│   │       └── <show-id>.json  # Per-show scored data (all classes, all ensembles)
│   ├── manifest.json           # PWA manifest
│   └── icon-*.png              # App icons (placeholder)
│
├── data/                       # Source data — NOT served to clients
│   ├── scores/<year>/          # Raw CompetitionSuite HTML recap files (2015–2025)
│   ├── wgi_caption_eras.js     # Formula-verified WGI scoring definitions (reference)
│   └── wgi_caption_eras_2021_patch.js  # 2021 virtual season patch (reference)
│
├── src/
│   ├── types.ts                # Core type system (shared across all modules)
│   ├── scoring.ts              # WGI caption eras + scoring functions
│   ├── parser.ts               # CompetitionSuite HTML → ShowData parser
│   ├── ensemble-registry.ts    # Ensemble matching + location normalization
│   ├── import.ts               # CLI tool: HTML → JSON (writes to public/data/)
│   ├── data.ts                 # Client-side data loading (fetch + cache)
│   ├── router.ts               # Hash-based client-side router
│   ├── main.tsx                # React entry point (StrictMode)
│   ├── app.tsx                 # Root component (routing, data loading, view dispatch)
│   ├── layout.tsx              # App shell (header, selectors, view tabs)
│   ├── index.css               # Tailwind + design system custom properties
│   ├── components/             # Shared UI components
│   │   ├── pill.tsx            # Toggle button (active/inactive states)
│   │   ├── panel.tsx           # Titled card container
│   │   ├── chart-tooltip.tsx   # Custom recharts tooltip (dark theme)
│   │   └── loading.tsx         # Loading spinner + error message
│   ├── views/                  # Page-level view components
│   │   ├── progression.tsx     # Score trends across shows (line chart + summary table)
│   │   ├── standings.tsx       # Single-show rankings (cards, bar charts, caption table)
│   │   ├── recap.tsx           # Judge-level score breakdown (expandable from standings)
│   │   ├── cross-season.tsx    # Multi-year ensemble trajectory comparison
│   │   └── my-ensemble.tsx     # Personalized favorite ensemble landing page
│   └── hooks/                  # Custom React hooks
│       ├── use-route.ts        # Syncs RouteState ↔ window.location.hash
│       ├── use-season-data.ts  # Loads season + show data with loading/error states
│       ├── use-cross-season.ts # Loads final show from each season for cross-year comparison
│       └── use-favorite.ts     # Reactive localStorage-backed favorite ensemble
│
├── docs/
│   ├── ARCHITECTURE.md         # ← This file
│   ├── designs/DESIGN.md       # Full design document
│   └── plans/implementation-plan.md  # Phased build plan
│
└── dist/                       # Build output (gitignored, built by CI)
```

---

## Data Flow

```
HTML recap files (data/scores/<year>/)
        │
        ▼
   Import CLI (src/import.ts)          ← runs locally via `npx tsx`
        │
        ▼
   JSON files (public/data/<year>/)    ← committed to repo, served as static assets
        │
        ▼
   Vite dev server / Cloudflare Pages  ← serves public/ as static files
        │
        ▼
   Browser fetch (src/data.ts)         ← client-side loading with in-memory cache
        │
        ▼
   React UI (app → views)             ← renders charts and tables
```

### Key Principle: Two Data Directories

| Directory | Purpose | Served to clients? | Git-tracked? |
|---|---|---|---|
| `data/` | Source HTML files + JS reference definitions | No | Yes |
| `public/data/` | Import tool output (JSON consumed by the app) | Yes | Yes |

The import CLI reads from `data/scores/` and writes to `public/data/`. Vite serves everything in `public/` as static assets at the root path. The client fetches JSON from `/data/<year>/season.json`, etc.

---

## Module Responsibilities

### Data Layer (no React dependency)

| Module | Purpose |
|---|---|
| `types.ts` | All shared TypeScript types (Season, Show, Ensemble, scoring structures, domain buckets) |
| `scoring.ts` | WGI caption era definitions (Era 1, Era 2, 2021 virtual), scoring calculation functions, domain normalization |
| `parser.ts` | Parses CompetitionSuite HTML into `ShowData` — handles format variations across 2015–2025 |
| `ensemble-registry.ts` | Ensemble name matching (exact → alias → fuzzy), location normalization ("City, ST" format) |
| `import.ts` | CLI script — orchestrates parse → match → write JSON. Not bundled in client. |
| `data.ts` | Client-side data loading via `fetch()` with in-memory caching |
| `favorites.ts` | localStorage-backed favorite ensemble persistence |
| `router.ts` | Hash-based URL routing — `parseRoute()` / `buildRoute()` / `navigate()` |

### UI Layer (React)

| Module | Purpose |
|---|---|
| `app.tsx` | Root component — connects router, data loading, and view dispatch |
| `layout.tsx` | App shell — header, year/class/view selectors |
| `views/progression.tsx` | Line chart (recharts) + caption toggles + season summary table + penalties |
| `views/standings.tsx` | Score cards, comparison bars, caption breakdown, caption table, expandable recap |
| `views/recap.tsx` | Full judge-level score breakdown with per-caption ranks |
| `views/cross-season.tsx` | Multi-year ensemble trajectory (line chart + year-by-year table) |
| `views/my-ensemble.tsx` | Personalized landing for favorited ensemble |
| `components/` | Reusable primitives: `Pill`, `Panel`, `ChartTooltip`, `StarButton`, `Loading`/`ErrorMessage` |
| `hooks/` | `useRoute`, `useSeasonData`, `useCrossSeason`, `useFavorite` |

---

## URL Schema

Hash-based routing for static-site compatibility:

```
#/<year>/<classId>/<view>?show=<showId>&highlight=<ensembleId>
```

| Segment | Example | Default |
|---|---|---|
| `year` | `2025` | Latest available year |
| `classId` | `percussion-scholastic-a` | First class in season |
| `view` | `progression`, `standings`, or `cross-season` | `progression` |
| `show` (query) | `2025-rmpa-state-championships-march-29` | Latest show |
| `highlight` (query) | `longmont-high-school` | None |

---

## Design System

Dark theme defined as CSS custom properties in `src/index.css`:

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#080812` | Page background |
| `--color-surface` | `#0e0e1c` | Panels, cards |
| `--color-surface-alt` | `#14142a` | Inactive pills, hover states |
| `--color-accent` | `#f59e0b` | Active states, highlights, best scores |
| `--color-text-primary` | `#dddde8` | Body text |
| `--color-text-secondary` | `#8b8b9b` | Labels, secondary info |
| `--color-text-muted` | `#808096` | Tertiary text, axis labels |
| `--color-border` | `#191930` | Panel borders |
| `--color-error` | `#ef4444` | Penalties, errors |
| `--font-family-mono` | JetBrains Mono stack | All text |

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Build | Vite | 8.x |
| UI | React | 19.x |
| Language | TypeScript | 6.x (strict) |
| Styling | Tailwind CSS | v4 |
| Charts | Recharts | latest |
| Testing | Vitest | 4.x |
| HTML Parsing | Cheerio | latest (CLI only, not bundled) |
| Hosting | Cloudflare Pages | — |
| App type | PWA (Progressive Web App) | — |
