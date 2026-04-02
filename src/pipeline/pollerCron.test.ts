import { describe, it, expect } from 'vitest'
import { computeCronWindow, formatCron } from './pollerCron'
import { makeRetreatEntry } from './pollState'

describe('computeCronWindow', () => {
  it('should return null for empty retreats', () => {
    expect(computeCronWindow([])).toBeNull()
  })

  it('should return null when all retreats are imported', () => {
    const retreat = makeRetreatEntry('2026-02-14', 'Show', '2026-02-15T02:07:00.000Z')
    retreat.status = 'imported'
    expect(computeCronWindow([retreat])).toBeNull()
  })

  it('should compute window for a single pending retreat', () => {
    // Retreat at 02:07 UTC Sunday, window close at 04:07 UTC Sunday
    const retreat = makeRetreatEntry('2026-02-14', 'Show', '2026-02-15T02:07:00.000Z')
    const window = computeCronWindow([retreat])

    expect(window).not.toBeNull()
    expect(window!.startHourUtc).toBe(2)
    expect(window!.endHourUtc).toBe(4)
    expect(window!.daysOfWeekUtc).toEqual([0]) // Sunday
  })

  it('should compute window spanning two retreat entries on the same night', () => {
    // Full Retreat at 02:07 UTC, Retreat Concludes at 02:37 UTC
    const r1 = makeRetreatEntry('2026-02-14', 'Full Retreat', '2026-02-15T02:07:00.000Z')
    const r2 = makeRetreatEntry('2026-02-14', 'Retreat Concludes', '2026-02-15T02:37:00.000Z')
    const window = computeCronWindow([r1, r2])

    expect(window).not.toBeNull()
    expect(window!.startHourUtc).toBe(2)
    expect(window!.endHourUtc).toBe(4) // 02:37 + 2h = 04:37, hour 4
    expect(window!.daysOfWeekUtc).toEqual([0])
  })

  it('should compute window spanning two nights (Friday + Saturday)', () => {
    // Friday show: retreat at 01:00 UTC Saturday
    const r1 = makeRetreatEntry('2026-02-13', 'Friday Show', '2026-02-14T01:00:00.000Z')
    // Saturday show: retreat at 02:00 UTC Sunday
    const r2 = makeRetreatEntry('2026-02-14', 'Saturday Show', '2026-02-15T02:00:00.000Z')
    const window = computeCronWindow([r1, r2])

    expect(window).not.toBeNull()
    expect(window!.startHourUtc).toBe(1)
    expect(window!.endHourUtc).toBe(4) // 02:00 + 2h = 04:00
    expect(window!.daysOfWeekUtc).toEqual([0, 6]) // Saturday + Sunday
  })

  it('should compute window for mid-day + evening split retreat (crosses midnight UTC)', () => {
    // Mid-day retreat at 2 PM MDT = 20:00 UTC Saturday, close 22:00 UTC Saturday
    const r1 = makeRetreatEntry('2026-03-14', 'Regional A Retreat', '2026-03-14T20:00:00.000Z')
    // Evening retreat at 8:07 PM MDT = 02:07 UTC Sunday, close 04:07 UTC Sunday
    const r2 = makeRetreatEntry('2026-03-14', 'Finals Retreat', '2026-03-15T02:07:00.000Z')
    const window = computeCronWindow([r1, r2])

    expect(window).not.toBeNull()
    expect(window!.startHourUtc).toBe(20)
    expect(window!.endHourUtc).toBe(4)
    expect(window!.daysOfWeekUtc).toEqual([0, 6]) // Saturday + Sunday

    // formatCron should produce two entries for the wraparound
    const crons = formatCron(window!)
    expect(crons).toEqual(['*/3 20-23 * * 0,6', '*/3 0-4 * * 0,6'])
  })

  it('should ignore failed retreats', () => {
    const r1 = makeRetreatEntry('2026-02-14', 'Failed', '2026-02-15T02:07:00.000Z')
    r1.status = 'failed'
    const r2 = makeRetreatEntry('2026-02-14', 'Pending', '2026-02-15T03:00:00.000Z')
    const window = computeCronWindow([r1, r2])

    expect(window).not.toBeNull()
    expect(window!.startHourUtc).toBe(3)
    expect(window!.endHourUtc).toBe(5)
  })
})

describe('formatCron', () => {
  it('should format a single-hour single-day window', () => {
    expect(formatCron({ startHourUtc: 3, endHourUtc: 3, daysOfWeekUtc: [0] }))
      .toEqual(['*/3 3 * * 0'])
  })

  it('should format a multi-hour single-day window', () => {
    expect(formatCron({ startHourUtc: 2, endHourUtc: 4, daysOfWeekUtc: [0] }))
      .toEqual(['*/3 2-4 * * 0'])
  })

  it('should format a multi-day window', () => {
    expect(formatCron({ startHourUtc: 1, endHourUtc: 4, daysOfWeekUtc: [0, 6] }))
      .toEqual(['*/3 1-4 * * 0,6'])
  })

  it('should split wraparound hour range into two cron entries', () => {
    // Mid-day retreat at 20:00 UTC + evening retreat closing at 04:00 UTC
    expect(formatCron({ startHourUtc: 20, endHourUtc: 4, daysOfWeekUtc: [0, 6] }))
      .toEqual(['*/3 20-23 * * 0,6', '*/3 0-4 * * 0,6'])
  })
})
