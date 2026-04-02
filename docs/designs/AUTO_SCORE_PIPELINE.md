# Automated Score Ingestion Pipeline — Design Document

## Overview

Fully automated pipeline that detects when new RMPA scores are posted, downloads and parses them, validates the data, and commits directly to `main` for automatic deployment via Cloudflare Pages. No admin UI required.

**Core principle:** The parser + validation gates replace human review. If validation passes, the data goes live. If anything fails, a GitHub issue is opened for manual investigation.

---

## Data Sources

### 1. `rmpa.org/scores` — Score Recap Links

- **Structure:** Nested `<ul>` grouped by year. Each `<li>` contains a date, event name, and link to `recaps.competitionsuite.com/<uuid>.htm`.
- **No CSS classes** — relies on semantic HTML lists.
- **Fully public** — no authentication required.
- **Historical depth:** Entries back to 1994. Pre-2013 entries link to PDFs instead of CompetitionSuite HTML.
- **Example entry:**
  ```
  [March, 29 2025](http://recaps.competitionsuite.com/a68d3f2d-84ed-402d-9cae-350893814007.htm)
  RMPA State Championships
  ```

### 2. `rmpa.org/competitions` — Competition Schedule Links

- **Structure:** Chronological list of events. Each event has a date header (`MM/DD/YY Sat`), event link, and resource links (Schedule, Logistics, Layout, Warmup Zones, Map).
- **Schedule links** point to `schedules.competitionsuite.com/<uuid>_standard.htm`.
- **Fully public** — no authentication required.
- **Season scope:** Lists all events for the current season (typically 7–8 events, February through April).

### 3. `schedules.competitionsuite.com/<uuid>_standard.htm` — Performance Schedules

- **Structure:** Rows with CSS class `schedule-row` containing four columns:
  - `schedule-row__name` — group name (up to 550px, truncated with ellipsis)
  - `schedule-row__location` — school/ensemble location
  - `schedule-row__initials` — competition class (centered, ~110px)
  - `schedule-row__time` — performance time (right-aligned)
- **Retreat entries** appear at the end of the schedule as "Full Retreat" and "Retreat Concludes" with scheduled times.
- **Published** 1–2 weeks before the event.
- **Fully public** — no authentication required.

### 4. `recaps.competitionsuite.com/<uuid>.htm` — Score Recap HTML

- **Structure:** Detailed in [`DESIGN.md`](DESIGN.md) under "Score Import — CompetitionSuite HTML Parsing".
- **Fully public** — no authentication required.
- **Posted** shortly after the retreat concludes (typically within 30–60 minutes).

---

## Pipeline Architecture

```
┌─ Stage 1: Schedule Watcher (Thu/Fri/Sat crons) ──────┐
│ 1. Fetch rmpa.org/competitions                        │
│ 2. Extract schedule links for next 3 days             │
│ 3. Fetch each schedule page                           │
│ 4. Parse "Retreat Concludes" time                     │
│ 5. Overwrite poll-schedule artifact (latest wins)     │
│                                                       │
│ Runs: Thu 2 PM, Fri 2 PM, Sat 2 PM MT                │
│ Catches last-minute reschedules & weather delays      │
└───────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ Stage 2: Score Poller (competition day) ────────────┐
│                                                       │
│ Pass 1 — Mid-day retreat (split shows only)           │
│  Poll after mid-day retreat time for partial recap    │
│  (Regional A classes only). Import & commit.          │
│                                                       │
│ Pass 2 — Final retreat                                │
│  Poll after final retreat time for full recap.        │
│  Re-download & re-import — overwrites Pass 1 data.   │
│  Content hash detects changes vs. what's committed.   │
│                                                       │
│ Each pass: fetch recap HTML → hash → compare to       │
│ stored hash → if changed: parse, validate, commit.    │
│ Timeout after 2 hours per pass → open issue.          │
└───────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ Stage 3: Sunday Reconciliation (Sunday noon MT) ────┐
│ Re-download ALL recaps from current weekend.          │
│ Hash-compare against committed versions.              │
│ If content changed → re-import (score corrections).   │
│ Also catches late posts & missed Friday prelims.      │
└───────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ Stage 4: Daily Fallback (Mon–Fri noon MT) ──────────┐
│ Single check of rmpa.org/scores for any new links.    │
│ Hash-compare known recaps for corrections.            │
│ Catches anything Stages 2–3 missed.                   │
└───────────────────────────────────────────────────────┘
```

---

## Stage 1: Schedule Watcher

### Trigger

Runs **three times** on competition weekends to catch last-minute reschedules:

| Run | When | Why |
|-----|------|-----|
| Thursday | 2:00 PM MT (20:00 UTC) | First look — catches Friday prelims and Saturday shows. Schedules are typically published 1–2 weeks ahead. |
| Friday | 2:00 PM MT (20:00 UTC) | Refresh — picks up any Friday schedule changes before Saturday shows. Also re-checks Friday prelims retreat time if a show is that evening. |
| Saturday | 2:00 PM MT (20:00 UTC) | Final refresh — catches day-of delays (weather, etc.). Runs well before any retreat (earliest main retreats are ~5 PM MT). |

**Retreat time survey (2026 season):**

| Event | Earliest Retreat | Main/Final Retreat |
|-------|------------------|--------------------|
| Show #1 (Monarch) | — | 5:28 PM |
| Show #2 (Frederick) | — | 5:18 PM |
| Show #3 (Lakewood) | 1:45 PM (Regional A) | 6:55 PM |
| Show #4 (Legacy) | — | 6:49 PM |
| Show #5 (Longmont) | — | 4:56 PM |
| Prelims (Mountain Range) | 12:45 PM (Regional A) | 7:16 PM |
| Finals (Denver Coliseum) | — | 8:07 PM |

Some shows have early Regional A retreats (12:45–1:45 PM), but scores are posted as a single recap after the final retreat of the day, so the 2:00 PM watcher run is safe. The Score Poller keys off the **last** retreat time.

Each run **overwrites** the previous poll-schedule artifact with the latest retreat times. The Score Poller always reads the most recent version, so a Saturday morning delay that pushes the retreat back 30 minutes is automatically reflected.

**Key insight:** Shows are rarely moved _forward_ in time, but sometimes _delayed_ (weather, venue issues). Running the watcher multiple times ensures the `pollAfterUtc` shifts later if the schedule changes, so the poller doesn't start too early and doesn't time out waiting.

### Steps

1. **Fetch `rmpa.org/competitions`** — extract all event entries with dates and schedule links.
2. **Identify upcoming events** — filter to events occurring in the next 3 days (covers Thursday→Saturday window).
3. **Fetch each schedule page** — download from `schedules.competitionsuite.com/<uuid>_standard.htm`.
4. **Parse retreat time** — scan `schedule-row` entries for "Retreat Concludes" (preferred) or "Full Retreat" (fallback). Extract the time value.
5. **Compare with previous poll-schedule** — if the retreat time has changed, log the delta (useful for debugging).
6. **Write poll-schedule artifact** — overwrite with latest data.

### Output Format

```json
{
  "upcoming": [
    {
      "date": "2026-02-14",
      "dayOfWeek": "Saturday",
      "eventName": "Regular Season Show #1",
      "scheduleUrl": "https://schedules.competitionsuite.com/<uuid>_standard.htm",
      "retreats": [
        {
          "label": "Retreat/Critique",
          "timeUtc": "2026-02-15T00:28:00Z",
          "isFinal": true
        }
      ],
      "lastCheckedUtc": "2026-02-14T20:00:00Z"
    },
    {
      "date": "2026-02-28",
      "dayOfWeek": "Saturday",
      "eventName": "Regular Season Show #3",
      "scheduleUrl": "https://schedules.competitionsuite.com/<uuid>_standard.htm",
      "retreats": [
        {
          "label": "Regional A Retreat/Critique",
          "timeUtc": "2026-02-28T20:45:00Z",
          "isFinal": false
        },
        {
          "label": "Retreat/Critique",
          "timeUtc": "2026-03-01T01:55:00Z",
          "isFinal": true
        }
      ],
      "lastCheckedUtc": "2026-02-28T20:00:00Z"
    }
  ]
}
```

- **Single-retreat shows:** One entry with `isFinal: true`. Score Poller runs one pass.
- **Split-retreat shows:** Two entries. Score Poller runs Pass 1 after the mid-day retreat (partial recap), then Pass 2 after the final retreat (full recap, overwrites Pass 1).

### Edge Cases

- **No schedule published yet:** Log a warning. Thursday/Friday/Saturday runs will retry. The daily fallback will catch the scores regardless.
- **No retreat entry on schedule:** Use the last performance time + 60 minutes as the estimate.
- **Friday prelims:** Thursday run detects them. Friday run refreshes the retreat time before the show that evening.
- **Multiple events in one weekend:** Each gets its own poll window (e.g., prelims Friday evening, finals Saturday evening).
- **Schedule changes between runs:** Each run overwrites the artifact. The Score Poller uses whatever is latest. If the retreat moves later, polling starts later automatically. If the retreat moves earlier (rare), the worst case is polling starts a bit late — the daily fallback catches it.

---

## Content Hashing — Detecting Changes

The CompetitionSuite recap is a **living document**: it may start with partial scores (mid-day retreat for Regional A classes), then grow to include all classes (final retreat), then receive corrections (judge error found). The pipeline must detect content changes, not just new URLs.

### Mechanism

1. After downloading recap HTML, compute a SHA-256 hash of the content.
2. Store the hash alongside the show entry in `season.json`:
   ```json
   {
     "id": "show-3",
     "sourceUrl": "https://recaps.competitionsuite.com/<uuid>.htm",
     "sourceHash": "a3f2c8...",
     "lastImportedUtc": "2026-02-28T02:15:00Z"
   }
   ```
3. On subsequent fetches, compare the new hash against the stored hash.
4. **Hash unchanged** → skip (content identical, nothing to do).
5. **Hash changed** → re-import, overwrite the show JSON, update the hash, commit.
6. **New URL not in season.json** → first import (hash will be stored).

This unified mechanism handles all scenarios:
- First appearance of a recap link (new show)
- Partial → full scores (split retreat — same URL, content grows as classes are added)
- Score corrections (same URL, content edited after the fact)
- Scores republished after being temporarily unpublished (see below)

---

## Additive-Only Principle — Never Delete Scores

### The Problem: State Week Unpublish

During the week between State Prelims and State Finals, RMPA unpublishes all season scores from `rmpa.org/scores`. The recap links temporarily disappear from the page. After the Finals retreat, all scores are republished alongside the Finals recap.

### Rule: The Pipeline Never Deletes

**`rmpa.org/scores` is a discovery mechanism, not the source of truth for what should exist.** Once a show has been imported into `season.json` and its JSON data file exists, it is permanent. The pipeline only:

- **Adds** new shows (URL not in `season.json`)
- **Updates** existing shows (URL in `season.json`, but content hash changed)
- **Skips** unchanged shows (URL in `season.json`, hash matches)

It **never** removes a show from `season.json` or deletes a show JSON file because a recap link disappeared from `rmpa.org/scores`. The absence of a link is not a signal — it's expected behavior during State week.

### Republish Scenario (State Finals Weekend)

After the Finals retreat, `rmpa.org/scores` is republished with all season scores plus Finals:

1. Pipeline fetches `rmpa.org/scores` — sees all recap links (Shows 1–5, Prelims, Finals).
2. For each link, checks `season.json`:
   - **Shows 1–5 + Prelims:** URL already known. Download HTML, compute hash, compare.
     - **Hash unchanged:** skip (most common — scores weren't modified during unpublish).
     - **Hash changed:** re-import (RMPA made corrections while scores were down).
   - **Finals:** New URL — first import, proceed normally.
3. Net result: Finals data is added; everything else is either skipped or updated. Nothing is lost.

### What About New CompetitionSuite URLs?

If RMPA republishes a show under a **different CompetitionSuite UUID** (new URL for the same show), the pipeline would see it as a "new" show. To prevent duplicates:

- **Gate 5 (Change Detection)** checks for date + venue collisions, not just URL matches.
- If a new URL's parsed show date and venue match an existing entry in `season.json`, treat it as an update: replace the old URL and hash with the new one, re-import the data.
- This is expected to be rare — CompetitionSuite URLs are typically stable.

### During the Unpublish Window

While scores are unpublished (Prelims → Finals week):

- **Score Poller:** Runs after the Finals retreat time (from the schedule watcher). Finds no recap links until they're republished. Keeps polling.
- **Daily Fallback:** Fetches `rmpa.org/scores`, finds fewer links than expected (or none for the current season). No new URLs → nothing to do. Does **not** delete existing data.
- **The app continues serving all previously imported data** — users see no interruption.

---

## Stage 2: Score Poller

### Trigger

A single GitHub Actions workflow dispatched on competition days (Saturday, or Friday for prelims). Runs as an internal polling loop — not a cron-per-minute.

### Multi-Pass Design

For shows with split retreats, the poller runs multiple passes within a single workflow execution:

| Pass | Starts after | What it looks for | Commits? |
|------|-------------|-------------------|----------|
| Pass 1 (split shows only) | Mid-day retreat time | Partial recap appears (Regional A classes) or existing recap gains new content | Yes — partial data is better than no data |
| Pass 2 | Final retreat time | Full recap with all classes, or content hash change from Pass 1 | Yes — overwrites Pass 1 show JSON |

For single-retreat shows, only Pass 2 runs.

### Steps (per pass)

1. **Check timing** — read the poll-schedule artifact. Wait until the current pass's retreat time.
2. **Fetch `rmpa.org/scores`** — parse for **all** recap links for the current season year (not just today's date).
3. **No new or changed recap links?** → sleep 60 seconds, retry. Timeout after 2 hours past retreat time → open GitHub issue.
4. **For each recap link** (today's show first, then any others that are new or changed):
   a. Download the HTML from `recaps.competitionsuite.com/<uuid>.htm`.
   b. Compute content hash — SHA-256 of the HTML body.
   c. Compare hash against `season.json`:
      - New URL (first import): proceed to step 5.
      - Known URL, **hash unchanged**: skip.
      - Known URL, **hash changed**: proceed to step 5 (re-import with updated content).
5. **Import:**
   a. Save HTML to `data/scores/<year>/` (overwrite previous version for this show)
   b. Run `npx tsx src/import.ts` on the file
   c. Run validation gates
   d. All gates pass: commit to `main` with updated show JSON + season.json (including new hash)
   e. Any gate fails: open GitHub issue, do not commit
6. **Post-import cool-down:** continue polling for 15 more minutes to catch rapid corrections (hash changes), then proceed to next pass or exit.

**Republish handling (e.g., State Finals week):** Step 2 fetches all season links, not just today's. If RMPA republishes the entire season after Finals, the loop in step 4 processes every link: previously imported shows with unchanged hashes are skipped instantly, any corrections are re-imported, and the new Finals show is imported. This may produce multiple commits in a single run — one per changed/new show.

### Post-Import Cool-Down

After a successful import, the poller doesn't immediately stop. It continues checking for **15 minutes** after the last successful commit. This catches the common pattern where scores are posted, then a quick correction is made within minutes (e.g., a penalty was entered wrong). After 15 minutes with no hash change, the pass ends.

### Polling Strategy

- **Single workflow run** dispatched at the first retreat time, runs through all passes sequentially.
- Internal loop: sleep 60 seconds between checks.
- **Max runtime per pass:** 2 hours after retreat time. GitHub Actions allows up to 6 hours per job, which accommodates even a split show (2 passes × 2 hours + gap between retreats).
- **Cost:** ~3–4 hours of Actions minutes on split-retreat days, ~2 hours on normal days. ~8 shows per season = ~20 hours total. Well within free tier.

---

## Stage 3: Sunday Reconciliation

### Trigger

GitHub Actions cron: Sunday at 12:00 PM MT (18:00 UTC).

### Purpose

Catch score corrections made after competition day. It's common for directors to contact RMPA about scoring errors, which may be corrected on Sunday. Also serves as a safety net for anything Stage 2 missed.

### Steps

1. **Identify this weekend's shows** — look at `season.json` for shows with dates in the last 2 days.
2. **Fetch `rmpa.org/scores`** — also check for any new recap links not yet in `season.json` (catches missed shows).
3. **For each known show from this weekend:** download the recap HTML and compute the content hash.
4. **Compare hashes** — if any show's content has changed since the last import, re-import it.
5. **Commit all changes** in a single commit (may include multiple show updates).

### Scope

- Only processes shows from the current weekend (last 2 days).
- Does not re-check older shows — corrections more than a day later are rare and handled by the daily fallback.

---

## Stage 4: Daily Fallback

### Trigger

GitHub Actions cron: daily at 12:00 PM MT (18:00 UTC), Monday through Friday.

### Steps

1. **Fetch `rmpa.org/scores`** — check for any new recap links not in `season.json`.
2. **For any recent shows (last 7 days):** re-download and hash-compare to catch late corrections.
3. **New or changed content:** import, validate, commit.

### What This Catches

- Friday prelims that the schedule watcher missed entirely
- Scores posted late (e.g., Sunday evening, Monday)
- Schedule watcher failures (no poll-schedule artifact)
- Mid-week corrections to recent shows
- Any competition not on the expected schedule (makeup shows, etc.)

---

## Validation Gates

These gates replace human review. All must pass before auto-committing.

### Gate 1: Schema Validation

- Parsed JSON matches the expected show file schema
- All required fields present: `name`, `date`, `venue`, `classes`, ensemble entries with `rank`, `total`, `captions`
- Correct types: strings are strings, numbers are numbers, no `null` where not expected

### Gate 2: Score Range Checks

- All raw sub-caption scores: 0–100
- All caption totals: 0 ≤ total ≤ caption max points (per era definition)
- Overall totals: 0 ≤ total ≤ 100
- Penalties: ≥ 0
- Ranks: positive integers, sequential within each class (1, 2, 3, …)
- No `NaN`, no `undefined`, no negative scores

### Gate 3: Caption Structure

- Number of captions matches the expected era for the year (e.g., 4 captions for 2016+ marching, 2 for concert)
- Caption keys match era definition (`em`, `ev`, `m`, `v` for Era 2 marching; `eff`, `mus` for concert)
- Sub-caption keys match era definition

### Gate 4: Ensemble Resolution

- Every ensemble name in the parsed data resolves against `public/data/ensembles.json` (exact match, alias match, or fuzzy match above confidence threshold)
- **Unresolved names do NOT block the commit** — they are flagged in the commit message and a GitHub issue is opened to update the ensemble registry, but the show data is still published (with the raw name from the HTML)
- Rationale: new ensembles appear occasionally and shouldn't block score publication

### Gate 5: Change Detection & Deduplication

- Handled by content hashing (see "Content Hashing" section above)
- **New URL:** check for date + venue collision with existing shows in `season.json`. If collision found, treat as a URL change (update the existing entry, don't create a duplicate). Otherwise proceed with first import.
- **Known URL, hash changed:** proceed with re-import (content was updated — split retreat or correction)
- **Known URL, hash unchanged:** skip — not an error, just no new data
- **Missing URL (previously known show not on `rmpa.org/scores`):** do nothing — never delete imported data (see "Additive-Only Principle")

### Gate 6: Test Suite

- Run `npx vitest run` — all existing tests must pass
- Run `npm run build` — TypeScript compilation must succeed

### Gate 7: Data Consistency

- Sub-caption scores, when applied to the era's point formula, produce totals that match the parsed caption totals (within ±0.05 for floating-point tolerance)
- Caption totals sum to the parsed sub-total (within ±0.05)
- Sub-total minus penalty equals the parsed final total

---

## Auto-Commit to `main`

### Branch Protection Bypass

The `main` branch is protected and requires PRs. To allow the automation to push directly:

**Option A (recommended): Ruleset bypass actor**
- In GitHub repo Settings → Rules → Rulesets, add the GitHub Actions bot as a bypass actor
- Scoped to only the automation workflow (not all Actions)

**Option B: Dedicated GitHub App**
- Create a GitHub App with `contents: write` permission
- Generate an installation token in the workflow
- More auditable but heavier setup

### Commit Format

**New show (first import):**
```
chore(data): add scores for <event-name> (<date>)

Source: <competitionsuite-url>
Classes: <list of classes with scores>
Ensembles: <count> ensembles across <count> classes

Unresolved ensemble names: <list, if any>

Automated by: score-ingestion-pipeline
```

**Updated show (split retreat partial → full, or score correction):**
```
chore(data): update scores for <event-name> (<date>)

Source: <competitionsuite-url>
Reason: <"full recap now available" | "score correction detected">
Classes before: <count> → Classes after: <count>
Hash: <old-hash> → <new-hash>

Automated by: score-ingestion-pipeline
```

### Files Changed Per Commit

- `public/data/<year>/<show-id>.json` — new or updated show data file
- `public/data/<year>/season.json` — new show entry or updated `sourceHash` / `lastImportedUtc`
- `data/scores/<year>/<filename>.htm` — archived source HTML (overwritten on updates)
- `public/data/ensembles.json` — updated if new fuzzy matches were confirmed

---

## GitHub Issues (Failure Mode)

When any validation gate fails or scores aren't found within the timeout window, the pipeline opens a GitHub issue instead of committing.

### Issue Format

```
Title: [Score Pipeline] <failure type> — <event name> (<date>)

Body:
## What happened
<description of the failure>

## Details
- Event: <event name>
- Date: <date>
- Source URL: <competitionsuite url, if available>
- Failed gate: <gate name>
- Error details: <specific validation errors>

## Raw data
<attached or linked parsed JSON for debugging>

## Action needed
<suggested manual steps to resolve>
```

### Issue Labels

- `score-pipeline` — all pipeline issues
- `validation-failure` — gate failures
- `missing-scores` — timeout waiting for scores
- `new-ensemble` — unresolved ensemble names

---

## Implementation Components

### 1. Score Page Scraper (`src/pipeline/scrapeScores.ts`)

Fetches `rmpa.org/scores` and extracts recap entries.

```typescript
type RecapEntry = {
  date: string        // "March, 29 2025"
  eventName: string   // "RMPA State Championships"
  recapUrl: string    // "http://recaps.competitionsuite.com/<uuid>.htm"
  year: number        // 2025
}
```

- Parse the `<ul>` structure under each year heading
- Extract `<a>` href for the recap URL
- Extract date from link text, event name from adjacent text node
- Return all entries for the current season year

### 2. Schedule Scraper (`src/pipeline/scrapeSchedule.ts`)

Fetches `rmpa.org/competitions` and schedule pages to determine retreat times.

```typescript
type RetreatInfo = {
  label: string       // "Regional A Retreat/Critique" or "Retreat/Critique"
  timeUtc: string     // ISO 8601
  isFinal: boolean    // true for the last retreat of the day
}

type UpcomingEvent = {
  date: string              // "2026-02-14"
  dayOfWeek: string         // "Saturday"
  eventName: string         // "Regular Season Show #1"
  scheduleUrl: string       // CompetitionSuite schedule URL
  retreats: Array<RetreatInfo>
}
```

- Parse `rmpa.org/competitions` for event dates and schedule links
- Fetch each schedule page
- Scan `schedule-row` elements for all retreat entries (may be multiple for split shows)
- Mark the last retreat as `isFinal: true`
- Extract times, convert to UTC

### 3. Content Hasher (`src/pipeline/contentHash.ts`)

Computes and compares SHA-256 hashes of recap HTML content.

```typescript
type HashComparison = {
  status: 'new' | 'changed' | 'unchanged'
  currentHash: string
  previousHash: string | null
}
```

- Hash the HTML body (strip any non-deterministic elements like timestamps if needed)
- Compare against `sourceHash` in `season.json`
- Return status to drive import/skip decisions

### 4. Validation Module (`src/pipeline/validate.ts`)

Runs all validation gates on parsed show data.

```typescript
type ValidationResult = {
  passed: boolean
  gates: Array<{
    name: string
    passed: boolean
    errors: Array<string>
  }>
}
```

### 5. Auto-Commit Module (`src/pipeline/commit.ts`)

Handles git operations: stage files, commit with formatted message, push to `main`.

- Distinguishes between "add" (new show) and "update" (changed content) commit messages
- Includes hash values in commit message for auditability

### 6. Issue Reporter (`src/pipeline/reportIssue.ts`)

Opens GitHub issues via `gh issue create` when failures occur.

### 7. GitHub Actions Workflows

- `.github/workflows/schedule-watcher.yml` — Thu/Fri/Sat 2 PM MT cron, runs Stage 1
- `.github/workflows/score-poller.yml` — Dispatched on competition days, runs Stage 2 (multi-pass)
- `.github/workflows/sunday-reconciliation.yml` — Sunday noon MT cron, runs Stage 3
- `.github/workflows/score-fallback.yml` — Mon–Fri noon MT cron, runs Stage 4

---

## Season Lifecycle

### Season Start (January–February)

1. Create `public/data/<year>/season.json` with empty show list and known class list
2. Ensure `rmpa.org/competitions` has the new season's events listed
3. Pipeline begins watching automatically

### During Season (February–April)

- Pipeline runs autonomously each competition weekend
- ~8 regular season shows + prelims + finals = ~10 shows per season
- Split-retreat shows may produce 2 commits per show (partial → full)
- Sunday reconciliation catches corrections
- Daily fallback catches anything else
- GitHub issues surface any problems requiring manual attention

### Off-Season (May–January)

- No competitions = no scores posted = pipeline exits cleanly each day
- Daily fallback check is essentially a no-op (no new links on `rmpa.org/scores`)
- Schedule watcher finds no upcoming events

---

## Bootstrapping Historical Data

Historical HTML files are already downloaded in `data/scores/2015–2025`. These are imported using the existing `npx tsx src/import.ts` CLI — not through the automated pipeline. The pipeline only handles new scores going forward.

---

## Open Questions

| Question | Status |
|----------|--------|
| Exact cron schedule for GitHub Actions (timezone handling) | To be determined during implementation — MT offset changes with DST |
| Whether to store poll-schedule as a committed file or workflow artifact | Committed file is simpler and debuggable; artifact avoids repo noise |
| Rate limiting on rmpa.org — is polling every 1–2 min acceptable? | Likely fine for a single requester; add polite User-Agent header |
| How to handle mid-season class changes or new classes appearing | Existing parser handles dynamically; validation should not hardcode class lists |
