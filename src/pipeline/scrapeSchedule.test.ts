import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  parseCompetitionsPage,
  parseScheduleRetreats,
  localTimeToUtc,
  filterUpcomingEvents,
} from './scrapeSchedule'

const competitionsHtml = readFileSync(
  resolve(import.meta.dirname, '../../data/test-fixtures/rmpa-competitions-page.html'),
  'utf-8',
)
const singleRetreatHtml = readFileSync(
  resolve(import.meta.dirname, '../../data/test-fixtures/schedule-single-retreat.html'),
  'utf-8',
)
const splitRetreatHtml = readFileSync(
  resolve(import.meta.dirname, '../../data/test-fixtures/schedule-split-retreat.html'),
  'utf-8',
)

describe('parseCompetitionsPage', () => {
  const events = parseCompetitionsPage(competitionsHtml)

  it('should parse multiple events', () => {
    expect(events.length).toBeGreaterThanOrEqual(7)
  })

  it('should extract dates in YYYY-MM-DD format', () => {
    expect(events[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(events[0].date).toBe('2026-02-14')
  })

  it('should extract venue names', () => {
    expect(events[0].eventName).toBe('Monarch HS')
  })

  it('should extract schedule URLs', () => {
    expect(events[0].scheduleUrl).toContain('schedules.competitionsuite.com')
    expect(events[0].scheduleUrl).toContain('_standard.htm')
  })

  it('should parse the full 2026 season (7 events)', () => {
    const dates = events.map((e) => e.date)
    expect(dates).toContain('2026-02-14')
    expect(dates).toContain('2026-02-21')
    expect(dates).toContain('2026-02-28')
    expect(dates).toContain('2026-03-07')
    expect(dates).toContain('2026-03-21')
    expect(dates).toContain('2026-03-28')
    expect(dates).toContain('2026-04-04')
  })
})

describe('parseScheduleRetreats — single retreat', () => {
  const retreats = parseScheduleRetreats(singleRetreatHtml)

  it('should find one retreat', () => {
    expect(retreats).toHaveLength(1)
  })

  it('should extract the retreat label', () => {
    expect(retreats[0].label).toBe('Retreat/Critique')
  })

  it('should extract the local time', () => {
    expect(retreats[0].localTime).toBe('5:28 PM')
  })

  it('should mark the single retreat as final', () => {
    expect(retreats[0].isFinal).toBe(true)
  })
})

describe('parseScheduleRetreats — split retreat', () => {
  const retreats = parseScheduleRetreats(splitRetreatHtml)

  it('should find two retreats', () => {
    expect(retreats).toHaveLength(2)
  })

  it('should extract Regional A retreat first', () => {
    expect(retreats[0].label).toBe('Regional A Retreat/Critique')
    expect(retreats[0].localTime).toBe('1:45 PM')
    expect(retreats[0].isFinal).toBe(false)
  })

  it('should extract final retreat second', () => {
    expect(retreats[1].label).toBe('Retreat/Critique')
    expect(retreats[1].localTime).toBe('6:55 PM')
    expect(retreats[1].isFinal).toBe(true)
  })
})

describe('localTimeToUtc', () => {
  it('should convert MST time correctly (February — UTC-7)', () => {
    const utc = localTimeToUtc('2026-02-14', '5:28 PM')
    // 5:28 PM MST = 00:28 UTC next day
    expect(utc).toBe('2026-02-15T00:28:00.000Z')
  })

  it('should convert MDT time correctly (April — UTC-6)', () => {
    const utc = localTimeToUtc('2026-04-04', '8:07 PM')
    // 8:07 PM MDT = 02:07 UTC next day
    expect(utc).toBe('2026-04-05T02:07:00.000Z')
  })

  it('should handle noon correctly', () => {
    const utc = localTimeToUtc('2026-02-28', '12:45 PM')
    // 12:45 PM MST = 19:45 UTC same day
    expect(utc).toBe('2026-02-28T19:45:00.000Z')
  })

  it('should handle morning times', () => {
    const utc = localTimeToUtc('2026-03-07', '9:00 AM')
    // March 7 is before DST (2nd Sunday = Mar 8 in 2026), so MST (UTC-7)
    // 9:00 AM MST = 16:00 UTC
    expect(utc).toBe('2026-03-07T16:00:00.000Z')
  })
})

describe('filterUpcomingEvents', () => {
  const events = parseCompetitionsPage(competitionsHtml)

  it('should return events within the window', () => {
    // Thursday before the first show (Feb 14)
    const now = new Date('2026-02-12T21:00:00Z') // Thu 2 PM MST
    const upcoming = filterUpcomingEvents(events, now, 3)
    expect(upcoming.length).toBeGreaterThanOrEqual(1)
    expect(upcoming[0].date).toBe('2026-02-14')
  })

  it('should return empty when no events in window', () => {
    const now = new Date('2026-01-01T21:00:00Z')
    const upcoming = filterUpcomingEvents(events, now, 3)
    expect(upcoming).toHaveLength(0)
  })

  it('should include today if event is today', () => {
    const now = new Date('2026-02-14T19:00:00Z') // Feb 14 noon MST
    const upcoming = filterUpcomingEvents(events, now, 3)
    expect(upcoming.some((e) => e.date === '2026-02-14')).toBe(true)
  })
})
