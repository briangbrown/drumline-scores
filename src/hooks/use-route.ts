import { useState, useEffect, useCallback } from 'react'
import { parseRoute, buildRoute } from '../router'
import type { RouteState, ViewType } from '../router'

/**
 * Hook that syncs RouteState with window.location.hash.
 */
export function useRoute(): {
  route: RouteState
  setYear: (year: number) => void
  setClassId: (classId: string) => void
  setView: (view: ViewType) => void
  setShowId: (showId: string | null) => void
  setHighlight: (highlight: string | null) => void
  updateRoute: (partial: Partial<RouteState>) => void
} {
  const [route, setRoute] = useState<RouteState>(() =>
    parseRoute(window.location.hash),
  )

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseRoute(window.location.hash))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const updateRoute = useCallback(
    (partial: Partial<RouteState>) => {
      const next = { ...route, ...partial }
      window.location.hash = buildRoute(next)
    },
    [route],
  )

  const setYear = useCallback((year: number) => updateRoute({ year }), [updateRoute])
  const setClassId = useCallback((classId: string) => updateRoute({ classId }), [updateRoute])
  const setView = useCallback((view: ViewType) => updateRoute({ view }), [updateRoute])
  const setShowId = useCallback((showId: string | null) => updateRoute({ showId }), [updateRoute])
  const setHighlight = useCallback((highlight: string | null) => updateRoute({ highlight }), [updateRoute])

  return { route, setYear, setClassId, setView, setShowId, setHighlight, updateRoute }
}
