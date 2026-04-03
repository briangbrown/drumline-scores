import { describe, it, expect } from 'vitest'
import {
  findActionableRetreats,
  isCoolDownActive,
  hasWork,
  markRetreatImported,
  markRetreatFailed,
  addOrUpdateRetreat,
  makeRetreatEntry,
  emptyPollState,
  COOL_DOWN_MINUTES,
} from './pollState'
import type { PollState } from './pollState'

function makeState(overrides: Partial<PollState> = {}): PollState {
  return { ...emptyPollState(2026), ...overrides }
}

describe('findActionableRetreats', () => {
  it('should return empty when no retreats exist', () => {
    const state = makeState()
    expect(findActionableRetreats(state, new Date())).toEqual([])
  })

  it('should return empty when retreat is in the future', () => {
    const entry = makeRetreatEntry('2026-03-01', 'Show #1', '2026-03-01T23:00:00Z')
    const state = makeState({ retreats: [entry] })
    const now = new Date('2026-03-01T20:00:00Z')
    expect(findActionableRetreats(state, now)).toEqual([])
  })

  it('should return retreat when now is within the window', () => {
    const entry = makeRetreatEntry('2026-03-01', 'Show #1', '2026-03-01T23:00:00Z')
    const state = makeState({ retreats: [entry] })
    const now = new Date('2026-03-01T23:30:00Z')
    expect(findActionableRetreats(state, now)).toHaveLength(1)
    expect(findActionableRetreats(state, now)[0].eventName).toBe('Show #1')
  })

  it('should return empty when now is past the window close', () => {
    const entry = makeRetreatEntry('2026-03-01', 'Show #1', '2026-03-01T23:00:00Z')
    const state = makeState({ retreats: [entry] })
    const now = new Date('2026-03-02T02:00:00Z') // 3 hours after retreat
    expect(findActionableRetreats(state, now)).toEqual([])
  })

  it('should not return imported retreats', () => {
    const entry = { ...makeRetreatEntry('2026-03-01', 'Show #1', '2026-03-01T23:00:00Z'), status: 'imported' as const, sourceHash: 'abc', lastImportedUtc: '2026-03-01T23:30:00Z' }
    const state = makeState({ retreats: [entry] })
    const now = new Date('2026-03-01T23:30:00Z')
    expect(findActionableRetreats(state, now)).toEqual([])
  })

  it('should not return failed retreats', () => {
    const entry = { ...makeRetreatEntry('2026-03-01', 'Show #1', '2026-03-01T23:00:00Z'), status: 'failed' as const }
    const state = makeState({ retreats: [entry] })
    const now = new Date('2026-03-01T23:30:00Z')
    expect(findActionableRetreats(state, now)).toEqual([])
  })
})

describe('isCoolDownActive', () => {
  it('should return false when no cool-down is set', () => {
    expect(isCoolDownActive(makeState(), new Date())).toBe(false)
  })

  it('should return true when now is before cool-down expiry', () => {
    const state = makeState({ coolDownUntilUtc: '2026-03-01T23:45:00Z' })
    expect(isCoolDownActive(state, new Date('2026-03-01T23:40:00Z'))).toBe(true)
  })

  it('should return false when now is past cool-down expiry', () => {
    const state = makeState({ coolDownUntilUtc: '2026-03-01T23:45:00Z' })
    expect(isCoolDownActive(state, new Date('2026-03-01T23:50:00Z'))).toBe(false)
  })
})

describe('hasWork', () => {
  it('should return false for empty state', () => {
    expect(hasWork(makeState(), new Date())).toBe(false)
  })

  it('should return true when actionable retreat exists', () => {
    const entry = makeRetreatEntry('2026-03-01', 'Show #1', '2026-03-01T23:00:00Z')
    const state = makeState({ retreats: [entry] })
    expect(hasWork(state, new Date('2026-03-01T23:30:00Z'))).toBe(true)
  })

  it('should return true when cool-down is active', () => {
    const state = makeState({ coolDownUntilUtc: '2026-03-01T23:45:00Z' })
    expect(hasWork(state, new Date('2026-03-01T23:40:00Z'))).toBe(true)
  })
})

describe('markRetreatImported', () => {
  it('should set status to imported with hash and timestamp', () => {
    const entry = makeRetreatEntry('2026-03-01', 'Show #1', '2026-03-01T23:00:00Z')
    const state = makeState({ retreats: [entry] })
    const now = new Date('2026-03-01T23:30:00Z')
    const updated = markRetreatImported(state, '2026-03-01T23:00:00Z', 'abc123', now)

    expect(updated.retreats[0].status).toBe('imported')
    expect(updated.retreats[0].sourceHash).toBe('abc123')
    expect(updated.retreats[0].lastImportedUtc).toBe(now.toISOString())
  })

  it('should set cool-down to now + 15 minutes', () => {
    const entry = makeRetreatEntry('2026-03-01', 'Show #1', '2026-03-01T23:00:00Z')
    const state = makeState({ retreats: [entry] })
    const now = new Date('2026-03-01T23:30:00Z')
    const updated = markRetreatImported(state, '2026-03-01T23:00:00Z', 'abc123', now)

    const expectedCoolDown = new Date(now.getTime() + COOL_DOWN_MINUTES * 60_000).toISOString()
    expect(updated.coolDownUntilUtc).toBe(expectedCoolDown)
  })

  it('should not modify other retreats when importing a non-final retreat', () => {
    const entry1 = makeRetreatEntry('2026-03-01', 'Show #1 (Regional A)', '2026-03-01T20:00:00Z', false)
    const entry2 = makeRetreatEntry('2026-03-01', 'Show #1 (Final)', '2026-03-02T01:00:00Z')
    const state = makeState({ retreats: [entry1, entry2] })
    const updated = markRetreatImported(state, '2026-03-01T20:00:00Z', 'abc', new Date())

    expect(updated.retreats[0].status).toBe('imported')
    expect(updated.retreats[1].status).toBe('pending')
  })

  it('should resolve same-day pending retreats when importing a final retreat', () => {
    const entry1 = makeRetreatEntry('2026-03-01', 'Show #1 (Regional A)', '2026-03-01T20:00:00Z', false)
    const entry2 = makeRetreatEntry('2026-03-01', 'Show #1 (Final)', '2026-03-02T01:00:00Z')
    const state = makeState({ retreats: [entry1, entry2] })
    const updated = markRetreatImported(state, '2026-03-02T01:00:00Z', 'abc', new Date())

    expect(updated.retreats[0].status).toBe('imported') // auto-resolved
    expect(updated.retreats[1].status).toBe('imported')
  })
})

describe('markRetreatFailed', () => {
  it('should set status to failed', () => {
    const entry = makeRetreatEntry('2026-03-01', 'Show #1', '2026-03-01T23:00:00Z')
    const state = makeState({ retreats: [entry] })
    const updated = markRetreatFailed(state, '2026-03-01T23:00:00Z')

    expect(updated.retreats[0].status).toBe('failed')
  })
})

describe('addOrUpdateRetreat', () => {
  it('should add a new retreat entry', () => {
    const state = makeState()
    const entry = makeRetreatEntry('2026-03-01', 'Show #1', '2026-03-01T23:00:00Z')
    const updated = addOrUpdateRetreat(state, entry)

    expect(updated.retreats).toHaveLength(1)
    expect(updated.retreats[0].eventName).toBe('Show #1')
  })

  it('should update a pending retreat with the same date and eventName', () => {
    const entry = makeRetreatEntry('2026-03-01', 'Show #1 — Retreat', '2026-03-01T23:00:00Z')
    const state = makeState({ retreats: [entry] })
    // Same eventName, different time (rescheduled later)
    const updated = addOrUpdateRetreat(state, {
      ...entry,
      retreatUtc: '2026-03-01T23:30:00Z',
      windowCloseUtc: '2026-03-02T01:30:00Z',
    })

    expect(updated.retreats).toHaveLength(1)
    expect(updated.retreats[0].retreatUtc).toBe('2026-03-01T23:30:00Z')
  })

  it('should not overwrite an imported retreat', () => {
    const entry = {
      ...makeRetreatEntry('2026-03-01', 'Show #1', '2026-03-01T23:00:00Z'),
      status: 'imported' as const,
      sourceHash: 'abc',
      lastImportedUtc: '2026-03-01T23:30:00Z',
    }
    const state = makeState({ retreats: [entry] })
    const updated = addOrUpdateRetreat(state, makeRetreatEntry('2026-03-01', 'Show #1', '2026-03-01T23:30:00Z'))

    expect(updated.retreats[0].eventName).toBe('Show #1')
    expect(updated.retreats[0].status).toBe('imported')
  })

  it('should add a second retreat for the same date with different retreatUtc (split show)', () => {
    const entry1 = makeRetreatEntry('2026-03-01', 'Show #1 (Regional A)', '2026-03-01T20:00:00Z')
    const state = makeState({ retreats: [entry1] })
    const entry2 = makeRetreatEntry('2026-03-01', 'Show #1 (Final)', '2026-03-02T01:00:00Z')
    const updated = addOrUpdateRetreat(state, entry2)

    expect(updated.retreats).toHaveLength(2)
  })
})

describe('makeRetreatEntry', () => {
  it('should compute windowCloseUtc as retreat time + 2 hours', () => {
    const entry = makeRetreatEntry('2026-03-01', 'Show #1', '2026-03-01T23:00:00Z')
    expect(entry.windowCloseUtc).toBe('2026-03-02T01:00:00.000Z')
    expect(entry.status).toBe('pending')
    expect(entry.sourceHash).toBeNull()
    expect(entry.lastImportedUtc).toBeNull()
  })
})
