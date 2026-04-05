// ---------------------------------------------------------------------------
// Client-side hash router
// URL shape: #/<year>/<classId>/<view>?show=<showId>&highlight=<ensemble>
// ---------------------------------------------------------------------------

import { getClassIdAbbreviation, resolveClassIdAlias } from './parser'

export type ViewType = 'progression' | 'standings' | 'cross-season'

export type RouteState = {
  year: number
  classId: string
  view: ViewType
  showId: string | null
  highlight: string | null
}

const DEFAULT_YEAR = 2025
const DEFAULT_VIEW: ViewType = 'progression'

/**
 * Check whether a hash string contains an explicit year segment.
 */
export function hashHasYear(hash: string): boolean {
  const path = hash.replace(/^#\/?/, '').split('?')[0]
  const first = path.split('/').filter(Boolean)[0]
  if (!first) return false
  const n = parseInt(first, 10)
  return !isNaN(n) && n >= 2000 && n <= 2100
}

/**
 * Parse the current hash into a RouteState.
 */
export function parseRoute(hash: string): RouteState {
  const state: RouteState = {
    year: DEFAULT_YEAR,
    classId: '',
    view: DEFAULT_VIEW,
    showId: null,
    highlight: null,
  }

  // Remove leading #/ or #
  let path = hash.replace(/^#\/?/, '')

  // Split query string
  const queryIdx = path.indexOf('?')
  let query = ''
  if (queryIdx >= 0) {
    query = path.slice(queryIdx + 1)
    path = path.slice(0, queryIdx)
  }

  // Parse path segments: year/classId/view
  const segments = path.split('/').filter(Boolean)

  if (segments.length >= 1) {
    const yearNum = parseInt(segments[0], 10)
    if (!isNaN(yearNum) && yearNum >= 2000 && yearNum <= 2100) {
      state.year = yearNum
    }
  }

  if (segments.length >= 2) {
    state.classId = resolveClassIdAlias(decodeURIComponent(segments[1]))
  }

  if (segments.length >= 3) {
    const view = segments[2] as ViewType
    if (view === 'progression' || view === 'standings' || view === 'cross-season') {
      state.view = view
    }
  }

  // Parse query parameters
  const params = new URLSearchParams(query)
  state.showId = params.get('show')
  state.highlight = params.get('highlight')

  return state
}

/**
 * Build a hash string from a RouteState.
 */
export function buildRoute(state: RouteState): string {
  let hash = `#/${state.year}`

  if (state.classId) {
    hash += `/${encodeURIComponent(getClassIdAbbreviation(state.classId))}`
    hash += `/${state.view}`
  }

  const params = new URLSearchParams()
  if (state.showId) params.set('show', state.showId)
  if (state.highlight) params.set('highlight', state.highlight)

  const queryStr = params.toString()
  if (queryStr) hash += `?${queryStr}`

  return hash
}

/**
 * Navigate to a new route by updating window.location.hash.
 */
export function navigate(state: RouteState): void {
  window.location.hash = buildRoute(state)
}
