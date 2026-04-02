# Automated Score Pipeline — Operator Guide

Automated pipeline that detects new RMPA scores, downloads and parses them, validates the data, and commits to `main` for automatic deployment via Cloudflare Pages.

For the full design rationale, see [`docs/designs/AUTO_SCORE_PIPELINE.md`](../../docs/designs/AUTO_SCORE_PIPELINE.md).
For the implementation plan, see [`docs/plans/pipeline-implementation-plan.md`](../../docs/plans/pipeline-implementation-plan.md).

---

## Season Checklist

### Pre-Season Setup (late January)

The `season-lifecycle.yml` workflow automatically files a GitHub issue on **January 25** with these instructions. You can also run it manually via `workflow_dispatch` with the `enable` action.

1. **Create the season data directory** (if it doesn't exist):

   ```bash
   mkdir -p public/data/<YEAR>
   ```

2. **Create `season.json`** for the new year:

   ```json
   {
     "year": <YEAR>,
     "shows": [],
     "classes": []
   }
   ```

3. **Reset `poll-state.json`** for the new season:

   ```json
   {
     "season": <YEAR>,
     "retreats": [],
     "coolDownUntilUtc": null
   }
   ```

4. **Verify `rmpa.org/competitions`** has the new season's events and schedule links published.

5. **Enable the season workflows:**

   ```bash
   gh workflow enable schedule-watcher.yml
   gh workflow enable score-poller.yml
   gh workflow enable sunday-reconciliation.yml
   gh workflow enable score-fallback.yml
   ```

6. **Verify** the workflows appear as enabled on the Actions tab with their next scheduled run times.

### Post-Season Teardown (late April)

The `season-lifecycle.yml` workflow automatically files a GitHub issue on **April 30** with these instructions. You can also run it manually via `workflow_dispatch` with the `disable` action.

1. **Disable the season workflows:**

   ```bash
   gh workflow disable schedule-watcher.yml
   gh workflow disable score-poller.yml
   gh workflow disable sunday-reconciliation.yml
   gh workflow disable score-fallback.yml
   ```

2. **Review open `score-pipeline` issues** — close any that are no longer relevant.

3. **`season-lifecycle.yml` stays enabled year-round.** It will file the next enable issue on January 25.

---

## How the Pipeline Works

### Stages

| Stage | Workflow | Schedule | Purpose |
|-------|----------|----------|---------|
| 1 | `schedule-watcher.yml` | Thu/Fri/Sat 2 PM MT | Fetch competition schedules, parse retreat times, update `poll-state.json` |
| 2 | `score-poller.yml` | Every 3 min, Fri/Sat evenings MT | Check for new/changed scores — exits in seconds when nothing to do |
| 3 | `sunday-reconciliation.yml` | Sunday noon MT | Re-check weekend recaps for score corrections |
| 4 | `score-fallback.yml` | Mon–Fri noon MT | Catch anything the other stages missed |
| 5 | `season-lifecycle.yml` | Jan 25 + Apr 30 | File enable/disable issues (always enabled) |

### Data Flow

```
rmpa.org/competitions → Schedule Watcher → poll-state.json
                                                ↓
rmpa.org/scores → Score Poller → parse → validate → commit to main
                                                         ↓
                                              Cloudflare Pages deploys
```

### Key Files

| File | Purpose |
|------|---------|
| `public/data/poll-state.json` | Tracks retreat times, import status, and cool-down windows |
| `public/data/<year>/season.json` | Season metadata — show list with `sourceHash` for change detection |
| `public/data/<year>/<show-id>.json` | Per-show score data (served as static assets) |
| `data/scores/<year>/*.html` | Archived source HTML from CompetitionSuite |

---

## DST Handling

All cron-based workflows use **dual cron entries** — one for MST (UTC−7, early season) and one for MDT (UTC−6, mid-March onward). A DST guard script runs first and skips the invocation if the wrong cron fired.

This is automatic — no manual action needed at the DST boundary.

---

## Troubleshooting

### Pipeline filed a "Validation failure" issue

A show's parsed data failed one of the validation gates. The issue body lists which gate failed and the specific errors.

**Common causes:**
- New class appeared that doesn't match the expected caption structure → check if the era definition needs updating
- Ensemble name parsing produced unexpected characters → manual import with `npx tsx src/import.ts`
- Score math doesn't add up (caption totals ≠ overall total) → may be a CompetitionSuite formatting issue

### Pipeline filed a "Scores not posted" issue

Scores weren't detected within 2 hours of the scheduled retreat time.

**Common causes:**
- Show was delayed or cancelled — check `rmpa.org/scores` manually
- Retreat time on the schedule was wrong — the Sunday reconciliation or daily fallback will catch it when scores eventually appear
- Score poller cron was disabled — re-enable it

### Scores were posted but not picked up

1. Check if `poll-state.json` has a `pending` retreat for the show date
2. If not, the schedule watcher may not have run — trigger it manually: Actions → Schedule Watcher → Run workflow
3. Check if the retreat time in `poll-state.json` is correct (scores are posted after retreat)
4. Run the fallback manually: Actions → Score Fallback → Run workflow

### Manual import

If the pipeline can't handle a show, import it manually:

```bash
# Download the recap HTML
curl -o data/scores/<year>/<filename>.html "<competitionsuite-url>"

# Run the import
npx tsx src/import.ts data/scores/<year>/<filename>.html --year <year> --source-url "<competitionsuite-url>"
```

### Viewing pipeline logs

Each workflow run's logs are visible on the GitHub Actions tab. The CLIs log their decision tree:
- "No upcoming events" / "No actionable retreats" → exited early (normal)
- "Fetching..." → checked for scores
- "unchanged" → hash matched, no import needed
- "new" / "changed" → import triggered
- "✓ Validation passed" → committed
- "✗ Validation failed" → issue filed

---

## Architecture

```
src/pipeline/
├── pollState.ts          # Poll state manager (read/write/query)
├── contentHash.ts        # SHA-256 hashing for change detection
├── scrapeScores.ts       # Parse rmpa.org/scores HTML
├── scrapeSchedule.ts     # Parse competition schedules for retreat times
├── validate.ts           # 5 validation gates
├── reportIssue.ts        # GitHub issue filing
├── commit.ts             # Git commit wrappers
├── integration.test.ts   # Full season simulation tests
└── cli/
    ├── dstGuard.ts       # DST-aware cron guard
    ├── watchSchedule.ts  # Stage 1 entry point
    ├── pollScores.ts     # Stage 2 entry point
    ├── reconcile.ts      # Stage 3 entry point
    ├── fallback.ts       # Stage 4 entry point
    └── backfillHashes.ts # One-time hash backfill script
```
