/**
 * Compute and write the score-poller cron schedule based on retreat times.
 *
 * The schedule watcher calls this after parsing retreat times. It rewrites
 * the score-poller.yml cron entry to cover only the actual polling window
 * (retreat time to +2 hours), on the correct UTC day of week.
 *
 * This eliminates DST dual-cron and avoids polling on off-nights.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import type { RetreatEntry } from './pollState'

const POLLER_WORKFLOW_PATH = '.github/workflows/score-poller.yml'

// Marker comments in the YAML that bracket the dynamic cron line
const CRON_START_MARKER = '# --- DYNAMIC CRON START ---'
const CRON_END_MARKER = '# --- DYNAMIC CRON END ---'

type CronWindow = {
  startHourUtc: number
  endHourUtc: number
  daysOfWeekUtc: Array<number>
}

/**
 * Compute the polling window from pending retreat entries.
 * Returns null if there are no pending retreats.
 */
function computeCronWindow(retreats: Array<RetreatEntry>): CronWindow | null {
  const pending = retreats.filter((r) => r.status === 'pending')
  if (pending.length === 0) return null

  // Find the earliest retreat start and latest window close
  let earliestUtcMs = Infinity
  let latestUtcMs = -Infinity
  const daysSet = new Set<number>()

  for (const retreat of pending) {
    const retreatMs = new Date(retreat.retreatUtc).getTime()
    const closeMs = new Date(retreat.windowCloseUtc).getTime()
    earliestUtcMs = Math.min(earliestUtcMs, retreatMs)
    latestUtcMs = Math.max(latestUtcMs, closeMs)

    // Collect all UTC days the window spans
    const retreatDate = new Date(retreat.retreatUtc)
    const closeDate = new Date(retreat.windowCloseUtc)
    daysSet.add(retreatDate.getUTCDay())
    daysSet.add(closeDate.getUTCDay())
  }

  const startHourUtc = new Date(earliestUtcMs).getUTCHours()
  const endHourUtc = new Date(latestUtcMs).getUTCHours()

  return {
    startHourUtc,
    endHourUtc,
    daysOfWeekUtc: Array.from(daysSet).sort(),
  }
}

/**
 * Format a CronWindow as one or two cron expressions.
 *
 * If the hour range wraps around midnight (e.g. start=20, end=4), two
 * cron lines are needed since cron hour ranges don't wrap.
 */
function formatCron(window: CronWindow): Array<string> {
  const days = window.daysOfWeekUtc.join(',')
  const { startHourUtc: start, endHourUtc: end } = window

  if (start <= end) {
    // Simple range (e.g. 2-4)
    const hourRange = start === end ? `${start}` : `${start}-${end}`
    return [`*/3 ${hourRange} * * ${days}`]
  }

  // Wraparound (e.g. 20-4 → two entries: 20-23 and 0-4)
  return [
    `*/3 ${start}-23 * * ${days}`,
    `*/3 0-${end} * * ${days}`,
  ]
}

/**
 * Rewrite the score-poller.yml cron schedule.
 * Returns true if the file was changed.
 */
function writePollerCron(retreats: Array<RetreatEntry>): boolean {
  const yaml = readFileSync(POLLER_WORKFLOW_PATH, 'utf-8')
  const window = computeCronWindow(retreats)

  let newCronLines: string
  if (window) {
    const crons = formatCron(window)
    newCronLines = crons.map((c) => `    - cron: '${c}'`).join('\n')
  } else {
    // No pending retreats — set a cron that never fires (Feb 31 doesn't exist)
    newCronLines = `    - cron: '0 0 31 2 *'`
  }

  const startIdx = yaml.indexOf(CRON_START_MARKER)
  const endIdx = yaml.indexOf(CRON_END_MARKER)
  if (startIdx === -1 || endIdx === -1) {
    console.error(`Could not find cron markers in ${POLLER_WORKFLOW_PATH}`)
    return false
  }

  const before = yaml.slice(0, startIdx + CRON_START_MARKER.length)
  const after = yaml.slice(endIdx)
  const updated = `${before}\n${newCronLines}\n    ${after}`

  if (updated === yaml) return false

  writeFileSync(POLLER_WORKFLOW_PATH, updated)
  return true
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { computeCronWindow, formatCron, writePollerCron, POLLER_WORKFLOW_PATH }
export type { CronWindow }
