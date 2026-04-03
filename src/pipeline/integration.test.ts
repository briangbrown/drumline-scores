/**
 * Integration tests — simulate a full RMPA season using 2025 data.
 *
 * These tests exercise the pipeline modules end-to-end without network calls.
 * They use the real 2025 HTML files as score content and build synthetic
 * versions of the rmpa.org pages that progressively reveal shows through
 * the season timeline.
 */

import { readFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  emptyPollState,
  findActionableRetreats,
  isCoolDownActive,
  hasWork,
  markRetreatImported,
  markRetreatFailed,
  addOrUpdateRetreat,
  makeRetreatEntry,
  writePollState,
  readPollState,
} from './pollState'
import { hashContent, compareHash } from './contentHash'
import { parseScorePage, filterByYear } from './scrapeScores'
import { parseScheduleRetreats, localTimeToUtc } from './scrapeSchedule'
import { validateShowData } from './validate'
import { computeCronWindows } from './pollerCron'
import { parseRecapHtml } from '../parser'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURES_DIR = resolve(import.meta.dirname, '../../data/test-fixtures')
const SCORES_HTML = readFileSync(resolve(FIXTURES_DIR, 'rmpa-scores-page.html'), 'utf-8')
const SINGLE_SCHEDULE_HTML = readFileSync(resolve(FIXTURES_DIR, 'schedule-single-retreat.html'), 'utf-8')
const SPLIT_SCHEDULE_HTML = readFileSync(resolve(FIXTURES_DIR, 'schedule-split-retreat.html'), 'utf-8')

// Real 2025 recap HTML files
const SCORES_DIR = resolve(import.meta.dirname, '../../data/scores/2025')
const RECAP_FILES = [
  '2025-02-08_Regular_Season_Show_1.html',
  '2025-02-15_Regular_Season_Show_2.html',
  '2025-02-22_Regular_Season_Show_3.html',
  '2025-03-01_Regular_Season_Show_4.html',
  '2025-03-08_Regular_Season_Show_5.html',
  '2025-03-22_Regular_Season_Show_6.html',
  '2025-03-28_RMPA_State_Championships.html',
  '2025-03-29_RMPA_State_Championships.html',
]

function loadRecap(filename: string): string {
  return readFileSync(resolve(SCORES_DIR, filename), 'utf-8')
}

// Temp directory for poll-state during tests
const TMP_DIR = resolve(import.meta.dirname, '../../.test-tmp')
const TMP_POLL_STATE = resolve(TMP_DIR, 'poll-state.json')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a synthetic scores page with only the first N shows from 2025. */
function buildPartialScoresPage(showCount: number): string {
  const allEntries = filterByYear(parseScorePage(SCORES_HTML), 2025)
  // Entries are in reverse chronological order (newest first), so take from the end
  const entries = allEntries.slice(allEntries.length - showCount)

  // Build minimal HTML that parseScorePage can parse
  let html = '<ul class="list-group"><li class="list-group-item active">2025</li>'
  for (const entry of entries) {
    html += `<li class="list-group-item"><a href="${entry.recapUrl}">${entry.date}</a> ${entry.eventName}</li>`
  }
  html += '</ul>'
  return html
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Season Simulation — 2025 model', () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true })
  })

  describe('Pre-season: no events, pipeline idle', () => {
    it('should find no actionable retreats on an empty state', () => {
      const state = emptyPollState(2025)
      const now = new Date('2025-01-15T21:00:00Z') // mid-January
      expect(findActionableRetreats(state, now)).toEqual([])
      expect(isCoolDownActive(state, now)).toBe(false)
      expect(hasWork(state, now)).toBe(false)
    })

    it('should parse zero 2025 entries from an empty scores page', () => {
      const entries = filterByYear(parseScorePage('<ul class="list-group"><li class="list-group-item active">2025</li></ul>'), 2025)
      expect(entries).toHaveLength(0)
    })
  })

  describe('Schedule Watcher: finding retreat times', () => {
    it('should parse retreat from a single-retreat schedule and add to poll-state', () => {
      let state = emptyPollState(2025)
      const retreats = parseScheduleRetreats(SINGLE_SCHEDULE_HTML)
      expect(retreats).toHaveLength(1)

      const utc = localTimeToUtc('2026-02-14', retreats[0].localTime)
      const entry = makeRetreatEntry('2026-02-14', 'Monarch HS', utc)
      state = addOrUpdateRetreat(state, entry)

      expect(state.retreats).toHaveLength(1)
      expect(state.retreats[0].status).toBe('pending')
      expect(state.retreats[0].eventName).toBe('Monarch HS')
    })

    it('should parse two retreats from a split-retreat schedule', () => {
      let state = emptyPollState(2025)
      const retreats = parseScheduleRetreats(SPLIT_SCHEDULE_HTML)
      expect(retreats).toHaveLength(2)

      for (const r of retreats) {
        const utc = localTimeToUtc('2026-02-28', r.localTime)
        const entry = makeRetreatEntry('2026-02-28', `Lakewood — ${r.label}`, utc)
        state = addOrUpdateRetreat(state, entry)
      }

      expect(state.retreats).toHaveLength(2)
      expect(state.retreats[0].status).toBe('pending')
      expect(state.retreats[1].status).toBe('pending')
    })

    it('should update retreat time when schedule changes (delay)', () => {
      let state = emptyPollState(2025)
      const original = makeRetreatEntry('2026-02-14', 'Show — Retreat', '2026-02-15T00:28:00.000Z')
      state = addOrUpdateRetreat(state, original)

      // Schedule delayed by 30 minutes — same event name, later time
      const delayed = makeRetreatEntry('2026-02-14', 'Show — Retreat', '2026-02-15T00:58:00.000Z')
      state = addOrUpdateRetreat(state, delayed)

      expect(state.retreats).toHaveLength(1)
      expect(state.retreats[0].retreatUtc).toBe('2026-02-15T00:58:00.000Z')
    })
  })

  describe('Score Poller: detecting and importing new scores', () => {
    it('should detect new show on scores page via hash comparison', () => {
      const recapHtml = loadRecap(RECAP_FILES[0]) // Show #1
      const hash = hashContent(recapHtml)
      const comparison = compareHash(hash, null)

      expect(comparison.status).toBe('new')
      expect(comparison.currentHash).toBe(hash)
    })

    it('should detect unchanged content via hash comparison', () => {
      const recapHtml = loadRecap(RECAP_FILES[0])
      const hash = hashContent(recapHtml)
      const comparison = compareHash(hash, hash)

      expect(comparison.status).toBe('unchanged')
    })

    it('should detect changed content (score correction simulation)', () => {
      const recapHtml = loadRecap(RECAP_FILES[0])
      const originalHash = hashContent(recapHtml)
      // Simulate a correction by modifying the HTML slightly
      const correctedHtml = recapHtml.replace('</html>', '<!-- correction --></html>')
      const newHash = hashContent(correctedHtml)
      const comparison = compareHash(newHash, originalHash)

      expect(comparison.status).toBe('changed')
    })

    it('should parse and validate each 2025 show successfully', () => {
      for (const file of RECAP_FILES) {
        const html = loadRecap(file)
        const showData = parseRecapHtml(html, 2025)
        const result = validateShowData(showData, 2025)

        expect(result.passed).toBe(true)
      }
    })

    it('should mark retreat as imported and set cool-down after successful import', () => {
      const retreatUtc = '2025-02-09T00:28:00.000Z'
      let state = emptyPollState(2025)
      state = addOrUpdateRetreat(state, makeRetreatEntry('2025-02-08', 'Show #1', retreatUtc))

      const recapHtml = loadRecap(RECAP_FILES[0])
      const hash = hashContent(recapHtml)
      const now = new Date('2025-02-09T00:45:00Z')

      state = markRetreatImported(state, retreatUtc, hash, now)

      expect(state.retreats[0].status).toBe('imported')
      expect(state.retreats[0].sourceHash).toBe(hash)
      expect(state.coolDownUntilUtc).not.toBeNull()
      expect(isCoolDownActive(state, now)).toBe(true)
      // Cool-down should expire after 15 minutes
      expect(isCoolDownActive(state, new Date('2025-02-09T01:05:00Z'))).toBe(false)
    })

    it('should mark retreat as imported via unchanged hash when earlier run already imported', () => {
      const retreatUtc = '2025-02-09T02:07:00.000Z'
      let state = emptyPollState(2025)
      state = addOrUpdateRetreat(state, makeRetreatEntry('2025-02-08', 'Show — Retreat', retreatUtc))

      const hash = hashContent(loadRecap(RECAP_FILES[0]))

      // First run: import succeeds
      state = markRetreatImported(state, retreatUtc, hash, new Date('2025-02-09T02:10:00Z'))
      expect(state.retreats[0].status).toBe('imported')
      // Cool-down expires 15 min after import, then no more work
      expect(hasWork(state, new Date('2025-02-09T02:30:00Z'))).toBe(false)
    })

    it('should not find actionable retreats after import (no more work)', () => {
      const retreatUtc = '2025-02-09T00:28:00.000Z'
      let state = emptyPollState(2025)
      state = addOrUpdateRetreat(state, makeRetreatEntry('2025-02-08', 'Show #1', retreatUtc))

      const hash = hashContent(loadRecap(RECAP_FILES[0]))
      state = markRetreatImported(state, retreatUtc, hash, new Date('2025-02-09T00:45:00Z'))

      // 30 minutes later — cool-down expired, no pending retreats
      const later = new Date('2025-02-09T01:15:00Z')
      expect(findActionableRetreats(state, later)).toHaveLength(0)
      expect(isCoolDownActive(state, later)).toBe(false)
      expect(hasWork(state, later)).toBe(false)
    })
  })

  describe('Progressive season: shows appearing week by week', () => {
    it('should progressively discover shows as the scores page updates', () => {
      const allEntries = filterByYear(parseScorePage(SCORES_HTML), 2025)
      expect(allEntries).toHaveLength(8)

      // Simulate weeks 1 through 8
      for (let week = 1; week <= 8; week++) {
        const partialHtml = buildPartialScoresPage(week)
        const entries = filterByYear(parseScorePage(partialHtml), 2025)
        expect(entries).toHaveLength(week)
      }
    })

    it('should build up poll-state across the full season', () => {
      let state = emptyPollState(2025)

      // Add retreats for all 8 shows (simulating weekly schedule watcher runs)
      const showDates = [
        '2025-02-08', '2025-02-15', '2025-02-22', '2025-03-01',
        '2025-03-08', '2025-03-22', '2025-03-28', '2025-03-29',
      ]

      for (let i = 0; i < showDates.length; i++) {
        const retreatUtc = `${showDates[i]}T23:30:00.000Z`
        const entry = makeRetreatEntry(showDates[i], `Show ${i + 1}`, retreatUtc)
        state = addOrUpdateRetreat(state, entry)
      }

      expect(state.retreats).toHaveLength(8)
      expect(state.retreats.every((r) => r.status === 'pending')).toBe(true)

      // Import each show sequentially
      for (let i = 0; i < showDates.length; i++) {
        const html = loadRecap(RECAP_FILES[i])
        const hash = hashContent(html)
        const retreatUtc = `${showDates[i]}T23:30:00.000Z`
        const importTime = new Date(`${showDates[i]}T23:45:00Z`)
        state = markRetreatImported(state, retreatUtc, hash, importTime)
      }

      expect(state.retreats.every((r) => r.status === 'imported')).toBe(true)
      expect(state.retreats.every((r) => r.sourceHash !== null)).toBe(true)
    })
  })

  describe('Reconciliation: detecting corrections', () => {
    it('should detect when a previously imported show has changed content', () => {
      const originalHtml = loadRecap(RECAP_FILES[0])
      const originalHash = hashContent(originalHtml)

      // Simulate a correction — slightly different content, same URL
      const correctedHtml = originalHtml.replace('</html>', '<!-- score correction applied --></html>')
      const correctedHash = hashContent(correctedHtml)

      expect(correctedHash).not.toBe(originalHash)

      const comparison = compareHash(correctedHash, originalHash)
      expect(comparison.status).toBe('changed')

      // The corrected content should still parse and validate
      const showData = parseRecapHtml(correctedHtml, 2025)
      const result = validateShowData(showData, 2025)
      expect(result.passed).toBe(true)
    })
  })

  describe('State week unpublish: additive-only principle', () => {
    it('should not lose data when scores page returns empty for the season', () => {
      // Before unpublish: all 8 shows are on the scores page
      const beforeEntries = filterByYear(parseScorePage(SCORES_HTML), 2025)
      expect(beforeEntries).toHaveLength(8)

      // During unpublish: scores page has no 2025 entries
      const emptyPage = '<ul class="list-group"><li class="list-group-item active">2025</li></ul>'
      const duringEntries = filterByYear(parseScorePage(emptyPage), 2025)
      expect(duringEntries).toHaveLength(0)

      // The pipeline should NOT delete anything. Poll-state and season.json
      // remain unchanged. The poller simply finds no new/changed links and exits.
      let state = emptyPollState(2025)
      for (let i = 0; i < 8; i++) {
        const entry = makeRetreatEntry(`2025-02-0${i + 1}`, `Show ${i + 1}`, `2025-02-0${i + 1}T23:00:00.000Z`)
        state = addOrUpdateRetreat(state, entry)
        state = markRetreatImported(state, entry.retreatUtc, `hash${i}`, new Date())
      }

      // Verify all shows are still imported — nothing was deleted
      expect(state.retreats).toHaveLength(8)
      expect(state.retreats.every((r) => r.status === 'imported')).toBe(true)
    })

    it('should detect republished scores (after Finals) and find the new Finals show', () => {
      // After Finals: all shows republished plus Finals
      const allEntries = filterByYear(parseScorePage(SCORES_HTML), 2025)

      // Build a season with 7 shows already imported (Shows 1-6 + Prelims)
      const existingHashes = new Map<string, string>()
      for (let i = 0; i < 7; i++) {
        const html = loadRecap(RECAP_FILES[i])
        existingHashes.set(allEntries[i].recapUrl, hashContent(html))
      }

      // Check each entry against stored hashes
      let newShows = 0
      let unchangedShows = 0
      for (const entry of allEntries) {
        const storedHash = existingHashes.get(entry.recapUrl) ?? null
        const html = loadRecap(RECAP_FILES[allEntries.indexOf(entry)])
        const comparison = compareHash(hashContent(html), storedHash)

        if (comparison.status === 'new') newShows++
        if (comparison.status === 'unchanged') unchangedShows++
      }

      // 7 unchanged (Shows 1-6 + Prelims), 1 new (Finals)
      expect(unchangedShows).toBe(7)
      expect(newShows).toBe(1)
    })
  })

  describe('Timeout: retreat window expiration', () => {
    it('should mark retreat as failed when window expires without import', () => {
      const retreatUtc = '2025-02-09T00:28:00.000Z'
      let state = emptyPollState(2025)
      state = addOrUpdateRetreat(state, makeRetreatEntry('2025-02-08', 'Show #1', retreatUtc))

      // 3 hours after retreat — well past the 2-hour window
      const now = new Date('2025-02-09T03:30:00Z')
      expect(findActionableRetreats(state, now)).toHaveLength(0) // past window

      // Mark as failed
      state = markRetreatFailed(state, retreatUtc)
      expect(state.retreats[0].status).toBe('failed')
    })
  })

  describe('Poll-state persistence', () => {
    it('should round-trip poll-state through JSON file', () => {
      let state = emptyPollState(2025)
      const entry = makeRetreatEntry('2025-02-08', 'Show #1', '2025-02-09T00:28:00.000Z')
      state = addOrUpdateRetreat(state, entry)
      state = markRetreatImported(state, entry.retreatUtc, 'abc123', new Date('2025-02-09T00:45:00Z'))

      writePollState(TMP_POLL_STATE, state)
      const loaded = readPollState(TMP_POLL_STATE)

      expect(loaded.season).toBe(2025)
      expect(loaded.retreats).toHaveLength(1)
      expect(loaded.retreats[0].status).toBe('imported')
      expect(loaded.retreats[0].sourceHash).toBe('abc123')
      expect(loaded.coolDownUntilUtc).not.toBeNull()
    })
  })

  describe('Post-season: pipeline goes quiet', () => {
    it('should find no work when all retreats are imported and cool-down expired', () => {
      let state = emptyPollState(2025)

      // All 8 shows imported
      for (let i = 0; i < 8; i++) {
        const entry = makeRetreatEntry(`2025-03-0${i + 1}`, `Show ${i + 1}`, `2025-03-0${i + 1}T23:00:00.000Z`)
        state = addOrUpdateRetreat(state, entry)
        state = markRetreatImported(state, entry.retreatUtc, `hash${i}`, new Date('2025-03-30T00:00:00Z'))
      }

      // May — well after season ended, cool-down long expired
      const may = new Date('2025-05-01T18:00:00Z')
      expect(hasWork(state, may)).toBe(false)
      expect(findActionableRetreats(state, may)).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // Multi-retreat scenarios
  // -------------------------------------------------------------------------

  describe('Scenario 2a: double retreat, scores posted mid-day', () => {
    it('should import mid-day scores, then updated scores after evening retreat', () => {
      let state = emptyPollState(2026)

      // Schedule watcher adds two retreats for the same show day
      const midDay = makeRetreatEntry(
        '2026-02-28', 'Show — Regional A Retreat', '2026-02-28T19:45:00.000Z', false,
      )
      const evening = makeRetreatEntry(
        '2026-02-28', 'Show — Retreat', '2026-03-01T01:55:00.000Z',
      )
      state = addOrUpdateRetreat(state, midDay)
      state = addOrUpdateRetreat(state, evening)
      expect(state.retreats).toHaveLength(2)

      // Two distinct cron windows
      let windows = computeCronWindows(state.retreats)
      expect(windows).toHaveLength(2)

      // Mid-day: scores posted after Regional A retreat (~20:15 UTC)
      const midDayTime = new Date('2026-02-28T20:15:00Z')
      let actionable = findActionableRetreats(state, midDayTime)
      expect(actionable).toHaveLength(1)
      expect(actionable[0].eventName).toContain('Regional A')
      expect(actionable[0].isFinal).toBe(false)

      // Import mid-day scores (non-final — does NOT resolve same-day)
      const hash1 = hashContent(loadRecap(RECAP_FILES[0]))
      state = markRetreatImported(state, midDay.retreatUtc, hash1, midDayTime)
      expect(state.retreats[0].status).toBe('imported')
      expect(state.retreats[1].status).toBe('pending')

      // Only evening cron window remains
      windows = computeCronWindows(state.retreats)
      expect(windows).toHaveLength(1)
      expect(windows[0].isFinal).toBe(true)

      // Evening: updated scores posted after final retreat
      const eveningTime = new Date('2026-03-01T02:30:00Z')
      actionable = findActionableRetreats(state, eveningTime)
      expect(actionable).toHaveLength(1)

      const hash2 = hashContent(loadRecap(RECAP_FILES[1]))
      state = markRetreatImported(state, evening.retreatUtc, hash2, eveningTime)

      // Both imported, no more cron windows
      expect(state.retreats.every((r) => r.status === 'imported')).toBe(true)
      expect(computeCronWindows(state.retreats)).toHaveLength(0)
    })
  })

  describe('Scenario 2b: double retreat, no scores posted mid-day', () => {
    it('should resolve orphaned mid-day retreat when final retreat is imported', () => {
      let state = emptyPollState(2026)

      const midDay = makeRetreatEntry(
        '2026-02-28', 'Show — Regional A Retreat', '2026-02-28T19:45:00.000Z', false,
      )
      const evening = makeRetreatEntry(
        '2026-02-28', 'Show — Retreat', '2026-03-01T01:55:00.000Z',
      )
      state = addOrUpdateRetreat(state, midDay)
      state = addOrUpdateRetreat(state, evening)

      // Mid-day window passes with no scores posted
      const afterMidDay = new Date('2026-02-28T22:00:00Z')
      expect(findActionableRetreats(state, afterMidDay)).toHaveLength(0)
      expect(state.retreats[0].status).toBe('pending') // still pending, window closed

      // Gap between mid-day close (21:45) and evening start (01:55)
      const betweenWindows = new Date('2026-02-28T23:30:00Z')
      expect(findActionableRetreats(state, betweenWindows)).toHaveLength(0)

      // Evening: all scores posted after final retreat
      const eveningTime = new Date('2026-03-01T02:30:00Z')
      const actionable = findActionableRetreats(state, eveningTime)
      expect(actionable).toHaveLength(1)
      expect(actionable[0].isFinal).toBe(true)

      // Final retreat import resolves all same-day pending retreats
      const hash = hashContent(loadRecap(RECAP_FILES[0]))
      state = markRetreatImported(state, evening.retreatUtc, hash, eveningTime)

      expect(state.retreats[0].status).toBe('imported') // mid-day auto-resolved
      expect(state.retreats[1].status).toBe('imported') // evening imported
      expect(computeCronWindows(state.retreats)).toHaveLength(0)
    })
  })

  describe('Scenario 3: back-to-back Fri+Sat, double retreats each', () => {
    it('should progressively resolve retreats across both days', () => {
      let state = emptyPollState(2026)

      const friMid = makeRetreatEntry('2026-03-27', 'Fri — Regional A', '2026-03-27T19:45:00.000Z', false)
      const friEve = makeRetreatEntry('2026-03-27', 'Fri — Retreat', '2026-03-28T01:55:00.000Z')
      const satMid = makeRetreatEntry('2026-03-28', 'Sat — Regional A', '2026-03-28T19:45:00.000Z', false)
      const satEve = makeRetreatEntry('2026-03-28', 'Sat — Retreat', '2026-03-29T01:55:00.000Z')
      state = addOrUpdateRetreat(state, friMid)
      state = addOrUpdateRetreat(state, friEve)
      state = addOrUpdateRetreat(state, satMid)
      state = addOrUpdateRetreat(state, satEve)

      expect(state.retreats).toHaveLength(4)
      expect(computeCronWindows(state.retreats)).toHaveLength(4)

      // Friday evening import (final) resolves Friday mid-day too
      const hash1 = hashContent(loadRecap(RECAP_FILES[0]))
      state = markRetreatImported(state, friEve.retreatUtc, hash1, new Date('2026-03-28T02:30:00Z'))

      const imported = state.retreats.filter((r) => r.status === 'imported')
      expect(imported).toHaveLength(2) // both Friday retreats
      expect(computeCronWindows(state.retreats)).toHaveLength(2) // only Saturday windows

      // Saturday evening import (final) resolves Saturday mid-day too
      const hash2 = hashContent(loadRecap(RECAP_FILES[1]))
      state = markRetreatImported(state, satEve.retreatUtc, hash2, new Date('2026-03-29T02:30:00Z'))

      expect(state.retreats.every((r) => r.status === 'imported')).toBe(true)
      expect(computeCronWindows(state.retreats)).toHaveLength(0)
    })
  })

  describe('Scenario 4: back-to-back Fri+Sat, single retreats', () => {
    it('should handle consecutive nights with separate cron windows', () => {
      let state = emptyPollState(2026)

      const fri = makeRetreatEntry('2026-03-27', 'Fri Show — Retreat', '2026-03-28T02:07:00.000Z')
      const sat = makeRetreatEntry('2026-03-28', 'Sat Show — Retreat', '2026-03-29T02:07:00.000Z')
      state = addOrUpdateRetreat(state, fri)
      state = addOrUpdateRetreat(state, sat)

      let windows = computeCronWindows(state.retreats)
      expect(windows).toHaveLength(2)

      // Import Friday scores
      const hash1 = hashContent(loadRecap(RECAP_FILES[0]))
      state = markRetreatImported(state, fri.retreatUtc, hash1, new Date('2026-03-28T02:30:00Z'))
      windows = computeCronWindows(state.retreats)
      expect(windows).toHaveLength(1)
      expect(windows[0].retreatUtc).toBe(sat.retreatUtc)

      // Import Saturday scores
      const hash2 = hashContent(loadRecap(RECAP_FILES[1]))
      state = markRetreatImported(state, sat.retreatUtc, hash2, new Date('2026-03-29T02:30:00Z'))
      expect(state.retreats.every((r) => r.status === 'imported')).toBe(true)
      expect(computeCronWindows(state.retreats)).toHaveLength(0)
    })
  })

  describe('Reschedule: retreat moved later on show day', () => {
    it('should update retreat time and cron window when rescheduled', () => {
      let state = emptyPollState(2026)

      // Thursday watcher: retreat at 8:07 PM MST = 02:07 UTC
      const original = makeRetreatEntry('2026-02-14', 'Monarch HS — Retreat', '2026-02-15T02:07:00.000Z')
      state = addOrUpdateRetreat(state, original)

      let windows = computeCronWindows(state.retreats)
      expect(windows[0].startHourUtc).toBe(2)

      // Saturday watcher: retreat delayed to 9:07 PM MST = 03:07 UTC (same eventName)
      const delayed = makeRetreatEntry('2026-02-14', 'Monarch HS — Retreat', '2026-02-15T03:07:00.000Z')
      state = addOrUpdateRetreat(state, delayed)

      // Should update existing entry, not add a duplicate
      expect(state.retreats).toHaveLength(1)
      expect(state.retreats[0].retreatUtc).toBe('2026-02-15T03:07:00.000Z')

      // Cron window reflects the delayed time
      windows = computeCronWindows(state.retreats)
      expect(windows[0].startHourUtc).toBe(3)
      expect(windows[0].endHourUtc).toBe(5)
    })
  })

  describe('Two shows a week apart', () => {
    it('should not union cron windows from different weeks', () => {
      let state = emptyPollState(2026)

      // This Saturday
      const thisWeek = makeRetreatEntry('2026-02-14', 'Show A — Retreat', '2026-02-15T02:07:00.000Z')
      // Next Saturday
      const nextWeek = makeRetreatEntry('2026-02-21', 'Show B — Retreat', '2026-02-22T02:07:00.000Z')
      state = addOrUpdateRetreat(state, thisWeek)
      state = addOrUpdateRetreat(state, nextWeek)

      const windows = computeCronWindows(state.retreats)
      expect(windows).toHaveLength(2)

      // Each gets its own distinct window — no merged week-long cron
      expect(windows[0].retreatUtc).toBe('2026-02-15T02:07:00.000Z')
      expect(windows[1].retreatUtc).toBe('2026-02-22T02:07:00.000Z')

      // Import this week — next week unaffected
      const hash = hashContent(loadRecap(RECAP_FILES[0]))
      state = markRetreatImported(state, thisWeek.retreatUtc, hash, new Date('2026-02-15T02:30:00Z'))

      const remaining = computeCronWindows(state.retreats)
      expect(remaining).toHaveLength(1)
      expect(remaining[0].retreatUtc).toBe('2026-02-22T02:07:00.000Z')
    })
  })
})
