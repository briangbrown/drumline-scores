/**
 * Schedule Watcher CLI — Stage 1
 *
 * Fetches rmpa.org/competitions, parses schedule pages for retreat times,
 * and updates poll-state.json with pending retreat entries. Also rewrites
 * the score-poller cron schedule to match the retreat window and enables
 * the poller workflow.
 *
 * Usage: npx tsx src/pipeline/cli/watchSchedule.ts [--dry-run]
 */

import { readPollState, writePollState, addOrUpdateRetreat, makeRetreatEntry, emptyPollState } from '../pollState'
import { parseCompetitionsPage, parseScheduleRetreats, localTimeToUtc, filterUpcomingEvents } from '../scrapeSchedule'
import { writePollerCron, POLLER_WORKFLOW_PATH } from '../pollerCron'
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const POLL_STATE_PATH = 'data/poll-state.json'
const COMPETITIONS_URL = 'https://rmpa.org/competitions'
const WINDOW_DAYS = 3

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.text()
}

async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run')
  const now = new Date()

  console.log(`[Schedule Watcher] ${now.toISOString()} — checking for upcoming events`)

  // Read or initialize poll state
  let state = existsSync(POLL_STATE_PATH)
    ? readPollState(POLL_STATE_PATH)
    : emptyPollState(now.getFullYear())

  // Fetch and parse competitions page
  console.log(`Fetching ${COMPETITIONS_URL}...`)
  const competitionsHtml = await fetchText(COMPETITIONS_URL)
  const allEvents = parseCompetitionsPage(competitionsHtml)
  console.log(`Found ${allEvents.length} total events`)

  // Filter to upcoming events
  const upcoming = filterUpcomingEvents(allEvents, now, WINDOW_DAYS)
  if (upcoming.length === 0) {
    console.log('No upcoming events in the next 3 days')
    return
  }

  console.log(`${upcoming.length} upcoming event(s):`)
  for (const event of upcoming) {
    console.log(`  ${event.date} — ${event.eventName}`)

    if (!event.scheduleUrl) {
      console.log('    ⚠ No schedule URL published yet')
      continue
    }

    // Fetch and parse schedule page
    console.log(`    Fetching schedule...`)
    const scheduleHtml = await fetchText(event.scheduleUrl)
    const retreats = parseScheduleRetreats(scheduleHtml)

    if (retreats.length === 0) {
      console.log('    ⚠ No retreat entries found on schedule')
      continue
    }

    for (const retreat of retreats) {
      const utc = localTimeToUtc(event.date, retreat.localTime)
      const entry = makeRetreatEntry(event.date, `${event.eventName} — ${retreat.label}`, utc)

      const oldRetreat = state.retreats.find(
        (r) => r.date === entry.date && r.retreatUtc === entry.retreatUtc,
      )

      state = addOrUpdateRetreat(state, entry)

      const statusLabel = oldRetreat ? 'updated' : 'added'
      console.log(`    ${retreat.label}: ${retreat.localTime} MT → ${utc} (${statusLabel})`)
    }
  }

  // Write updated state and poller cron
  if (isDryRun) {
    console.log('\n[Dry run] Would write poll-state.json:')
    console.log(JSON.stringify(state, null, 2))
  } else {
    writePollState(POLL_STATE_PATH, state)
    console.log('\nUpdated poll-state.json')

    // Rewrite poller cron to match retreat window
    const cronChanged = writePollerCron(state.retreats)
    if (cronChanged) {
      console.log(`Updated ${POLLER_WORKFLOW_PATH} with new cron schedule`)
    } else {
      console.log('Poller cron unchanged')
    }

    // Enable the poller if there are pending retreats
    const hasPending = state.retreats.some((r) => r.status === 'pending')
    if (hasPending) {
      try {
        execSync('gh workflow enable score-poller.yml', { stdio: 'inherit' })
        console.log('Enabled score-poller workflow')
      } catch {
        console.log('⚠ Could not enable score-poller (may already be enabled)')
      }
    }
  }
}

export { main, POLL_STATE_PATH, COMPETITIONS_URL }

const isDirectRun = process.argv[1]?.endsWith('watchSchedule.ts') ?? false
if (isDirectRun) {
  main().catch((err) => {
    console.error('[Schedule Watcher] Fatal error:', err)
    process.exit(1)
  })
}
