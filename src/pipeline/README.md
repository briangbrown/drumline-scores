# Automated Score Pipeline — Operator Guide

Automated pipeline that detects new RMPA scores, downloads and parses them, validates the data, and commits to `main` for automatic deployment via Cloudflare Pages.

For the full design rationale, see [`docs/designs/AUTO_SCORE_PIPELINE.md`](../../docs/designs/AUTO_SCORE_PIPELINE.md).
For the implementation plan, see [`docs/plans/pipeline-implementation-plan.md`](../../docs/plans/pipeline-implementation-plan.md).

---

## Season Checklist

### Pre-Season Setup (late January) — Automatic

On **January 25**, the `season-lifecycle.yml` workflow automatically:

1. Creates `public/data/<YEAR>/season.json` (if it doesn't exist)
2. Resets `data/poll-state.json` for the new season
3. Commits the changes to `main`
4. Enables all 4 season workflows (`schedule-watcher`, `score-poller`, `sunday-reconciliation`, `score-fallback`)
5. Files a summary issue with a verification checklist

**Your only task:** check the summary issue and verify `rmpa.org/competitions` has the new season's events listed.

You can also trigger this manually: Actions → Season Lifecycle → Run workflow → select `enable`.

### Post-Season Teardown (late April) — Automatic

On **April 30**, the `season-lifecycle.yml` workflow automatically:

1. Disables all 4 season workflows
2. Files a summary issue

**Your only task:** review and close any remaining open `score-pipeline` issues.

`season-lifecycle.yml` stays enabled year-round and will re-enable the pipeline next January.

You can also trigger this manually: Actions → Season Lifecycle → Run workflow → select `disable`.

### Required Secret: `PIPELINE_PAT`

The lifecycle workflow uses a Personal Access Token to enable/disable other workflows (the default `GITHUB_TOKEN` can't do this). The PAT needs the **`actions: write`** and **`contents: write`** scopes.

To set it up:
1. Create a fine-grained PAT at [github.com/settings/tokens](https://github.com/settings/tokens) with `actions: write` and `contents: write` permissions scoped to this repository
2. Add it as a repository secret named `PIPELINE_PAT` at Settings → Secrets and variables → Actions

---

## How the Pipeline Works

### Stages

| Stage | Workflow | Schedule | Purpose |
|-------|----------|----------|---------|
| 1 | `schedule-watcher.yml` | Thu/Fri/Sat 2 PM MT (dual cron for DST) | Fetch schedules, parse retreat times, write poller cron, enable poller |
| 2 | `score-poller.yml` | Dynamic cron (set by schedule watcher) | Poll for new/changed scores during retreat window, self-disables after import |
| 3 | `sunday-reconciliation.yml` | Sunday noon MT (dual cron for DST) | Re-check weekend recaps for score corrections |
| 4 | `score-fallback.yml` | Mon–Fri noon MT (dual cron for DST) | Catch anything the other stages missed |
| 5 | `season-lifecycle.yml` | Jan 25 + Apr 30 | Enable/disable season workflows (always enabled) |

### Dynamic Poller Scheduling

The score poller does **not** use a static cron. Instead:

1. The **schedule watcher** parses retreat times from `rmpa.org/competitions`
2. It computes the exact UTC polling window (retreat time to +2 hours)
3. It rewrites `score-poller.yml`'s cron entry to cover only that window on the correct night
4. It enables the poller workflow and commits both `poll-state.json` and `score-poller.yml`

After a successful import (or when all retreats are resolved), the **poller self-disables**. On weeks with no show, the poller never fires.

This keeps billing low — the poller only runs ~200 times per season instead of ~6,700.

### Data Flow

```
rmpa.org/competitions → Schedule Watcher → poll-state.json + score-poller.yml cron
                                                ↓
                              Score Poller (enabled, fires on cron)
                                                ↓
rmpa.org/scores → download → parse → validate → commit to main → self-disable
                                                         ↓
                                              Cloudflare Pages deploys
```

### Key Files

| File | Purpose |
|------|---------|
| `data/poll-state.json` | Tracks retreat times, import status, and cool-down windows |
| `.github/workflows/score-poller.yml` | Dynamic cron rewritten by the schedule watcher each week |
| `public/data/<year>/season.json` | Season metadata — show list with `sourceHash` for change detection |
| `public/data/<year>/<show-id>.json` | Per-show score data (served as static assets) |
| `data/scores/<year>/*.html` | Archived source HTML from CompetitionSuite |

---

## DST Handling

The **schedule watcher**, **Sunday reconciliation**, and **score fallback** use **dual cron entries** — one for MST (UTC−7, early season) and one for MDT (UTC−6, mid-March onward). A DST guard script runs first and skips the invocation if the wrong cron fired.

The **score poller** does not need DST handling — its cron is dynamically written in UTC by the schedule watcher each week.

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
- Score poller cron was disabled — trigger the schedule watcher manually to re-enable it

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
├── pollerCron.ts         # Compute and write dynamic poller cron schedule
├── contentHash.ts        # SHA-256 hashing for change detection
├── scrapeScores.ts       # Parse rmpa.org/scores HTML
├── scrapeSchedule.ts     # Parse competition schedules for retreat times
├── validate.ts           # 5 validation gates
├── reportIssue.ts        # GitHub issue filing
├── commit.ts             # Git commit wrappers
├── integration.test.ts   # Full season simulation tests
├── pollerCron.test.ts    # Cron computation tests
└── cli/
    ├── dstGuard.ts       # DST-aware cron guard (used by watcher, reconciler, fallback)
    ├── watchSchedule.ts  # Stage 1 — parse schedules, write poller cron, enable poller
    ├── pollScores.ts     # Stage 2 — poll for scores, self-disable when done
    ├── reconcile.ts      # Stage 3 entry point
    ├── fallback.ts       # Stage 4 entry point
    └── backfillHashes.ts # One-time hash backfill script
```
