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
  startMinuteUtc: number
  startHourUtc: number
  endMinuteUtc: number
  endHourUtc: number
  dayOfMonthUtc: number
  monthUtc: number
  retreatUtc: string
  retreatMt: string
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
        startMinuteUtc: retreatDate.getUTCMinutes(),
        startHourUtc: retreatDate.getUTCHours(),
        endMinuteUtc: closeDate.getUTCMinutes(),
        endHourUtc: closeDate.getUTCHours(),
        dayOfMonthUtc: retreatDate.getUTCDate(),
        monthUtc: retreatDate.getUTCMonth() + 1,
        retreatUtc: r.retreatUtc,
        retreatMt: formatMountainTime(retreatDate),
        isFinal: r.isFinal ?? true,
      }
    })
    .sort((a, b) => new Date(a.retreatUtc).getTime() - new Date(b.retreatUtc).getTime())
}

/**
 * Format a UTC Date as a short Mountain Time string for cron comments.
 * e.g. "Sat 8:07 PM MDT" or "Sat 5:28 PM MST"
 */
function formatMountainTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).formatToParts(date)

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const hour = parts.find((p) => p.type === 'hour')?.value ?? ''
  const minute = parts.find((p) => p.type === 'minute')?.value ?? ''
  const dayPeriod = parts.find((p) => p.type === 'dayPeriod')?.value ?? ''
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''

  return `${weekday} ${hour}:${minute} ${dayPeriod} ${tz}`
}

// Format CronWindows as YAML lines with metadata comments.
//
// Cron step values (e.g. 7/5) reset at each hour boundary, so a window
// spanning multiple hours is split into up to three cron entries:
//   1. First partial hour: startMinute/5 startHour (7/5 2 = :07,:12,...,:57)
//   2. Full middle hours: carryMinute/5 middleHours (2/5 3 = :02,:07,...,:57)
//   3. Last partial hour: explicit minutes (2,7 4 = :02,:07)
//
// carryMinute = startMinute % 5 — the offset that continues the 5-min
// cadence into subsequent hours without gaps.
//
// When the retreat starts on the hour, only full hours are needed (no
// first/last partial) and the range stops before the close hour.
function formatCronEntries(windows: Array<CronWindow>): Array<string> {
  if (windows.length === 0) return ["- cron: '0 0 31 2 *'"]

  const lines: Array<string> = []
  for (const w of windows) {
    const datePart = `${w.dayOfMonthUtc} ${w.monthUtc} *`
    lines.push(`# retreat:${w.retreatUtc} mt:${w.retreatMt} final:${w.isFinal}`)

    if (w.startMinuteUtc === 0) {
      // Starts on the hour — full hours from start to end-1 (close hour not needed)
      const lastHour = w.endHourUtc - 1
      const hourRange = w.startHourUtc === lastHour
        ? `${w.startHourUtc}`
        : `${w.startHourUtc}-${lastHour}`
      lines.push(`- cron: '*/5 ${hourRange} ${datePart}'`)
    } else {
      const carryMinute = w.startMinuteUtc % 5
      const middleMinuteExpr = carryMinute === 0 ? '*/5' : `${carryMinute}/5`

      // 1. First partial hour
      lines.push(`- cron: '${w.startMinuteUtc}/5 ${w.startHourUtc} ${datePart}'`)

      // 2. Full middle hours (startHour+1 to endHour-1)
      const middleStart = w.startHourUtc + 1
      const middleEnd = w.endHourUtc - 1
      if (middleStart <= middleEnd) {
        const middleHours = middleStart === middleEnd
          ? `${middleStart}`
          : `${middleStart}-${middleEnd}`
        lines.push(`- cron: '${middleMinuteExpr} ${middleHours} ${datePart}'`)
      }

      // 3. Last partial hour — enumerate minutes from carry to endMinute
      if (w.endMinuteUtc >= carryMinute) {
        const minuteList: Array<number> = []
        for (let m = carryMinute; m <= w.endMinuteUtc; m += 5) {
          minuteList.push(m)
        }
        lines.push(`- cron: '${minuteList.join(',')} ${w.endHourUtc} ${datePart}'`)
      }
    }
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

export { computeCronWindows, formatCronEntries, formatMountainTime, writePollerCron, POLLER_WORKFLOW_PATH }
export type { CronWindow }
