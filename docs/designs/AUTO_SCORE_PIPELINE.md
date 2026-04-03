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
│ 5. Update poll-state.json with retreat times           │
│ 6. Rewrite score-poller.yml cron to match retreat     │
│    window (exact UTC hours + day of week)             │
│ 7. Enable score-poller workflow                        │
│                                                       │
│ Runs: Thu 2 PM, Fri 2 PM, Sat 2 PM Mountain Time     │
│ Catches last-minute reschedules & weather delays      │
└───────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ Stage 2: Score Poller (dynamic cron, set by watcher)┐
│                                                       │
│ Cron is rewritten weekly by the schedule watcher to   │
│ cover only the retreat window (retreat → +2 hrs) on   │
│ the correct UTC night. No DST dual-cron needed.       │
│                                                       │
│ Each run:                                             │
│  1. Read poll-state — any actionable retreats?        │
│     No → exit immediately.                            │
│  2. Fetch rmpa.org/scores — any new/changed links?   │
│     No → exit (light fetch, <15 sec billable).        │
│  3. Download recap HTML, hash, compare, import.       │
│  4. Update poll-state: mark retreat as imported,      │
│     set cool-down expiry for corrections.             │
│  5. Self-disable when no pending retreats remain.     │
│                                                       │
│ On off-weeks the poller stays disabled and never      │
│ fires. ~20 invocations per show night.                │
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

┌─ Stage 5: Seasonal Lifecycle (2 crons, year-round) ──┐
│                                                       │
│ Pre-season (late Jan):                                │
│  File GitHub issue with instructions to enable        │
│  Stages 1–4 workflows.                                │
│                                                       │
│ Post-season (late Apr):                               │
│  File GitHub issue with instructions to disable       │
│  Stages 1–4 workflows.                                │
│                                                       │
│ Runs year-round — only these 2 crons stay enabled     │
│ during the off-season. Each fires once per year.      │
└───────────────────────────────────────────────────────┘
```

---

## Stage 1: Schedule Watcher

### Trigger

Runs **three times** on competition weekends to catch last-minute reschedules:

| Run | When | Why |
|-----|------|-----|
| Thursday | 2:00 PM MT | First look — catches Friday prelims and Saturday shows. Schedules are typically published 1–2 weeks ahead. |
| Friday | 2:00 PM MT | Refresh — picks up any Friday schedule changes before Saturday shows. Also re-checks Friday prelims retreat time if a show is that evening. |
| Saturday | 2:00 PM MT | Final refresh — catches day-of delays (weather, etc.). Runs well before any retreat (earliest main retreats are ~5 PM MT). |

> **DST note:** The cron uses MDT (20:00 UTC). During MST early season this fires at ~1 PM MT instead of 2 PM — acceptable since the watcher just needs to run before evening retreats.

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

Some shows have early Regional A retreats (12:45–1:45 PM). Scores may be posted after the mid-day retreat (partial results) and updated after the final retreat (final results). The watcher adds all retreats to `poll-state.json` with an `isFinal` flag — the last retreat of the day is marked `isFinal: true`. Each retreat gets its own polling window in the cron schedule.

Each run **updates `poll-state.json`** with the latest retreat times, **rewrites `score-poller.yml`** with the exact UTC polling window, **enables the poller workflow**, and commits all changes. The Score Poller reads poll-state on every invocation, and its cron only fires during the computed retreat window.

**Key insight:** Shows are rarely moved _forward_ in time, but sometimes _delayed_ (weather, venue issues). Running the watcher multiple times ensures the retreat UTC timestamps shift later if the schedule changes, and the poller cron is updated to match.

### Steps

1. **Fetch `rmpa.org/competitions`** — extract all event entries with dates and schedule links.
2. **Identify upcoming events** — filter to events occurring in the next 3 days (covers Thursday→Saturday window).
3. **Fetch each schedule page** — download from `schedules.competitionsuite.com/<uuid>_standard.htm`.
4. **Parse retreat times** — scan `schedule-row` entries for "Full Retreat" or similar labels (excluding "Retreat Concludes"). Extract time values, convert to UTC using `America/Denver` timezone. Mark the last retreat of the day as `isFinal: true`.
5. **Update `poll-state.json`** — add or update retreat entries for the upcoming events. Set `status: "pending"` for new retreats. Compute `windowCloseUtc` as retreat time + 2 hours. Entries are matched on `date + eventName` — if a retreat is rescheduled (same event, different time), the existing entry is updated rather than duplicated.
6. **Rewrite `score-poller.yml` cron** — compute one cron entry per pending retreat (each with its own UTC hours and day-of-week). Each cron entry is tagged with a metadata comment (`# retreat:<utc> final:<bool>`) so the poller can identify which window to remove after import. If no retreats are pending, set the cron to a never-firing value.
7. **Enable the score poller workflow** if there are pending retreats.
8. **Commit `poll-state.json` and `score-poller.yml`** to `main`.

### How `poll-state.json` Is Populated

The schedule watcher adds retreat entries to `poll-state.json` based on the parsed schedule data. For a single-retreat show, one entry is added with `isFinal: true`. For a split-retreat show (mid-day Regional A + final), two entries are added — one per retreat, each with its own `retreatUtc`, `windowCloseUtc`, and `isFinal` flag. The poller processes them independently, and when the final retreat is imported, all same-day pending retreats are automatically resolved.

Example after the watcher runs for a weekend with a split-retreat show — see the `poll-state.json` format in [Stage 2: Score Poller](#stage-2-score-poller).

### Edge Cases

- **No schedule published yet:** Log a warning. Thursday/Friday/Saturday runs will retry. The daily fallback will catch the scores regardless.
- **No retreat entry on schedule:** Use the last performance time + 60 minutes as the estimate.
- **Friday prelims:** Thursday run detects them. Friday run refreshes the retreat time before the show that evening.
- **Multiple events in one weekend:** Each gets its own poll window (e.g., prelims Friday evening, finals Saturday evening).
- **Schedule changes between runs:** Each run updates `poll-state.json` and commits it. The Score Poller reads the latest version on every invocation. If the retreat moves later, the polling window shifts automatically. If the retreat moves earlier (rare), the worst case is polling starts a bit late — the daily fallback catches it.

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

### Design Goal

Detect new scores as quickly as possible after retreat, without burning GitHub Actions minutes on idle waiting. Each cron invocation should exit in **seconds** when there is nothing to do.

### Trigger

The score poller uses **dynamic per-retreat cron entries** written by the schedule watcher. Each pending retreat gets its own cron window (retreat time to +2 hours) on its specific UTC day. Metadata comments tag each entry so the poller can identify and remove individual windows after import.

```yaml
on:
  schedule:
    # --- DYNAMIC CRON START ---
    # retreat:2026-02-28T19:45:00.000Z final:false
    - cron: '*/3 19-21 * * 6'
    # retreat:2026-03-01T01:55:00.000Z final:true
    - cron: '*/3 1-3 * * 0'
    # --- DYNAMIC CRON END ---
```

When no show is upcoming, the cron is set to `0 0 31 2 *` (February 31, which never fires) and the workflow is disabled. The schedule watcher re-enables it when it finds pending retreats. After each import, the poller rewrites the cron to remove the completed window. When no pending retreats remain, it **self-disables**.

### State File: `poll-state.json`

A committed file at `data/poll-state.json` tracks what the poller is waiting for and what it has already imported. This is the key to making each invocation lightweight — the poller reads this file first and exits immediately if there is nothing to do.

```json
{
  "season": 2026,
  "retreats": [
    {
      "date": "2026-02-14",
      "eventName": "Regular Season Show #1",
      "retreatUtc": "2026-02-15T00:28:00Z",
      "windowCloseUtc": "2026-02-15T02:28:00Z",
      "status": "imported",
      "sourceHash": "a3f2c8...",
      "lastImportedUtc": "2026-02-15T00:52:00Z"
    },
    {
      "date": "2026-02-28",
      "eventName": "Regular Season Show #3 (Regional A)",
      "retreatUtc": "2026-02-28T20:45:00Z",
      "windowCloseUtc": "2026-02-28T22:45:00Z",
      "status": "imported",
      "sourceHash": "b7d1e4...",
      "lastImportedUtc": "2026-02-28T21:10:00Z"
    },
    {
      "date": "2026-02-28",
      "eventName": "Regular Season Show #3 (Final)",
      "retreatUtc": "2026-03-01T01:55:00Z",
      "windowCloseUtc": "2026-03-01T03:55:00Z",
      "status": "pending",
      "sourceHash": null,
      "lastImportedUtc": null
    }
  ],
  "coolDownUntilUtc": null
}
```

- **`status`:** `"pending"` (awaiting scores), `"imported"` (done), `"failed"` (issue filed)
- **`windowCloseUtc`:** retreat time + 2 hours. After this, the poller files an issue and marks the retreat `"failed"`.
- **`coolDownUntilUtc`:** set to now + 15 minutes after each successful import. The poller keeps checking for rapid corrections until this expires.

### Steps (per invocation)

Each cron invocation runs through this fast decision tree:

1. **Read `poll-state.json`** from the repo.
2. **Find actionable retreats** — any entry where `status === "pending"` and `now >= retreatUtc` and `now < windowCloseUtc`? Also check if `coolDownUntilUtc` is set and not yet expired (still watching for corrections to a recently imported show).
   - **No actionable retreats and no active cool-down** → exit immediately. **Billable time: ~5 seconds** (git checkout + file read).
3. **Fetch `rmpa.org/scores`** — a single lightweight HTTP GET. Parse for recap links for the current season year.
   - **No new or changed links** → exit. **Billable time: ~10–15 seconds.**
4. **For each new or changed recap link:**
   a. Download the recap HTML.
   b. Compute content hash (SHA-256).
   c. Compare hash against `poll-state.json` and `season.json`:
      - **Hash unchanged** → skip.
      - **Hash changed or new URL** → proceed to import.
5. **Import** (only runs when new scores are detected):
   a. Save HTML to `data/scores/<year>/`.
   b. Run `npx tsx src/import.ts` on the file.
   c. Run validation gates.
   d. All gates pass → commit to `main` (show JSON + season.json + updated poll-state).
   e. Any gate fails → open GitHub issue, mark retreat as `"failed"` in poll-state.
6. **Update poll-state:**
   - Mark the retreat as `"imported"`, record `sourceHash` and `lastImportedUtc`.
   - Set `coolDownUntilUtc` to now + 15 minutes.
   - Commit the updated poll-state.
7. **Timeout check:** If `now >= windowCloseUtc` and status is still `"pending"` → file a GitHub issue ("Scores not posted within 2 hours of retreat"), mark as `"failed"`.

### Split-Retreat Shows

Shows with a mid-day Regional A retreat and a later final retreat have **two entries** in `poll-state.json` (one per retreat). Each is processed independently:

- **Mid-day retreat:** Poller picks up the partial recap (Regional A classes only), imports, marks first entry as `"imported"`.
- **Final retreat:** Poller picks up the full recap (all classes), re-imports (overwrites the partial data), marks second entry as `"imported"`.

### Billable Minutes Estimate

With dynamic cron, the poller only fires on actual show nights during the retreat window. Each run bills a minimum of 1 minute.

| Workflow | Runs/season | Billed minutes |
|----------|------------|----------------|
| Score Poller (per-retreat dynamic cron) | ~200 | ~200 |
| Schedule Watcher (single cron, Thu/Fri/Sat) | ~42 | ~42 |
| Score Fallback (single cron, Mon–Fri) | ~70 | ~70 |
| Sunday Reconciliation (single cron) | ~14 | ~14 |
| Season Lifecycle | ~2 | ~2 |
| **Total** | | **~328** |

On off-weeks (no show), the poller is disabled and contributes zero runs.

### Republish Handling (State Finals Week)

Step 3 fetches all season links, not just today's. If RMPA republishes the entire season after Finals, the loop in step 4 processes every link: previously imported shows with unchanged hashes are skipped instantly, any corrections are re-imported, and the new Finals show is imported. This may produce multiple commits in a single run.

### Cool-Down Period

After a successful import, `coolDownUntilUtc` is set to now + 15 minutes. Subsequent cron invocations during this window still proceed to step 3 (fetch `rmpa.org/scores`) and re-check hashes. This catches the common pattern where scores are posted, then quickly corrected (e.g., a penalty was entered wrong). After the cool-down expires and no pending retreats remain, invocations go back to exiting at step 2.

---

## Stage 3: Sunday Reconciliation

### Trigger

GitHub Actions cron: Sunday at ~12:00 PM MT (18:00 UTC — exact at MDT, 1 hour early during MST).

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

GitHub Actions cron: daily at ~12:00 PM MT (18:00 UTC — exact at MDT, 1 hour early during MST), Monday through Friday.

### Steps

1. **Fetch `rmpa.org/scores`** — check for any new recap links not in `season.json`.
2. **For any recent shows (last 7 days):** re-download and hash-compare to catch late corrections.
3. **New or changed content:** import, validate, commit.

### What This Catches

- Friday prelims that the schedule watcher missed entirely
- Scores posted late (e.g., Sunday evening, Monday)
- Schedule watcher failures (no retreat entries in poll-state)
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

### 7. Poll State Manager (`src/pipeline/pollState.ts`)

Reads and updates `data/poll-state.json`. Used by the score poller (Stage 2) to track which retreats are pending, imported, or failed — and whether a cool-down is active.

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
  isFinal: boolean    // true for the last retreat of the day
}

type PollState = {
  season: number
  retreats: Array<RetreatEntry>
  coolDownUntilUtc: string | null
}
```

- Read state file at the start of each poller invocation
- Determine if any retreat is actionable (pending + within window, or cool-down active)
- Update state after import or timeout
- When a final retreat is imported, auto-resolve all same-day pending retreats
- Entries are matched on `date + eventName` — rescheduled retreats update in place
- Committed to the repo alongside show data so it survives across invocations

### 8. GitHub Actions Workflows

- `.github/workflows/schedule-watcher.yml` — Thu/Fri/Sat ~2 PM MT (single MDT cron), runs Stage 1; rewrites poller with per-retreat cron windows and enables poller (disabled off-season)
- `.github/workflows/score-poller.yml` — Per-retreat dynamic cron (rewritten by schedule watcher), runs Stage 2; removes completed windows and self-disables after all imports (disabled off-season and between shows)
- `.github/workflows/sunday-reconciliation.yml` — Sunday ~noon MT (single MDT cron), runs Stage 3 (disabled off-season)
- `.github/workflows/score-fallback.yml` — Mon–Fri ~noon MT (single MDT cron), runs Stage 4 (disabled off-season)
- `.github/workflows/season-lifecycle.yml` — Jan 25 + Apr 30, runs Stage 5 (**always enabled**)

---

## Stage 5: Seasonal Enable/Disable

### Purpose

Stages 1–4 should be **disabled during the off-season** (May–January) to avoid unnecessary cron invocations and billable minutes. A year-round lifecycle workflow automatically enables and disables the season workflows using a PAT with `actions: write` scope (stored as the `PIPELINE_PAT` repository secret).

### Historical Season Dates

| Year | First Show | Last Show |
|------|-----------|-----------|
| 2015 | Feb 28 | Apr 4 |
| 2016 | Feb 27 | Apr 9 |
| 2017 | Feb 18 | Apr 8 |
| 2018 | Feb 24 | Apr 14 |
| 2019 | Feb 16 | Apr 6 |
| 2020 | Feb 15 | Feb 29 (COVID) |
| 2021 | Mar 5 | Apr 9 (COVID) |
| 2022 | Feb 19 | Apr 16 |
| 2023 | Feb 18 | Apr 15 |
| 2024 | Feb 10 | Apr 13 |
| 2025 | Feb 8 | Mar 29 |

**Pattern:** Seasons start as early as **February 8** and end as late as **April 16**. Two weeks of buffer gives:

- **Enable by:** January 25 (2 weeks before earliest known start)
- **Disable after:** April 30 (2 weeks after latest known end)

### Workflow: `season-lifecycle.yml`

A single workflow with **two cron entries** that runs year-round. It is the only workflow that stays enabled during the off-season.

```yaml
name: Season Lifecycle
on:
  schedule:
    # Pre-season: January 25 at noon MT
    # MST (Jan is always MST): noon = 19:00 UTC
    - cron: '0 19 25 1 *'
    # Post-season: April 30 at noon MT
    # MDT (Apr is always MDT): noon = 18:00 UTC
    - cron: '0 18 30 4 *'

jobs:
  lifecycle:
    runs-on: ubuntu-latest
    steps:
      - name: Determine action
        id: action
        run: |
          MONTH=$(date +%-m)
          if [ "$MONTH" = "1" ]; then
            echo "type=enable" >> "$GITHUB_OUTPUT"
          elif [ "$MONTH" = "4" ]; then
            echo "type=disable" >> "$GITHUB_OUTPUT"
          fi

      - name: File enable issue
        if: steps.action.outputs.type == 'enable'
        run: |
          YEAR=$(date +%Y)
          gh issue create \
            --title "[Score Pipeline] Enable season workflows for $YEAR" \
            --label "score-pipeline" \
            --body "$(cat <<'ISSUE_EOF'
          ## Action needed

          The RMPA season typically begins in early-to-mid February. Enable the score ingestion workflows so the pipeline is ready before the first competition.

          ### Steps

          1. Go to **Actions** → each workflow listed below → **Enable workflow** (or use the `gh` CLI commands below)
          2. Create `public/data/$YEAR/season.json` with empty show list if it doesn't exist yet
          3. Verify `rmpa.org/competitions` has the new season's events listed

          ### Workflows to enable

          | Workflow | File |
          |----------|------|
          | Schedule Watcher | `schedule-watcher.yml` |
          | Score Poller | `score-poller.yml` |
          | Sunday Reconciliation | `sunday-reconciliation.yml` |
          | Score Fallback | `score-fallback.yml` |

          ### CLI commands

          ```bash
          gh workflow enable schedule-watcher.yml
          gh workflow enable score-poller.yml
          gh workflow enable sunday-reconciliation.yml
          gh workflow enable score-fallback.yml
          ```

          ### Verify

          After enabling, check that the next scheduled runs appear on the Actions tab for each workflow.

          ---
          *Filed automatically by the season lifecycle workflow.*
          ISSUE_EOF
          )"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: File disable issue
        if: steps.action.outputs.type == 'disable'
        run: |
          YEAR=$(date +%Y)
          gh issue create \
            --title "[Score Pipeline] Disable season workflows — $YEAR season complete" \
            --label "score-pipeline" \
            --body "$(cat <<'ISSUE_EOF'
          ## Action needed

          The RMPA season has ended (finals typically mid-April). Disable the score ingestion workflows to avoid unnecessary cron invocations during the off-season.

          ### Steps

          1. Go to **Actions** → each workflow listed below → **Disable workflow** (or use the `gh` CLI commands below)
          2. Confirm no pending score-pipeline issues remain open

          ### Workflows to disable

          | Workflow | File |
          |----------|------|
          | Schedule Watcher | `schedule-watcher.yml` |
          | Score Poller | `score-poller.yml` |
          | Sunday Reconciliation | `sunday-reconciliation.yml` |
          | Score Fallback | `score-fallback.yml` |

          ### CLI commands

          ```bash
          gh workflow disable schedule-watcher.yml
          gh workflow disable score-poller.yml
          gh workflow disable sunday-reconciliation.yml
          gh workflow disable score-fallback.yml
          ```

          ### What stays enabled

          The **Season Lifecycle** workflow (`season-lifecycle.yml`) stays enabled year-round. It will file another enable issue next January.

          ---
          *Filed automatically by the season lifecycle workflow.*
          ISSUE_EOF
          )"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Required Secret: `PIPELINE_PAT`

The pipeline uses a fine-grained Personal Access Token (stored as the `PIPELINE_PAT` repository secret) to enable/disable workflows and push changes to workflow files (`.github/workflows/`). The default `GITHUB_TOKEN` cannot do either.

**Setup:** Create a fine-grained PAT at [github.com/settings/tokens](https://github.com/settings/tokens) with `actions: write`, `contents: write`, and `workflows: write` permissions scoped to this repository. Add it as a repository secret named `PIPELINE_PAT`.

---

## Season Lifecycle

### Season Start (late January) — Automatic

The lifecycle workflow automatically:

1. Creates `public/data/<year>/season.json` if it doesn't exist
2. Resets `data/poll-state.json` for the new season
3. Commits the changes to `main`
4. Enables Stages 1–4 workflows via the `PIPELINE_PAT`
5. Files a summary issue with a verification checklist
6. Pipeline begins watching automatically when the first competition weekend arrives

### During Season (February–April)

- Pipeline runs autonomously each competition weekend
- ~8 regular season shows + prelims + finals = ~10 shows per season
- Split-retreat shows may produce 2 commits per show (partial → full)
- Sunday reconciliation catches corrections
- Daily fallback catches anything else
- GitHub issues surface any problems requiring manual attention

### Off-Season (May–January) — Automatic

- **Season lifecycle workflow** disables Stages 1–4 workflows and files a summary issue (April 30)
- Only the season lifecycle workflow remains enabled (2 cron entries, fires once each in January and April)
- **Zero billable minutes** from Stages 1–4 during the off-season

---

## Bootstrapping Historical Data

Historical HTML files are already downloaded in `data/scores/2015–2025`. These are imported using the existing `npx tsx src/import.ts` CLI — not through the automated pipeline. The pipeline only handles new scores going forward.

---

## DST Handling & GitHub Actions Cron

### Background

The RMPA season runs February through April. Daylight Saving Time begins the **second Sunday of March**, shifting Mountain Time from MST (UTC−7) to MDT (UTC−6). GitHub Actions cron expressions are **always evaluated in UTC**.

### Approach: Single MDT Cron

All static-schedule workflows use a **single cron entry** based on MDT (UTC−6). During the early season (MST, UTC−7) they run approximately 1 hour earlier in Mountain Time. This is acceptable because:

- **Schedule watcher:** Running at 1 PM instead of 2 PM is harmless — it just checks for schedule updates earlier.
- **Sunday reconciliation & daily fallback:** Running at 11 AM instead of noon has no functional impact.
- **Score poller:** Uses per-retreat dynamic cron written in exact UTC, so DST is irrelevant.

This eliminates the need for dual cron entries and DST guard scripts, halving the number of workflow invocations for static-schedule workflows.

### Cron Summary

| Workflow | Target (MT) | Cron (UTC) |
|----------|------------|------------|
| `schedule-watcher.yml` | Thu/Fri/Sat ~2 PM | `0 20 * * 4,5,6` |
| `score-poller.yml` | Dynamic (per-retreat) | *Rewritten by watcher* |
| `sunday-reconciliation.yml` | Sun ~noon | `0 18 * * 0` |
| `score-fallback.yml` | Mon–Fri ~noon | `0 18 * * 1-5` |
| `season-lifecycle.yml` | Jan 25 + Apr 30, noon | `0 19 25 1 *` / `0 18 30 4 *` |

> **Note on the score poller cron:** The poller's cron is dynamically written by the schedule watcher using exact UTC from retreat times. Each pending retreat gets its own cron entry with metadata comments for targeted removal. Example: retreat at 8:07 PM MDT Saturday → cron `*/3 2-4 * * 0` (every 3 min, hours 2–4 UTC, Sunday). The poller removes completed windows after each import and self-disables when done.

The retreat times in `poll-state.json` are stored as **UTC timestamps** (ISO 8601), so they are inherently DST-safe. The schedule scraper converts local times from the CompetitionSuite schedule page to UTC using the `America/Denver` timezone at parse time, which correctly accounts for whichever offset is in effect on the event date.

The dual-cron approach keeps times exact and predictable at the cost of a few extra lines of YAML. Given that each workflow is a distinct file with its own schedule block, the overhead is minimal.

---

## Open Questions

| Question | Status |
|----------|--------|
| Rate limiting on rmpa.org — is polling every ~3 min acceptable? | Likely fine for a single requester; add polite User-Agent header |
| How to handle mid-season class changes or new classes appearing | Existing parser handles dynamically; validation should not hardcode class lists |
