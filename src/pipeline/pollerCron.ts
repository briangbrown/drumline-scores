/**
 * Compute and write the score-poller cron schedule based on retreat times.
 *
 * Each pending retreat gets its own cron window (retreat time to +2 hours)
 * on the correct UTC day of week. Metadata comments in the YAML tie each
 * cron entry to a specific retreat for targeted removal after import.
 *
 * The schedule watcher calls writePollerCron after parsing retreat times.
 * The poller also calls it after each import to remove completed windows.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import type { RetreatEntry } from './pollState'

const POLLER_WORKFLOW_PATH = '.github/workflows/score-poller.yml'

// Marker comments in the YAML that bracket the dynamic cron lines
const CRON_START_MARKER = '# --- DYNAMIC CRON START ---'
const CRON_END_MARKER = '# --- DYNAMIC CRON END ---'

type CronWindow = {
  startHourUtc: number
  endHourUtc: number
  dayOfWeekUtc: number
  retreatUtc: string
  isFinal: boolean
}

/**
 * Compute one polling window per pending retreat.
 * Returns windows sorted chronologically by retreat time.
 */
function computeCronWindows(retreats: Array<RetreatEntry>): Array<CronWindow> {
  const pending = retreats.filter((r) => r.status === 'pending')
  if (pending.length === 0) return []

  return pending
    .map((r) => {
      const retreatDate = new Date(r.retreatUtc)
      const closeDate = new Date(r.windowCloseUtc)
      return {
        startHourUtc: retreatDate.getUTCHours(),
        endHourUtc: closeDate.getUTCHours(),
        dayOfWeekUtc: retreatDate.getUTCDay(),
        retreatUtc: r.retreatUtc,
        isFinal: r.isFinal ?? true,
      }
    })
    .sort((a, b) => new Date(a.retreatUtc).getTime() - new Date(b.retreatUtc).getTime())
}

/**
 * Format CronWindows as YAML lines with metadata comments.
 *
 * Each window produces two lines: a metadata comment and a cron entry.
 * Returns a never-fire cron if windows is empty.
 */
function formatCronEntries(windows: Array<CronWindow>): Array<string> {
  if (windows.length === 0) return ["- cron: '0 0 31 2 *'"]

  const lines: Array<string> = []
  for (const w of windows) {
    const hourRange = w.startHourUtc === w.endHourUtc
      ? `${w.startHourUtc}`
      : `${w.startHourUtc}-${w.endHourUtc}`
    lines.push(`# retreat:${w.retreatUtc} final:${w.isFinal}`)
    lines.push(`- cron: '*/3 ${hourRange} * * ${w.dayOfWeekUtc}'`)
  }
  return lines
}

/**
 * Rewrite the score-poller.yml cron schedule.
 * Returns true if the file was changed.
 */
function writePollerCron(retreats: Array<RetreatEntry>): boolean {
  const yaml = readFileSync(POLLER_WORKFLOW_PATH, 'utf-8')
  const windows = computeCronWindows(retreats)
  const entryLines = formatCronEntries(windows)
  const newCronBlock = entryLines.map((line) => `    ${line}`).join('\n')

  const startIdx = yaml.indexOf(CRON_START_MARKER)
  const endIdx = yaml.indexOf(CRON_END_MARKER)
  if (startIdx === -1 || endIdx === -1) {
    console.error(`Could not find cron markers in ${POLLER_WORKFLOW_PATH}`)
    return false
  }

  const before = yaml.slice(0, startIdx + CRON_START_MARKER.length)
  const after = yaml.slice(endIdx)
  const updated = `${before}\n${newCronBlock}\n    ${after}`

  if (updated === yaml) return false

  writeFileSync(POLLER_WORKFLOW_PATH, updated)
  return true
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { computeCronWindows, formatCronEntries, writePollerCron, POLLER_WORKFLOW_PATH }
export type { CronWindow }
