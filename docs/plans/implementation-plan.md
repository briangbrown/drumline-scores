# RMPA Score Tracker — Implementation Plan

Phased implementation plan derived from [`docs/designs/DESIGN.md`](../designs/DESIGN.md).

For the current system overview see [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md). **Update ARCHITECTURE.md whenever a phase changes module structure, data flow, or directory layout.**

Each phase is independently deployable and delivers user value. Phases build on each other but are scoped to avoid large, risky PRs.

---

## Phase 1: Data Foundation

**Goal:** Build the TypeScript data model, scoring functions, and HTML parser so we have real data flowing through the system. No UI yet — this is the engine.

### 1.1 TypeScript Data Types

Define the core type system for the entire app.

**Files:** `src/types.ts`

- `Season`, `Show`, `ClassDef`, `Ensemble` types
- `EnsembleScore` — per-ensemble-per-show score with judge-level detail
- `Caption`, `JudgeScore`, `SubCaptionScore` types for both marching and concert
- `ShowData` — full show result (metadata + scores by class)
- `SeasonMetadata` — show list, class list, year, incomplete flag
- `EnsembleRegistry` — canonical names, aliases, locations
- `Domain` union type for cross-era comparison buckets
- All types use `type` (not `interface`), `Array<T>` syntax, `as const` where appropriate

### 1.2 Scoring Functions

Port the WGI caption era definitions from JS to TypeScript and add calculation functions.

**Files:** `src/scoring.ts`, `src/scoring.test.ts`

- Convert `data/wgi_caption_eras.js` and the 2021 patch to typed TS modules
- `calcCaptionScore()` — score a judge's caption from raw sub-caption values
- `avgJudgeScores()` — average double panel scores
- `getMarchingEra()` — year-based era lookup (including 2021 virtual)
- `findCaption()` — alias-aware caption lookup
- `normalizeToPct()` — normalize caption score to 0–100
- `scoresByDomain()` — build domain-bucketed scores for cross-era comparison
- 2021 scoring functions (`calc2021JudgeScore`, `calc2021MarchingTotal`, `calc2021StandstillTotal`)
- Tests using the verified test vectors from `wgi_caption_eras.js`

### 1.3 HTML Parser

Parse CompetitionSuite HTML recap files into structured `ShowData` JSON.

**Files:** `src/parser.ts`, `src/parser.test.ts`

- Install `cheerio` (or similar) for server-side HTML parsing (used in CLI import tool, not bundled in client)
- `parseRecapHtml(html: string, year: number): ShowData` — main entry point
- Extract show metadata (event name, venue, date, round, head judge)
- Parse class sections — identify division headers (handle both `header-division-name` class and inline style fallback)
- Parse score rows — extract ensemble name, location, all judge scores, caption totals, penalty, rank
- Handle `data-translate-number` (2019+) with text content fallback (2015–2018)
- Filter out non-percussion classes (skip "Winds" divisions)
- Handle 2021 virtual format (sum-not-average, IMP/AN/VAN subcaptions)
- Handle empty `data-translate-number=""` (treat as 0)
- Tests against actual HTML files in `data/scores/` — parse each and validate key values

### 1.4 Ensemble Registry & Location Normalization

**Files:** `src/ensemble-registry.ts`, `src/ensemble-registry.test.ts`

- `matchEnsemble(name: string, location: string): MatchResult` — exact match → alias match → fuzzy match → unknown
- Fuzzy matching: strip common suffixes ("High School", "HS", "Winter Percussion", "Indoor Percussion", "Percussion Ensemble"), compare core name
- Location-based confidence boost
- `normalizeLocation(raw: string): string` — normalize to "City, ST" format
  - State full name → abbreviation
  - Strip addresses, fix whitespace/case, add missing commas
  - School name → city lookup
- Registry stored as `public/data/ensembles.json` (served as static asset)
- Tests covering all known name variations from the design doc

### 1.5 Import CLI Tool

**Files:** `src/import.ts` (Node CLI script, not bundled in client)

- CLI command: `npx tsx src/import.ts <html-file> [--year 2025] [--output public/data/2025/]`
- Reads HTML from `data/scores/<year>/` → runs parser → matches ensembles → writes per-show JSON to `public/data/<year>/`
- Generates `season.json` if it doesn't exist, or updates show list
- Updates `public/data/ensembles.json` with any new ensembles
- Flags unrecognized ensemble names for manual review (console output)
- Dry-run mode for verification

### 1.6 Import 2025 Season Data

Use the import tool to process all 2025 HTML files and generate the initial dataset.

- Process all 8 shows (S1–S6, Prelims, Finals)
- Build initial `public/data/ensembles.json` registry
- Generate `public/data/2025/season.json` and per-show JSON files
- Validate parsed data against the prototype's embedded `RAW` object

**Phase 1 deliverable:** Complete data pipeline from HTML → typed JSON. All scoring math tested. Ready for UI.

---

## Phase 2: Core UI — Standings & Progression

**Goal:** Rebuild the prototype's two main views (Standings, Progression) as a proper React app with Tailwind, URL routing, and real data loading.

### 2.1 Data Loading Layer

**Files:** `src/data.ts`

- `loadSeasonMetadata(year: number): Promise<SeasonMetadata>` — fetch `/data/<year>/season.json` (from `public/data/`)
- `loadShowData(year: number, showId: string): Promise<ShowData>` — fetch per-show JSON
- `loadAllShowsForSeason(year: number): Promise<Array<ShowData>>` — parallel fetch all shows (for progression view)
- `loadEnsembleRegistry(): Promise<EnsembleRegistry>` — fetch `/data/ensembles.json`
- Simple fetch-based, with in-memory caching
- **Note:** Runtime JSON lives in `public/data/` so Vite serves it as static assets. Source HTML stays in `data/scores/`.

### 2.2 URL Router

**Files:** `src/router.ts`, `src/router.test.ts`

- Client-side hash router (no React Router dependency needed for a static site)
- URL shape: `#/<year>/<classId>/<view>?show=<showId>&highlight=<ensemble>`
- `parseRoute(hash: string): RouteState`
- `buildRoute(state: RouteState): string`
- Default route: latest season, first available class, progression view
- Tests for round-trip encoding/decoding

### 2.3 App Shell & Layout

**Files:** `src/app.tsx`, `src/layout.tsx`

- Dark theme matching prototype (`bg-[#080812]`, monospace font stack)
- Responsive app shell: header with season/title, class selector, view tabs
- Mobile-first layout with `max-w-[920px]` container
- Season year selector (dropdown or pills)
- Class selector pills (scrollable on mobile)
- View tabs: Progression | Standings
- Loading states and error boundaries

### 2.4 Progression View

**Files:** `src/views/progression.tsx`

- Install `recharts` for charting
- Line chart: score trends across shows per ensemble
- Caption toggle pills (Total, Eff Music, Eff Visual, Music, Visual — or Effect, Music for concert)
- Color-coded legend with ensemble short names
- Season Summary table (shows, first, last, growth, high)
- Timing penalties panel
- Custom tooltip matching prototype style
- Responsive: chart height adjusts on mobile

### 2.5 Standings View

**Files:** `src/views/standings.tsx`

- Show selector pills (scrollable)
- Score cards grid (responsive: 2 cols mobile, 3+ desktop)
- Score comparison horizontal bar chart
- Caption breakdown stacked bar chart
- Caption scores table with best-in-caption highlighting
- Penalty indicators

### 2.6 Shared UI Components

**Files:** `src/components/pill.tsx`, `src/components/panel.tsx`, `src/components/chart-tooltip.tsx`

- `Pill` — toggle button (active/inactive states)
- `Panel` — titled card container
- `ChartTooltip` — custom recharts tooltip with dark theme

**Phase 2 deliverable:** Fully functional score viewer for the 2025 season. Shareable URLs. Mobile-responsive. Deployed to Cloudflare Pages.

---

## Phase 3: Historical Seasons

**Goal:** Import historical data (2015–2024) and add season switching.

### 3.1 Import Historical Data

- Run import tool on all HTML files in `data/scores/`
- Build ensemble registry incrementally (each year adds new ensembles/aliases)
- Handle era-specific parsing (Era 1 for 2015, 2021 virtual, etc.)
- Mark 2020 as incomplete
- Validate against known results

### 3.2 Season Switcher UI

- Year dropdown/selector in the header
- URL updates to include year
- Class list updates per season (different classes available in different years)
- Shows list updates per season
- Handle missing data gracefully (some classes only exist in some years)

### 3.3 Cross-Era Caption Handling in UI

- Detect the era for the current season
- Show appropriate caption names in toggles and tables
- When switching between eras, caption pills update to match
- 2021: show "Music" and "Visual" only (no effect captions)

**Phase 3 deliverable:** Browse 10+ years of RMPA scores with season switching.

---

## Phase 4: My Ensemble & Personalization

**Goal:** Add local storage favorites and a personalized "My Ensemble" experience.

### 4.1 Favorites System

**Files:** `src/favorites.ts`

- `getFavorite(): FavoriteEnsemble | null` — read from localStorage
- `setFavorite(ensembleId: string, classId: string): void`
- `clearFavorite(): void`
- Star/heart icon on ensemble names to set favorite
- Persist: ensemble ID + preferred class

### 4.2 My Ensemble View

**Files:** `src/views/my-ensemble.tsx`

- Landing view when a favorite is set
- Latest result prominently displayed (rank, total, trend arrow)
- Season progression chart with the favorited group highlighted/bolded
- Groups ranked immediately above/below shown for context
- Link to full class standings

### 4.3 Onboarding / First Visit

- If no favorite set: show full class browser (current behavior)
- Subtle prompt: "Tap ★ on any ensemble to set it as your default"
- Favorite persists across sessions via localStorage

**Phase 4 deliverable:** Parents and students can set their group and get a focused view on every visit.

---

## Phase 5: Detailed Recap View

**Goal:** Full judge-level score breakdown for directors.

### 5.1 Recap Table Component

**Files:** `src/views/recap.tsx`

- Tap/click an ensemble's score card in Standings to expand the recap
- Full judge-level table: all subcaption scores, factored totals, ranks
- Layout follows CompetitionSuite caption ordering but with modernized styling
- Responsive: horizontally scrollable on mobile
- Color-coded caption columns
- Judge names as column headers

### 5.2 Caption Analysis

- Per-caption rank indicators (e.g., "2nd in Music, 5th in Visual")
- Highlight where a group ranks best/worst across captions
- Compare subcaption ratios (Comp vs Perf within Music)

**Phase 5 deliverable:** Directors can see full recap detail without going back to CompetitionSuite.

---

## Phase 6: Cross-Season Comparison

**Goal:** Compare an ensemble's performance across multiple years.

### 6.1 Cross-Season Data Loading

- Load season metadata for multiple years
- Find an ensemble across years using the registry
- Normalize scores via domain buckets for cross-era comparison

### 6.2 Cross-Season View

**Files:** `src/views/cross-season.tsx`

- Select an ensemble → see their scores across all available seasons
- Line chart with years on X-axis
- Domain-normalized scores (0–100) so different eras are comparable
- Handle 2021 gap (no effect data) with visual indicator
- Show class changes across years (e.g., moved from PSA to PSO)
- Season-over-season growth summary

**Phase 6 deliverable:** Track an ensemble's multi-year trajectory.

---

## Phase 7: PWA & Offline

**Goal:** Make the app installable and functional offline.

### 7.1 Service Worker

- Register service worker in `main.tsx`
- Cache strategy: app shell (cache-first), data files (network-first with cache fallback)
- Precache current season's data on first visit
- Background sync: check for new show data periodically

### 7.2 Install Prompt

- Custom install banner for mobile users
- "Add to Home Screen" guidance for iOS (manual process)
- App icon (need to create 192px and 512px icons)

### 7.3 Offline Indicator

- Show subtle indicator when offline
- Cached data still browsable
- "Last updated" timestamp on cached data

**Phase 7 deliverable:** Installable PWA with offline score browsing.

---

## Phase 8: Admin Import UI (Optional)

**Goal:** Replace the CLI import tool with a web-based admin interface.

### 8.1 Import Page

- Drag-and-drop or file picker for HTML recap files
- Client-side parsing (same parser, but running in browser)
- Preview parsed data in a table before publishing
- Flag unrecognized ensemble names with inline resolution
- Download generated JSON (since there's no backend, admin copies to repo)

### 8.2 Data Validation

- Compare parsed totals against expected sum of captions
- Highlight any ensembles not in registry
- Show diff against existing data if re-importing a show

**Phase 8 deliverable:** Non-technical admin can import scores without CLI access.

---

## Dependency Graph

```
Phase 1 (Data Foundation)
  ├── 1.1 Types
  ├── 1.2 Scoring Functions (depends on 1.1)
  ├── 1.3 HTML Parser (depends on 1.1, 1.2)
  ├── 1.4 Ensemble Registry (depends on 1.1)
  ├── 1.5 Import CLI (depends on 1.3, 1.4)
  └── 1.6 Import 2025 Data (depends on 1.5)

Phase 2 (Core UI) — depends on Phase 1
  ├── 2.1 Data Loading (depends on 1.1)
  ├── 2.2 URL Router
  ├── 2.3 App Shell (depends on 2.1, 2.2)
  ├── 2.4 Progression View (depends on 2.3)
  ├── 2.5 Standings View (depends on 2.3)
  └── 2.6 Shared Components

Phase 3 (Historical) — depends on Phase 1, 2
Phase 4 (My Ensemble) — depends on Phase 2
Phase 5 (Recap View) — depends on Phase 2
Phase 6 (Cross-Season) — depends on Phase 3
Phase 7 (PWA) — depends on Phase 2
Phase 8 (Admin UI) — depends on Phase 1
```

Phases 4, 5, 7, and 8 can be done in any order after their dependencies are met.

---

## Estimated Scope per Phase

| Phase | PRs | Key Dependencies |
|-------|-----|-----------------|
| 1 — Data Foundation | 5–6 | cheerio (parser only) |
| 2 — Core UI | 4–5 | recharts |
| 3 — Historical | 2–3 | — |
| 4 — My Ensemble | 2 | — |
| 5 — Recap View | 1–2 | — |
| 6 — Cross-Season | 2 | — |
| 7 — PWA | 2–3 | workbox or vite-plugin-pwa |
| 8 — Admin UI | 2 | — |

---

## Design System Notes

Carry forward the prototype's visual language:

- **Background:** `#080812` (near-black with blue tint)
- **Surface:** `#0e0e1c` (panels), `#14142a` (pills inactive)
- **Accent:** `#f59e0b` (amber — active states, highlights, best scores)
- **Text:** `#dddde8` (primary), `#8b8b9b` (secondary), `#808096` (muted)
- **Borders:** `#191930` (panels), `#141428` (grid lines)
- **Font:** JetBrains Mono / SF Mono / Fira Code (monospace stack)
- **Error/Penalty:** `#ef4444` (red)
- **Growth colors:** `#10b981` (high growth), `#22d3ee` (moderate), `#f59e0b` (low), `#ef4444` (negative)
- **Chart palette:** 12-color cycle from prototype (`PALETTE` array)
- **Caption colors:** Warm earth tones (`#cc7a5a`, `#6aab8e`, `#c4985a`, `#8a7ab8`)

Translate these to Tailwind custom theme values or CSS custom properties in `src/index.css`.
