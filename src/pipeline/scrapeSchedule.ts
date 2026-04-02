import { load } from 'cheerio'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RetreatInfo = {
  label: string
  localTime: string
  isFinal: boolean
}

type CompetitionEvent = {
  date: string
  eventName: string
  scheduleUrl: string | null
}

// ---------------------------------------------------------------------------
// Competitions page parser
// ---------------------------------------------------------------------------

/**
 * Parse `rmpa.org/competitions` to extract event dates, names, and schedule links.
 *
 * Structure: each event is a pair of `<div class="row">` blocks.
 * The first contains `<small><em>MM/DD/YY Day</em></small>` and an `<a>` with the venue.
 * The second contains resource links including "Schedule" pointing to competitionsuite.
 */
function parseCompetitionsPage(html: string): Array<CompetitionEvent> {
  const $ = load(html)
  const events: Array<CompetitionEvent> = []

  // Each event has a date in a <small><em> and a venue in a <a> with class comp-*
  $('small em').each((_i, em) => {
    const dateText = $(em).text().trim() // e.g. "02/14/26 Sat"
    if (!/^\d{2}\/\d{2}\/\d{2}\s+\w+/.test(dateText)) return

    // Parse the date
    const date = parseShortDate(dateText)

    // The venue link is in the same parent <p> or the next element
    const parentP = $(em).closest('p')
    const venueLink = parentP.find('a span.larger')
    const eventName = venueLink.text().trim() || 'Unknown'

    // Find the schedule link — it's in a sibling row after this one
    const eventRow = parentP.closest('.row')
    const nextRow = eventRow.next('.row')
    const scheduleLink = nextRow.find('a[href*="competitionsuite.com"][href*="_standard"]')
    const scheduleUrl = scheduleLink.attr('href') || null

    events.push({ date, eventName, scheduleUrl })
  })

  return events
}

function parseShortDate(text: string): string {
  // "02/14/26 Sat" → "2026-02-14"
  const match = text.match(/(\d{2})\/(\d{2})\/(\d{2})/)
  if (!match) return ''
  const [, mm, dd, yy] = match
  const year = parseInt(yy, 10) + 2000
  return `${year}-${mm}-${dd}`
}

// ---------------------------------------------------------------------------
// Schedule page parser
// ---------------------------------------------------------------------------

/**
 * Parse a CompetitionSuite schedule page to find retreat entries.
 *
 * Retreat rows use class `schedule-row--custom` and contain text matching
 * "Retreat" or "Full Retreat". The time is in `schedule-row__time`.
 */
function parseScheduleRetreats(html: string): Array<RetreatInfo> {
  const $ = load(html)
  const retreats: Array<RetreatInfo> = []

  $('.schedule-row--custom').each((_i, row) => {
    const label = $(row).find('.schedule-row__custom').text().trim()
    if (!/retreat/i.test(label)) return

    const timeText = $(row).find('.schedule-row__time').text().trim()
    retreats.push({
      label,
      localTime: timeText,
      isFinal: false, // set below
    })
  })

  // Mark the last retreat as final
  if (retreats.length > 0) {
    retreats[retreats.length - 1].isFinal = true
  }

  // If no retreats found, try to find the last performance time as fallback
  if (retreats.length === 0) {
    const allTimes = $('.schedule-row__time')
    if (allTimes.length > 0) {
      const lastTime = allTimes.last().text().trim()
      retreats.push({
        label: 'Estimated (last performance + 60 min)',
        localTime: lastTime,
        isFinal: true,
      })
    }
  }

  return retreats
}

/**
 * Convert a local time string (e.g. "5:28 PM") on a given date to a UTC ISO string.
 * Uses America/Denver timezone.
 */
function localTimeToUtc(date: string, localTime: string): string {
  // Parse "5:28 PM" or "12:45 PM"
  const match = localTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!match) return ''

  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const ampm = match[3].toUpperCase()

  if (ampm === 'PM' && hours !== 12) hours += 12
  if (ampm === 'AM' && hours === 12) hours = 0

  // Use Intl to find the UTC offset for this specific date/time in Denver
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  // Create a Date assuming UTC, then adjust
  // Simpler approach: construct the date with a known offset calculation
  // Use a temporary date to find Denver's offset on this date
  const utcEpoch = Date.UTC(
    parseInt(date.slice(0, 4)),
    parseInt(date.slice(5, 7)) - 1,
    parseInt(date.slice(8, 10)),
    hours,
    minutes,
  )

  // Get what Denver would display for this UTC time
  const parts = formatter.formatToParts(new Date(utcEpoch))
  const denverHour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)

  // The difference between the hour we wanted and the hour Denver shows is the offset
  const hourDiff = hours - denverHour
  // Adjust: if we wanted 17:00 Denver but UTC shows 17:00 as 11:00 Denver, offset = +6
  const adjustedUtc = utcEpoch + hourDiff * 3_600_000

  return new Date(adjustedUtc).toISOString()
}

/**
 * Filter competition events to those within a window of days from now.
 */
function filterUpcomingEvents(
  events: Array<CompetitionEvent>,
  now: Date,
  windowDays: number,
): Array<CompetitionEvent> {
  const nowMs = now.getTime()
  const windowMs = windowDays * 24 * 3_600_000
  return events.filter((e) => {
    const eventMs = new Date(e.date + 'T00:00:00Z').getTime()
    return eventMs >= nowMs - 24 * 3_600_000 && eventMs <= nowMs + windowMs
  })
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  parseCompetitionsPage,
  parseScheduleRetreats,
  localTimeToUtc,
  filterUpcomingEvents,
}
export type { RetreatInfo, CompetitionEvent }
