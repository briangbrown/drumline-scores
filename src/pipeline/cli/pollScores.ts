/**
 * Score Poller CLI — Stage 2
 *
 * Lightweight per-invocation poller. Reads poll-state.json, checks if there
 * are actionable retreats or an active cool-down, and exits immediately if
 * not. When scores are expected, fetches rmpa.org/scores, compares hashes,
 * and imports new/changed recaps.
 *
 * Usage: npx tsx src/pipeline/cli/pollScores.ts [--dry-run]
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { execSync } from 'node:child_process'
import {
  readPollState,
  writePollState,
  findActionableRetreats,
  isCoolDownActive,
  hasWork,
  markRetreatImported,
  markRetreatFailed,
} from '../pollState'
import { parseScorePage, filterByYear } from '../scrapeScores'
import { hashContent, compareHash } from '../contentHash'
import { validateShowData } from '../validate'
import { parseRecapHtml } from '../../parser'
import { formatIssueBody } from '../reportIssue'
import type { IssueFailure } from '../reportIssue'
import type { SeasonMetadata } from '../../types'

const POLL_STATE_PATH = 'data/poll-state.json'
const SCORES_URL = 'https://rmpa.org/scores'

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.text()
}

function readSeasonJson(year: number): SeasonMetadata | null {
  const path = `public/data/${year}/season.json`
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8')) as SeasonMetadata
}

function getStoredHash(season: SeasonMetadata, recapUrl: string): string | null {
  // Check if any show entry has this source URL
  for (const show of season.shows) {
    const entry = show as Record<string, unknown>
    if (entry['sourceUrl'] === recapUrl) {
      return (entry['sourceHash'] as string) ?? null
    }
  }
  return null
}

async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run')
  const now = new Date()

  // Step 1: Read poll state
  if (!existsSync(POLL_STATE_PATH)) {
    console.log('[Score Poller] No poll-state.json — exiting')
    return
  }

  let state = readPollState(POLL_STATE_PATH)

  // Step 2: Check for work
  if (!hasWork(state, now)) {
    // No actionable retreats and no cool-down — exit immediately
    return
  }

  const actionable = findActionableRetreats(state, now)
  const hasCoolDown = isCoolDownActive(state, now)
  console.log(`[Score Poller] ${now.toISOString()} — ${actionable.length} actionable retreat(s), cool-down: ${hasCoolDown}`)

  // Step 3: Fetch scores page
  console.log(`Fetching ${SCORES_URL}...`)
  const scoresHtml = await fetchText(SCORES_URL)
  const allEntries = parseScorePage(scoresHtml)
  const seasonEntries = filterByYear(allEntries, state.season)
  console.log(`Found ${seasonEntries.length} recap links for ${state.season}`)

  const season = readSeasonJson(state.season)

  // Step 4: Check each recap for new/changed content
  let imported = false
  for (const entry of seasonEntries) {
    const previousHash = season ? getStoredHash(season, entry.recapUrl) : null
    let recapHtml: string

    try {
      recapHtml = await fetchText(entry.recapUrl)
    } catch (err) {
      console.log(`  ⚠ Failed to fetch ${entry.recapUrl}: ${err}`)
      continue
    }

    const currentHash = hashContent(recapHtml)
    const comparison = compareHash(currentHash, previousHash)

    if (comparison.status === 'unchanged') {
      // Scores exist but haven't changed — mark any actionable retreats as
      // imported so they don't time out (covers the case where an earlier
      // retreat already imported these scores on a previous poller run)
      for (const retreat of actionable) {
        if (retreat.status === 'pending') {
          state = markRetreatImported(state, retreat.retreatUtc, currentHash, now)
        }
      }
      continue
    }

    console.log(`  ${comparison.status}: ${entry.eventName} (${entry.date})`)

    // Step 5: Parse and validate
    const showData = parseRecapHtml(recapHtml, state.season)
    const validation = validateShowData(showData, state.season, season ?? undefined)

    if (!validation.passed) {
      const failures = validation.gates.filter((g) => !g.passed)
      console.log(`  ✗ Validation failed: ${failures.map((f) => f.name).join(', ')}`)

      if (!isDryRun) {
        const failure: IssueFailure = {
          failureType: 'Validation failure',
          eventName: entry.eventName,
          date: entry.date,
          sourceUrl: entry.recapUrl,
          gate: failures[0].name,
          errors: failures.flatMap((f) => f.errors),
          suggestedAction: 'Review the validation errors and manually import if appropriate.',
        }
        console.log(`  Filing issue...`)
        console.log(formatIssueBody(failure))
      }

      // Mark matching retreat as failed
      for (const retreat of actionable) {
        if (retreat.date === entry.date.split(',')[0]) {
          state = markRetreatFailed(state, retreat.retreatUtc)
        }
      }
      continue
    }

    console.log(`  ✓ Validation passed — ${showData.classes.length} classes, ${showData.classes.reduce((s, c) => s + c.ensembles.length, 0)} ensembles`)

    if (isDryRun) {
      console.log(`  [Dry run] Would import and commit`)
    } else {
      // Save HTML
      const htmlDir = `data/scores/${state.season}`
      mkdirSync(htmlDir, { recursive: true })
      const htmlFilename = `${entry.date.replace(/,?\s+/g, '-').toLowerCase()}_${entry.eventName.replace(/\s+/g, '_')}.html`
      const htmlPath = resolve(htmlDir, htmlFilename)
      writeFileSync(htmlPath, recapHtml, 'utf-8')

      // Run import
      console.log(`  Importing ${basename(htmlPath)}...`)
      try {
        execSync(`npx tsx src/import.ts "${htmlPath}" --year ${state.season}`, {
          stdio: 'inherit',
        })
      } catch (err) {
        console.error(`  ✗ Import failed:`, err)
        continue
      }
    }

    imported = true

    // Mark actionable retreats as imported
    for (const retreat of actionable) {
      if (retreat.status === 'pending') {
        state = markRetreatImported(state, retreat.retreatUtc, currentHash, now)
      }
    }
  }

  // Step 7: Timeout check for pending retreats past their window
  for (const retreat of state.retreats) {
    if (retreat.status === 'pending' && now.getTime() >= new Date(retreat.windowCloseUtc).getTime()) {
      console.log(`  ⚠ Timeout: ${retreat.eventName} — scores not posted within 2 hours of retreat`)

      if (!isDryRun) {
        const failure: IssueFailure = {
          failureType: 'Scores not posted within timeout',
          eventName: retreat.eventName,
          date: retreat.date,
          sourceUrl: null,
          gate: null,
          errors: [`No new or changed recap found within 2 hours after retreat at ${retreat.retreatUtc}`],
          suggestedAction: 'Check rmpa.org/scores manually. The recap may have been delayed or the schedule may have changed.',
        }
        console.log(formatIssueBody(failure))
      }

      state = markRetreatFailed(state, retreat.retreatUtc)
    }
  }

  // Write updated state
  if (!isDryRun) {
    writePollState(POLL_STATE_PATH, state)
    if (imported) {
      console.log('Updated poll-state.json (import successful)')
    }
  } else if (imported) {
    console.log('\n[Dry run] Would update poll-state.json')
  }
}

export { main }

const isDirectRun = process.argv[1]?.endsWith('pollScores.ts') ?? false
if (isDirectRun) {
  main().catch((err) => {
    console.error('[Score Poller] Fatal error:', err)
    process.exit(1)
  })
}
