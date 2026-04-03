import { describe, it, expect } from 'vitest'
import { computeCronWindows, formatCronEntries } from './pollerCron'
import type { CronWindow } from './pollerCron'
import { makeRetreatEntry } from './pollState'

// ---------------------------------------------------------------------------
// computeCronWindows
// ---------------------------------------------------------------------------

describe('computeCronWindows', () => {
  it('should return empty array for no retreats', () => {
    expect(computeCronWindows([])).toEqual([])
  })

  it('should return empty array when all retreats are imported', () => {
    const r = makeRetreatEntry('2026-02-14', 'Show', '2026-02-15T02:07:00.000Z')
    r.status = 'imported'
    expect(computeCronWindows([r])).toEqual([])
  })

  it('should return empty array when all retreats are failed', () => {
    const r = makeRetreatEntry('2026-02-14', 'Show', '2026-02-15T02:07:00.000Z')
    r.status = 'failed'
    expect(computeCronWindows([r])).toEqual([])
  })

  // --- Scenario 1: Simple Saturday, one evening retreat ---

  describe('Scenario 1: single show, single retreat', () => {
    it('should return one window for a Saturday evening retreat', () => {
      // 8:07 PM MDT Saturday = 02:07 UTC Sunday, window close 04:07 UTC
      const r = makeRetreatEntry('2026-04-04', 'Show — Retreat', '2026-04-05T02:07:00.000Z')
      const windows = computeCronWindows([r])

      expect(windows).toHaveLength(1)
      expect(windows[0]).toMatchObject({
        startHourUtc: 2,
        endHourUtc: 4,
        dayOfWeekUtc: 0, // Sunday UTC
        retreatUtc: '2026-04-05T02:07:00.000Z',
        isFinal: true,
      })
    })

    it('should return one window for an early evening MST retreat', () => {
      // 5:28 PM MST Saturday = 00:28 UTC Sunday, window close 02:28 UTC
      const r = makeRetreatEntry('2026-02-14', 'Show — Retreat', '2026-02-15T00:28:00.000Z')
      const windows = computeCronWindows([r])

      expect(windows).toHaveLength(1)
      expect(windows[0]).toMatchObject({
        startHourUtc: 0,
        endHourUtc: 2,
        dayOfWeekUtc: 0, // Sunday UTC
      })
    })
  })

  // --- Scenario 2: One show, double retreat (mid-day + evening) ---

  describe('Scenario 2: single show, double retreat', () => {
    it('should return two distinct windows for mid-day and evening retreats', () => {
      // Regional A at 12:45 PM MST = 19:45 UTC Saturday
      const midDay = makeRetreatEntry(
        '2026-02-28', 'Show — Regional A Retreat', '2026-02-28T19:45:00.000Z', false,
      )
      // Final at 6:55 PM MST = 01:55 UTC Sunday
      const evening = makeRetreatEntry(
        '2026-02-28', 'Show — Retreat', '2026-03-01T01:55:00.000Z',
      )
      const windows = computeCronWindows([midDay, evening])

      expect(windows).toHaveLength(2)
      // Mid-day window: 19–21 UTC Saturday
      expect(windows[0]).toMatchObject({
        startHourUtc: 19,
        endHourUtc: 21,
        dayOfWeekUtc: 6, // Saturday
        isFinal: false,
      })
      // Evening window: 1–3 UTC Sunday
      expect(windows[1]).toMatchObject({
        startHourUtc: 1,
        endHourUtc: 3,
        dayOfWeekUtc: 0, // Sunday
        isFinal: true,
      })
    })

    it('should return only evening window when mid-day is already imported', () => {
      const midDay = makeRetreatEntry(
        '2026-02-28', 'Show — Regional A', '2026-02-28T19:45:00.000Z', false,
      )
      midDay.status = 'imported'
      const evening = makeRetreatEntry(
        '2026-02-28', 'Show — Retreat', '2026-03-01T01:55:00.000Z',
      )
      const windows = computeCronWindows([midDay, evening])

      expect(windows).toHaveLength(1)
      expect(windows[0].retreatUtc).toBe('2026-03-01T01:55:00.000Z')
      expect(windows[0].isFinal).toBe(true)
    })

    it('should return no windows when both are imported', () => {
      const midDay = makeRetreatEntry(
        '2026-02-28', 'Show — Regional A', '2026-02-28T19:45:00.000Z', false,
      )
      midDay.status = 'imported'
      const evening = makeRetreatEntry(
        '2026-02-28', 'Show — Retreat', '2026-03-01T01:55:00.000Z',
      )
      evening.status = 'imported'
      expect(computeCronWindows([midDay, evening])).toEqual([])
    })
  })

  // --- Scenario 3: Back-to-back Fri+Sat, each with double retreats ---

  describe('Scenario 3: back-to-back double retreats', () => {
    it('should return four distinct windows in chronological order', () => {
      const friMid = makeRetreatEntry('2026-03-27', 'Fri — Regional A', '2026-03-27T19:45:00.000Z', false)
      const friEve = makeRetreatEntry('2026-03-27', 'Fri — Retreat', '2026-03-28T01:55:00.000Z')
      const satMid = makeRetreatEntry('2026-03-28', 'Sat — Regional A', '2026-03-28T19:45:00.000Z', false)
      const satEve = makeRetreatEntry('2026-03-28', 'Sat — Retreat', '2026-03-29T01:55:00.000Z')

      const windows = computeCronWindows([friMid, friEve, satMid, satEve])

      expect(windows).toHaveLength(4)
      // Chronological order
      expect(windows[0].retreatUtc).toBe('2026-03-27T19:45:00.000Z')
      expect(windows[1].retreatUtc).toBe('2026-03-28T01:55:00.000Z')
      expect(windows[2].retreatUtc).toBe('2026-03-28T19:45:00.000Z')
      expect(windows[3].retreatUtc).toBe('2026-03-29T01:55:00.000Z')
      // Distinct UTC days (no union)
      expect(windows[0].dayOfWeekUtc).toBe(5) // Friday
      expect(windows[1].dayOfWeekUtc).toBe(6) // Saturday
      expect(windows[2].dayOfWeekUtc).toBe(6) // Saturday
      expect(windows[3].dayOfWeekUtc).toBe(0) // Sunday
      // Final flags
      expect(windows[0].isFinal).toBe(false)
      expect(windows[1].isFinal).toBe(true)
      expect(windows[2].isFinal).toBe(false)
      expect(windows[3].isFinal).toBe(true)
    })

    it('should have two windows left after both Friday retreats are imported', () => {
      const friMid = makeRetreatEntry('2026-03-27', 'Fri — Regional A', '2026-03-27T19:45:00.000Z', false)
      friMid.status = 'imported'
      const friEve = makeRetreatEntry('2026-03-27', 'Fri — Retreat', '2026-03-28T01:55:00.000Z')
      friEve.status = 'imported'
      const satMid = makeRetreatEntry('2026-03-28', 'Sat — Regional A', '2026-03-28T19:45:00.000Z', false)
      const satEve = makeRetreatEntry('2026-03-28', 'Sat — Retreat', '2026-03-29T01:55:00.000Z')

      const windows = computeCronWindows([friMid, friEve, satMid, satEve])

      expect(windows).toHaveLength(2)
      expect(windows[0].retreatUtc).toBe('2026-03-28T19:45:00.000Z')
      expect(windows[1].retreatUtc).toBe('2026-03-29T01:55:00.000Z')
    })
  })

  // --- Scenario 4: Back-to-back Fri+Sat, one retreat each ---

  describe('Scenario 4: back-to-back single retreats', () => {
    it('should return two distinct windows for consecutive nights', () => {
      const fri = makeRetreatEntry('2026-03-27', 'Fri Show', '2026-03-28T02:07:00.000Z')
      const sat = makeRetreatEntry('2026-03-28', 'Sat Show', '2026-03-29T02:07:00.000Z')

      const windows = computeCronWindows([fri, sat])

      expect(windows).toHaveLength(2)
      expect(windows[0]).toMatchObject({
        startHourUtc: 2,
        endHourUtc: 4,
        dayOfWeekUtc: 6, // Saturday UTC (Friday night MT)
        isFinal: true,
      })
      expect(windows[1]).toMatchObject({
        startHourUtc: 2,
        endHourUtc: 4,
        dayOfWeekUtc: 0, // Sunday UTC (Saturday night MT)
        isFinal: true,
      })
    })

    it('should have one window left after Friday import', () => {
      const fri = makeRetreatEntry('2026-03-27', 'Fri Show', '2026-03-28T02:07:00.000Z')
      fri.status = 'imported'
      const sat = makeRetreatEntry('2026-03-28', 'Sat Show', '2026-03-29T02:07:00.000Z')

      const windows = computeCronWindows([fri, sat])
      expect(windows).toHaveLength(1)
      expect(windows[0].dayOfWeekUtc).toBe(0)
    })
  })

  // --- Two shows a week apart (both published at once) ---

  describe('Two shows a week apart', () => {
    it('should return two distinct windows on different Sundays, not a unioned week', () => {
      // This Saturday: retreat at 02:07 UTC Sunday Feb 15
      const thisWeek = makeRetreatEntry('2026-02-14', 'Show A — Retreat', '2026-02-15T02:07:00.000Z')
      // Next Saturday: retreat at 02:07 UTC Sunday Feb 22
      const nextWeek = makeRetreatEntry('2026-02-21', 'Show B — Retreat', '2026-02-22T02:07:00.000Z')

      const windows = computeCronWindows([thisWeek, nextWeek])

      expect(windows).toHaveLength(2)
      // Both are Sunday UTC but a week apart — each gets its own cron entry
      expect(windows[0]).toMatchObject({
        startHourUtc: 2,
        endHourUtc: 4,
        dayOfWeekUtc: 0, // Sunday
        retreatUtc: '2026-02-15T02:07:00.000Z',
      })
      expect(windows[1]).toMatchObject({
        startHourUtc: 2,
        endHourUtc: 4,
        dayOfWeekUtc: 0, // Sunday
        retreatUtc: '2026-02-22T02:07:00.000Z',
      })
    })

    it('should have one window left after this week imports', () => {
      const thisWeek = makeRetreatEntry('2026-02-14', 'Show A — Retreat', '2026-02-15T02:07:00.000Z')
      thisWeek.status = 'imported'
      const nextWeek = makeRetreatEntry('2026-02-21', 'Show B — Retreat', '2026-02-22T02:07:00.000Z')

      const windows = computeCronWindows([thisWeek, nextWeek])
      expect(windows).toHaveLength(1)
      expect(windows[0].retreatUtc).toBe('2026-02-22T02:07:00.000Z')
    })
  })

  // --- Reschedule: retreat moved later on show day ---

  describe('Reschedule', () => {
    it('should produce updated window when retreat is moved later', () => {
      // Original: 8:07 PM MT = 02:07 UTC
      const original = makeRetreatEntry('2026-02-14', 'Show — Retreat', '2026-02-15T02:07:00.000Z')
      const windowsBefore = computeCronWindows([original])
      expect(windowsBefore[0].startHourUtc).toBe(2)
      expect(windowsBefore[0].endHourUtc).toBe(4)

      // Delayed 1 hour: 9:07 PM MT = 03:07 UTC
      const delayed = makeRetreatEntry('2026-02-14', 'Show — Retreat', '2026-02-15T03:07:00.000Z')
      const windowsAfter = computeCronWindows([delayed])
      expect(windowsAfter[0].startHourUtc).toBe(3)
      expect(windowsAfter[0].endHourUtc).toBe(5)
      expect(windowsAfter[0].retreatUtc).toBe('2026-02-15T03:07:00.000Z')
    })
  })
})

// ---------------------------------------------------------------------------
// formatCronEntries
// ---------------------------------------------------------------------------

describe('formatCronEntries', () => {
  it('should produce never-fire cron for empty windows', () => {
    expect(formatCronEntries([])).toEqual(["- cron: '0 0 31 2 *'"])
  })

  it('should format a single window with metadata comment', () => {
    const windows: Array<CronWindow> = [{
      startHourUtc: 2,
      endHourUtc: 4,
      dayOfWeekUtc: 0,
      retreatUtc: '2026-04-05T02:07:00.000Z',
      isFinal: true,
    }]
    expect(formatCronEntries(windows)).toEqual([
      '# retreat:2026-04-05T02:07:00.000Z final:true',
      "- cron: '*/3 2-4 * * 0'",
    ])
  })

  it('should format two windows for a double-retreat day', () => {
    const windows: Array<CronWindow> = [
      {
        startHourUtc: 19,
        endHourUtc: 21,
        dayOfWeekUtc: 6,
        retreatUtc: '2026-02-28T19:45:00.000Z',
        isFinal: false,
      },
      {
        startHourUtc: 1,
        endHourUtc: 3,
        dayOfWeekUtc: 0,
        retreatUtc: '2026-03-01T01:55:00.000Z',
        isFinal: true,
      },
    ]
    expect(formatCronEntries(windows)).toEqual([
      '# retreat:2026-02-28T19:45:00.000Z final:false',
      "- cron: '*/3 19-21 * * 6'",
      '# retreat:2026-03-01T01:55:00.000Z final:true',
      "- cron: '*/3 1-3 * * 0'",
    ])
  })

  it('should format four windows for back-to-back double-retreat days', () => {
    const windows: Array<CronWindow> = [
      { startHourUtc: 19, endHourUtc: 21, dayOfWeekUtc: 5, retreatUtc: '2026-03-27T19:45:00.000Z', isFinal: false },
      { startHourUtc: 1, endHourUtc: 3, dayOfWeekUtc: 6, retreatUtc: '2026-03-28T01:55:00.000Z', isFinal: true },
      { startHourUtc: 19, endHourUtc: 21, dayOfWeekUtc: 6, retreatUtc: '2026-03-28T19:45:00.000Z', isFinal: false },
      { startHourUtc: 1, endHourUtc: 3, dayOfWeekUtc: 0, retreatUtc: '2026-03-29T01:55:00.000Z', isFinal: true },
    ]
    const lines = formatCronEntries(windows)
    expect(lines).toHaveLength(8) // 4 metadata + 4 cron
    expect(lines[0]).toBe('# retreat:2026-03-27T19:45:00.000Z final:false')
    expect(lines[1]).toBe("- cron: '*/3 19-21 * * 5'")
    expect(lines[6]).toBe('# retreat:2026-03-29T01:55:00.000Z final:true')
    expect(lines[7]).toBe("- cron: '*/3 1-3 * * 0'")
  })

  it('should format single-hour window without dash range', () => {
    const windows: Array<CronWindow> = [{
      startHourUtc: 3,
      endHourUtc: 3,
      dayOfWeekUtc: 0,
      retreatUtc: '2026-02-15T03:00:00.000Z',
      isFinal: true,
    }]
    const lines = formatCronEntries(windows)
    expect(lines).toContain("- cron: '*/3 3 * * 0'")
  })

  it('should format two distinct windows for back-to-back single retreats', () => {
    const windows: Array<CronWindow> = [
      { startHourUtc: 2, endHourUtc: 4, dayOfWeekUtc: 6, retreatUtc: '2026-03-28T02:07:00.000Z', isFinal: true },
      { startHourUtc: 2, endHourUtc: 4, dayOfWeekUtc: 0, retreatUtc: '2026-03-29T02:07:00.000Z', isFinal: true },
    ]
    const lines = formatCronEntries(windows)
    expect(lines).toHaveLength(4)
    // Each window gets its own cron entry with its own day
    expect(lines[1]).toBe("- cron: '*/3 2-4 * * 6'")
    expect(lines[3]).toBe("- cron: '*/3 2-4 * * 0'")
  })
})
