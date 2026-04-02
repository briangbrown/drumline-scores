# Automated Score Pipeline — Implementation Plan

Phased implementation plan derived from [`docs/designs/AUTO_SCORE_PIPELINE.md`](../designs/AUTO_SCORE_PIPELINE.md).

Each phase is independently deployable and testable. Phases build on each other — earlier phases produce working CLI tools and test coverage that later phases assemble into GitHub Actions workflows.

---

## Prerequisites

Before starting, complete these one-time setup tasks:

### P.1 Branch Protection Bypass

Configure the repo so the pipeline can push to `main`:

- Go to GitHub repo Settings → Rules → Rulesets
- Add a ruleset bypass actor for the GitHub Actions bot (scoped to pipeline workflows only)
- **Alternative:** Create a dedicated GitHub App with `contents: write` permission — heavier but more auditable

### P.2 GitHub Issue Labels

Create the labels used by pipeline issue reporting:

```bash
gh label create score-pipeline --color 0E8A16 --description "Automated score pipeline"
gh label create validation-failure --color D93F0B --description "Pipeline validation gate failure"
gh label create missing-scores --color FBCA04 --description "Scores not posted within timeout"
gh label create new-ensemble --color 1D76DB --description "Unresolved ensemble name"
```

### P.3 `poll-state.json` Initialization

Create the initial state file:

**File:** `data/poll-state.json`

```json
{
  "season": 2026,
  "retreats": [],
  "coolDownUntilUtc": null
}
```

### P.4 Season Metadata Fields

Extend the `ShowMetadata` type in `src/types.ts` and update `season.json` files to include `sourceUrl`, `sourceHash`, and `lastImportedUtc` fields on show entries. The existing import CLI should write these fields when importing.

---

## Phase 1: Core Pipeline Modules

**Goal:** Build the TypeScript modules that all stages share — scrapers, hasher, validator, state manager, issue reporter. All tested with unit tests and runnable from the CLI.

### 1.1 Poll State Manager

**Files:** `src/pipeline/pollState.ts`, `src/pipeline/pollState.test.ts`

Types:

```typescript
type RetreatStatus = 'pending' | 'imported' | 'failed'

type RetreatEntry = {
  date: string
  eventName: string
  retreatUtc: string
  windowCloseUtc: string
  status: RetreatStatus
  sourceHash: string | null
  lastImportedUtc: string | null
}

type PollState = {
  season: number
  retreats: Array<RetreatEntry>
  coolDownUntilUtc: string | null
}
```

Functions:

- `readPollState(filePath: string): PollState` — read and parse the JSON file
- `writePollState(filePath: string, state: PollState): void` — write back atomically
- `findActionableRetreats(state: PollState, now: Date): Array<RetreatEntry>` — returns pending retreats where `now >= retreatUtc && now < windowCloseUtc`
- `isCoolDownActive(state: PollState, now: Date): boolean`
- `markRetreatImported(state: PollState, date: string, hash: string, now: Date): PollState` — returns updated state with the retreat marked imported and cool-down set
- `markRetreatFailed(state: PollState, date: string): PollState`
- `addOrUpdateRetreat(state: PollState, entry: RetreatEntry): PollState` — idempotent upsert by date + retreatUtc

Tests:

- Empty state → no actionable retreats
- Pending retreat before window → not actionable
- Pending retreat within window → actionable
- Cool-down active/expired logic
- Mark imported sets sourceHash, lastImportedUtc, cool-down
- Upsert preserves existing imported entries, updates pending ones

### 1.2 Content Hasher

**Files:** `src/pipeline/contentHash.ts`, `src/pipeline/contentHash.test.ts`

```typescript
type HashComparison = {
  status: 'new' | 'changed' | 'unchanged'
  currentHash: string
  previousHash: string | null
}
```

Functions:

- `hashContent(html: string): string` — SHA-256 hex digest of the HTML body
- `compareHash(currentHash: string, previousHash: string | null): HashComparison`

Tests:

- Same content → `unchanged`
- Different content → `changed`
- Null previous hash → `new`
- Deterministic hashing (same input always same hash)

### 1.3 Score Page Scraper

**Files:** `src/pipeline/scrapeScores.ts`, `src/pipeline/scrapeScores.test.ts`

```typescript
type RecapEntry = {
  date: string          // "March, 29 2025"
  eventName: string     // "RMPA State Championships"
  recapUrl: string      // "http://recaps.competitionsuite.com/<uuid>.htm"
  year: number
}
```

Functions:

- `parseScorePage(html: string): Array<RecapEntry>` — parse the `rmpa.org/scores` HTML page. Extract all recap links from the nested `<ul>` structure. Each `<li>` has a link (date text) and adjacent text (event name).
- `filterByYear(entries: Array<RecapEntry>, year: number): Array<RecapEntry>`

Tests:

- Save a snapshot of the `rmpa.org/scores` page as a test fixture in `data/test-fixtures/`
- Parse known entries, verify URLs, dates, event names
- Filter by year returns correct subset
- Handle edge cases: missing links, PDF links (pre-2013 — should be skipped)

**Note:** The actual HTTP fetch is done at the workflow level, not in this module. This module is a pure HTML parser, making it easy to test.

### 1.4 Schedule Scraper

**Files:** `src/pipeline/scrapeSchedule.ts`, `src/pipeline/scrapeSchedule.test.ts`

```typescript
type RetreatInfo = {
  label: string         // "Regional A Retreat/Critique" or "Retreat/Critique"
  timeUtc: string       // ISO 8601
  isFinal: boolean
}

type UpcomingEvent = {
  date: string            // "2026-02-14"
  dayOfWeek: string
  eventName: string
  scheduleUrl: string
  retreats: Array<RetreatInfo>
}
```

Functions:

- `parseCompetitionsPage(html: string): Array<{ date: string; eventName: string; scheduleUrl: string }>` — parse `rmpa.org/competitions` to extract event entries with schedule links
- `parseSchedulePage(html: string, eventDate: string): Array<RetreatInfo>` — parse a CompetitionSuite schedule page. Scan `schedule-row` elements for retreat entries ("Retreat Concludes", "Full Retreat", "Retreat/Critique"). Extract times, convert to UTC using `America/Denver` timezone. Mark the last retreat as `isFinal: true`.
- `filterUpcomingEvents(events: Array<...>, now: Date, windowDays: number): Array<...>` — filter to events within the next N days

Tests:

- Save schedule HTML fixtures in `data/test-fixtures/`
- Parse retreat times from single-retreat and split-retreat schedules
- Verify UTC conversion for both MST and MDT dates
- Handle missing retreat entry (fall back to last performance time + 60 min)
- Filter upcoming correctly around the Thursday→Saturday window

**Dependency:** Needs a date/timezone library. Use the built-in `Intl.DateTimeFormat` with `timeZone: 'America/Denver'` for conversion — no external dependency needed for Node 18+.

### 1.5 Validation Module

**Files:** `src/pipeline/validate.ts`, `src/pipeline/validate.test.ts`

```typescript
type GateResult = {
  name: string
  passed: boolean
  errors: Array<string>
}

type ValidationResult = {
  passed: boolean
  gates: Array<GateResult>
}
```

Functions:

- `validateShowData(showData: ShowData, year: number): ValidationResult` — runs all gates and returns results
- Individual gate functions (called by `validateShowData`):
  - `validateSchema(showData: ShowData): GateResult` — Gate 1: required fields, correct types
  - `validateScoreRanges(showData: ShowData): GateResult` — Gate 2: scores 0–100, no NaN, ranks sequential
  - `validateCaptionStructure(showData: ShowData, year: number): GateResult` — Gate 3: caption count/keys match era
  - `validateEnsembleResolution(showData: ShowData, registry: EnsembleRegistry): GateResult` — Gate 4: ensemble name resolution (non-blocking — returns warnings)
  - `validateDeduplication(showData: ShowData, season: SeasonMetadata): GateResult` — Gate 5: date+venue collision check
  - `validateDataConsistency(showData: ShowData, year: number): GateResult` — Gate 7: sub-caption math → caption totals → overall total (±0.05 tolerance)

Tests:

- Valid show data passes all gates
- Missing required fields → Gate 1 fails
- Score out of range → Gate 2 fails
- Wrong caption count for era → Gate 3 fails
- Unknown ensemble → Gate 4 warns but passes
- Duplicate date+venue → Gate 5 fails
- Math mismatch → Gate 7 fails
- Use existing parsed show data from `public/data/` as valid test fixtures

**Note:** Gate 6 (test suite) is run at the workflow level (`npx vitest run && npm run build`), not in this module.

### 1.6 Issue Reporter

**Files:** `src/pipeline/reportIssue.ts`

Functions:

- `formatIssueBody(failure: { eventName: string; date: string; sourceUrl: string | null; gate: string; errors: Array<string> }): string` — generates the markdown issue body per the design doc format
- `reportFailure(failure: ...): void` — calls `gh issue create` with the formatted body and appropriate labels

This is a thin wrapper around `gh` CLI calls. No unit tests needed — integration tested at the workflow level.

### 1.7 Auto-Commit Module

**Files:** `src/pipeline/commit.ts`

Functions:

- `commitNewShow(showData: ShowData, files: Array<string>): void` — stage files, commit with "add scores" message format
- `commitUpdatedShow(showData: ShowData, files: Array<string>, reason: string, oldHash: string, newHash: string): void` — commit with "update scores" message format
- `commitPollState(message: string): void` — commit poll-state.json updates

Thin wrapper around git CLI. Integration tested at the workflow level.

---

## Phase 2: Pipeline CLI Entry Points

**Goal:** Create runnable CLI scripts for each pipeline stage. These are what the GitHub Actions workflows will call. Each script orchestrates the modules from Phase 1.

### 2.1 Schedule Watcher CLI

**File:** `src/pipeline/cli/watchSchedule.ts`

Run via: `npx tsx src/pipeline/cli/watchSchedule.ts`

Steps:
1. Fetch `rmpa.org/competitions` (HTTP GET)
2. Parse with `parseCompetitionsPage()`
3. Filter to upcoming events (next 3 days)
4. For each event with a schedule URL: fetch the schedule page, parse retreat times
5. Read `poll-state.json`, call `addOrUpdateRetreat()` for each retreat
6. Write updated `poll-state.json`
7. Commit the change via `commitPollState()`

Exit codes:
- `0` — success (retreats found and updated, or no upcoming events)
- `1` — unrecoverable error (fetch failed, parse error)

### 2.2 Score Poller CLI

**File:** `src/pipeline/cli/pollScores.ts`

Run via: `npx tsx src/pipeline/cli/pollScores.ts`

This is the "brain" of each 3-minute cron invocation. Must be as fast as possible when there's nothing to do.

Steps:
1. Read `poll-state.json`
2. Check for actionable retreats or active cool-down → if neither, exit `0` immediately
3. Fetch `rmpa.org/scores` → parse recap links for current season
4. For each link: compute hash, compare against `season.json` hashes
5. No new/changed content → exit `0`
6. For each changed/new recap:
   a. Download recap HTML, save to `data/scores/<year>/`
   b. Run existing parser (`parseRecapHtml`)
   c. Run validation gates (`validateShowData`)
   d. If validation passes: run import (`npx tsx src/import.ts`), commit
   e. If validation fails: file issue, mark retreat as `failed`
7. Update `poll-state.json` (mark imported, set cool-down)
8. Check for timeout on pending retreats → file issue if expired

Exit codes:
- `0` — normal (nothing to do, or import succeeded)
- `1` — unrecoverable error
- (Validation failures are reported via issues, not exit codes)

### 2.3 Sunday Reconciliation CLI

**File:** `src/pipeline/cli/reconcile.ts`

Run via: `npx tsx src/pipeline/cli/reconcile.ts`

Steps:
1. Read `season.json` — find shows with dates in the last 2 days
2. Fetch `rmpa.org/scores` — check for any new links not in `season.json`
3. For each recent show: download recap HTML, compute hash, compare
4. Re-import any changed shows, commit all changes in a single commit
5. Import any new shows found

### 2.4 Daily Fallback CLI

**File:** `src/pipeline/cli/fallback.ts`

Run via: `npx tsx src/pipeline/cli/fallback.ts`

Steps:
1. Fetch `rmpa.org/scores` — check for any new links not in `season.json`
2. For shows from last 7 days: re-download and hash-compare
3. Import new/changed shows, validate, commit

### 2.5 DST Guard Utility

**File:** `src/pipeline/cli/dstGuard.ts`

Run via: `npx tsx src/pipeline/cli/dstGuard.ts --mst-hour 21 --mdt-hour 20`

A tiny script the workflow calls first. Checks if the current UTC hour matches the correct cron entry for the current DST state. Exits `0` to proceed or `1` to skip (with a log message).

This avoids duplicating the DST guard bash logic in every workflow YAML.

---

## Phase 3: GitHub Actions Workflows

**Goal:** Wire the CLI scripts into GitHub Actions with correct cron schedules, DST handling, and permissions.

### 3.1 DST Date Guard (shared)

Implement the dual-cron + date guard pattern from the design doc. Since the DST guard is a reusable CLI (2.5), each workflow just calls it as the first step and exits if it returns non-zero.

### 3.2 `schedule-watcher.yml`

```yaml
name: Schedule Watcher
on:
  schedule:
    - cron: '0 21 * * 4,5,6'   # 2 PM MST
    - cron: '0 20 * * 4,5,6'   # 2 PM MDT
  workflow_dispatch: {}          # Manual trigger for testing

jobs:
  watch:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: npm ci
      - name: DST guard
        run: npx tsx src/pipeline/cli/dstGuard.ts --mst-hour 21 --mdt-hour 20
      - name: Watch schedules
        run: npx tsx src/pipeline/cli/watchSchedule.ts
      - name: Push changes
        run: git push
```

### 3.3 `score-poller.yml`

```yaml
name: Score Poller
on:
  schedule:
    - cron: '*/3 1-6 * * 0,6'   # Fri/Sat evening MST window
    - cron: '*/3 0-5 * * 0,6'   # Fri/Sat evening MDT window
  workflow_dispatch: {}

jobs:
  poll:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: npm ci
      - name: DST guard
        run: npx tsx src/pipeline/cli/dstGuard.ts --mst-hours 1-6 --mdt-hours 0-5
      - name: Poll for scores
        run: npx tsx src/pipeline/cli/pollScores.ts
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Push changes
        if: success()
        run: git push
```

### 3.4 `sunday-reconciliation.yml`

```yaml
name: Sunday Reconciliation
on:
  schedule:
    - cron: '0 19 * * 0'   # noon MST
    - cron: '0 18 * * 0'   # noon MDT
  workflow_dispatch: {}

jobs:
  reconcile:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: npm ci
      - name: DST guard
        run: npx tsx src/pipeline/cli/dstGuard.ts --mst-hour 19 --mdt-hour 18
      - name: Reconcile weekend scores
        run: npx tsx src/pipeline/cli/reconcile.ts
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Push changes
        if: success()
        run: git push
```

### 3.5 `score-fallback.yml`

```yaml
name: Score Fallback
on:
  schedule:
    - cron: '0 19 * * 1-5'   # noon MST
    - cron: '0 18 * * 1-5'   # noon MDT
  workflow_dispatch: {}

jobs:
  fallback:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: npm ci
      - name: DST guard
        run: npx tsx src/pipeline/cli/dstGuard.ts --mst-hour 19 --mdt-hour 18
      - name: Check for new or updated scores
        run: npx tsx src/pipeline/cli/fallback.ts
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Push changes
        if: success()
        run: git push
```

### 3.6 `season-lifecycle.yml`

Use the YAML from the design doc verbatim. This is the only workflow that stays enabled year-round.

```yaml
name: Season Lifecycle
on:
  schedule:
    - cron: '0 19 25 1 *'   # Jan 25 noon MST
    - cron: '0 18 30 4 *'   # Apr 30 noon MDT
  workflow_dispatch: {}
```

Files enable/disable issues per the design doc.

---

## Phase 4: Extend Season Metadata

**Goal:** Update `season.json` schema and the import tool to support content hashing and source tracking.

### 4.1 Season JSON Schema Update

Add optional fields to show entries in `season.json`:

```typescript
type ShowEntry = {
  id: string
  eventName: string
  date: string
  round: string
  sourceUrl?: string            // recap URL
  sourceHash?: string           // SHA-256 of last imported HTML
  lastImportedUtc?: string      // ISO 8601
}
```

These fields are optional so existing data remains valid. New imports populate them.

### 4.2 Import Tool Updates

Update `src/import.ts` to:

- Accept `--source-url <url>` flag to record the recap URL
- Compute and store `sourceHash` from the HTML content
- Store `lastImportedUtc` as the current UTC time
- Write these fields into the show entry in `season.json`

### 4.3 Backfill Existing Data

Run a one-time script to compute hashes for all existing HTML files in `data/scores/` and backfill `sourceHash` into the corresponding `season.json` entries. This allows the poller to correctly detect changes for shows that were imported before the pipeline existed.

---

## Phase 5: Integration Testing & Dry Run

**Goal:** End-to-end validation before enabling in production.

### 5.1 Integration Test Suite

**File:** `src/pipeline/integration.test.ts`

- Test the full pipeline flow with fixture data:
  - Schedule watcher: parse fixture HTML → update poll-state → verify entries
  - Score poller: fixture recap HTML → hash → parse → validate → verify output JSON matches expected
  - Reconciliation: fixture with changed hash → re-import → verify update
- Test DST guard with mocked dates
- Test the additive-only principle: remove a link from scores page fixture → verify no deletions
- Test split-retreat flow: two retreats for one show → two poll-state entries → partial import → full import overwrites

### 5.2 Manual Dry Run

Before enabling the crons:

1. Run `watchSchedule.ts` manually → verify `poll-state.json` is populated correctly
2. Run `pollScores.ts` manually during a non-competition day → verify it exits in <5 seconds
3. Run `fallback.ts` manually → verify it finds existing shows, skips them (hash unchanged), finds nothing new
4. Run `pollScores.ts` with a pending retreat entry set to a past time → verify it fetches, parses, validates, and would commit (use `--dry-run` flag)
5. Test issue reporting by triggering a validation failure on purpose

### 5.3 Enable Workflows

1. Enable `season-lifecycle.yml` first (always-on, harmless)
2. Enable `schedule-watcher.yml` on a Thursday → verify poll-state is updated
3. Enable `score-poller.yml` on a competition Saturday → monitor for successful import
4. Enable `sunday-reconciliation.yml` and `score-fallback.yml`
5. Monitor the first full competition weekend end-to-end

---

## Dependency Graph

```
Phase 1 (Core Modules)
  ├── 1.1 Poll State Manager
  ├── 1.2 Content Hasher
  ├── 1.3 Score Page Scraper
  ├── 1.4 Schedule Scraper
  ├── 1.5 Validation Module (depends on existing parser + scoring)
  ├── 1.6 Issue Reporter
  └── 1.7 Auto-Commit Module

Phase 2 (CLI Entry Points) — depends on Phase 1
  ├── 2.1 Schedule Watcher CLI (depends on 1.1, 1.4, 1.7)
  ├── 2.2 Score Poller CLI (depends on 1.1, 1.2, 1.3, 1.5, 1.6, 1.7)
  ├── 2.3 Reconciliation CLI (depends on 1.2, 1.3, 1.5, 1.6, 1.7)
  ├── 2.4 Fallback CLI (depends on 1.2, 1.3, 1.5, 1.6, 1.7)
  └── 2.5 DST Guard (standalone)

Phase 3 (GitHub Actions) — depends on Phase 2
  ├── 3.1 DST date guard pattern
  ├── 3.2 schedule-watcher.yml (depends on 2.1, 2.5)
  ├── 3.3 score-poller.yml (depends on 2.2, 2.5)
  ├── 3.4 sunday-reconciliation.yml (depends on 2.3, 2.5)
  ├── 3.5 score-fallback.yml (depends on 2.4, 2.5)
  └── 3.6 season-lifecycle.yml (standalone)

Phase 4 (Season Metadata) — can start in parallel with Phase 2
  ├── 4.1 Schema update
  ├── 4.2 Import tool updates (depends on 4.1)
  └── 4.3 Backfill hashes (depends on 4.2)

Phase 5 (Integration Testing) — depends on Phases 1–4
  ├── 5.1 Integration tests
  ├── 5.2 Manual dry run
  └── 5.3 Enable workflows (final step)
```

---

## Estimated Scope per Phase

| Phase | PRs | Key Dependencies |
|-------|-----|-----------------|
| P — Prerequisites | 1 | GitHub repo settings (manual) |
| 1 — Core Modules | 4–5 | cheerio (already installed) |
| 2 — CLI Entry Points | 3–4 | Phase 1 modules |
| 3 — GitHub Actions | 2–3 | Phase 2 CLIs |
| 4 — Season Metadata | 2 | Existing import tool |
| 5 — Integration & Rollout | 1–2 | Everything above |
| **Total** | **~13–16 PRs** | |

---

## File Structure

```
src/pipeline/
  ├── pollState.ts              # 1.1 Poll state manager
  ├── pollState.test.ts
  ├── contentHash.ts            # 1.2 Content hasher
  ├── contentHash.test.ts
  ├── scrapeScores.ts           # 1.3 Score page scraper
  ├── scrapeScores.test.ts
  ├── scrapeSchedule.ts         # 1.4 Schedule scraper
  ├── scrapeSchedule.test.ts
  ├── validate.ts               # 1.5 Validation module
  ├── validate.test.ts
  ├── reportIssue.ts            # 1.6 Issue reporter
  ├── commit.ts                 # 1.7 Auto-commit module
  ├── integration.test.ts       # 5.1 Integration tests
  └── cli/
      ├── watchSchedule.ts      # 2.1 Schedule watcher CLI
      ├── pollScores.ts         # 2.2 Score poller CLI
      ├── reconcile.ts          # 2.3 Sunday reconciliation CLI
      ├── fallback.ts           # 2.4 Daily fallback CLI
      └── dstGuard.ts           # 2.5 DST guard utility

.github/workflows/
  ├── schedule-watcher.yml      # 3.2
  ├── score-poller.yml          # 3.3
  ├── sunday-reconciliation.yml # 3.4
  ├── score-fallback.yml        # 3.5
  └── season-lifecycle.yml      # 3.6

data/test-fixtures/             # Test fixture HTML files
  ├── rmpa-scores-page.html
  ├── rmpa-competitions-page.html
  ├── schedule-single-retreat.html
  └── schedule-split-retreat.html

public/data/
  └── poll-state.json           # P.3
```

---

## Coverage Exclusions

The following pipeline files should be excluded from Vitest coverage thresholds in `vitest.config.ts` (they are CLI scripts and integration wrappers, not pure functions):

- `src/pipeline/cli/*`
- `src/pipeline/commit.ts`
- `src/pipeline/reportIssue.ts`
- `src/pipeline/integration.test.ts`

The core modules (pollState, contentHash, scrapeScores, scrapeSchedule, validate) **must** have test coverage.
