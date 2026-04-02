import { readFileSync, writeFileSync } from 'node:fs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RetreatStatus = 'pending' | 'imported' | 'failed'

type RetreatEntry = {
  date: string
  eventName: string
  retreatUtc: string
  windowCloseUtc: string
  status: RetreatStatus
  sourceHash: string | null
  lastImportedUtc: string | null
}

type PollState = {
  season: number
  retreats: Array<RetreatEntry>
  coolDownUntilUtc: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WINDOW_HOURS = 2
const COOL_DOWN_MINUTES = 15

// ---------------------------------------------------------------------------
// Read / Write
// ---------------------------------------------------------------------------

function readPollState(filePath: string): PollState {
  const raw = readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as PollState
}

function writePollState(filePath: string, state: PollState): void {
  writeFileSync(filePath, JSON.stringify(state, null, 2) + '\n', 'utf-8')
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

function findActionableRetreats(state: PollState, now: Date): Array<RetreatEntry> {
  const nowMs = now.getTime()
  return state.retreats.filter((r) => {
    if (r.status !== 'pending') return false
    const retreatMs = new Date(r.retreatUtc).getTime()
    const closeMs = new Date(r.windowCloseUtc).getTime()
    return nowMs >= retreatMs && nowMs < closeMs
  })
}

function isCoolDownActive(state: PollState, now: Date): boolean {
  if (!state.coolDownUntilUtc) return false
  return now.getTime() < new Date(state.coolDownUntilUtc).getTime()
}

function hasWork(state: PollState, now: Date): boolean {
  return findActionableRetreats(state, now).length > 0 || isCoolDownActive(state, now)
}

// ---------------------------------------------------------------------------
// Mutation helpers (return new state — no in-place mutation)
// ---------------------------------------------------------------------------

function markRetreatImported(
  state: PollState,
  retreatUtc: string,
  hash: string,
  now: Date,
): PollState {
  const coolDown = new Date(now.getTime() + COOL_DOWN_MINUTES * 60_000).toISOString()
  return {
    ...state,
    coolDownUntilUtc: coolDown,
    retreats: state.retreats.map((r) =>
      r.retreatUtc === retreatUtc
        ? { ...r, status: 'imported' as const, sourceHash: hash, lastImportedUtc: now.toISOString() }
        : r,
    ),
  }
}

function markRetreatFailed(state: PollState, retreatUtc: string): PollState {
  return {
    ...state,
    retreats: state.retreats.map((r) =>
      r.retreatUtc === retreatUtc ? { ...r, status: 'failed' as const } : r,
    ),
  }
}

function addOrUpdateRetreat(state: PollState, entry: RetreatEntry): PollState {
  const idx = state.retreats.findIndex(
    (r) => r.date === entry.date && r.retreatUtc === entry.retreatUtc,
  )
  if (idx === -1) {
    return { ...state, retreats: [...state.retreats, entry] }
  }
  // Only update if the existing entry is still pending
  const existing = state.retreats[idx]
  if (existing.status !== 'pending') return state
  return {
    ...state,
    retreats: state.retreats.map((r, i) => (i === idx ? { ...r, ...entry } : r)),
  }
}

function makeRetreatEntry(
  date: string,
  eventName: string,
  retreatUtc: string,
): RetreatEntry {
  const closeMs = new Date(retreatUtc).getTime() + WINDOW_HOURS * 3_600_000
  return {
    date,
    eventName,
    retreatUtc,
    windowCloseUtc: new Date(closeMs).toISOString(),
    status: 'pending',
    sourceHash: null,
    lastImportedUtc: null,
  }
}

function emptyPollState(season: number): PollState {
  return { season, retreats: [], coolDownUntilUtc: null }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  readPollState,
  writePollState,
  findActionableRetreats,
  isCoolDownActive,
  hasWork,
  markRetreatImported,
  markRetreatFailed,
  addOrUpdateRetreat,
  makeRetreatEntry,
  emptyPollState,
  WINDOW_HOURS,
  COOL_DOWN_MINUTES,
}

export type { RetreatStatus, RetreatEntry, PollState }
