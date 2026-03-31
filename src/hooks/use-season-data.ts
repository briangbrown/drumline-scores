import { useState, useEffect, useCallback } from 'react'
import { loadSeasonMetadata, loadAllShowsForSeason, loadAvailableYears, clearCache } from '../data'
import type { SeasonMetadata, ShowData } from '../types'

type SeasonDataState = {
  years: Array<number>
  season: SeasonMetadata | null
  shows: Array<ShowData>
  isLoading: boolean
  error: string | null
}

/**
 * Hook to load available years, season metadata, and all show data for a year.
 * Automatically refetches when coming back online.
 */
export function useSeasonData(year: number): SeasonDataState {
  const [state, setState] = useState<SeasonDataState>({
    years: [],
    season: null,
    shows: [],
    isLoading: true,
    error: null,
  })

  // Track a reload counter to force refetch
  const [reloadKey, setReloadKey] = useState(0)

  // Refetch when coming back online
  useEffect(() => {
    const handleOnline = () => {
      clearCache()
      setReloadKey((k) => k + 1)
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  // Load available years
  const loadYears = useCallback(() => {
    loadAvailableYears().then((years) => {
      setState((prev) => ({ ...prev, years }))
    })
  }, [])

  useEffect(() => {
    loadYears()
  }, [loadYears, reloadKey])

  // Load season data when year or reloadKey changes
  useEffect(() => {
    let cancelled = false

    setState((prev) => ({ ...prev, isLoading: true, error: null, shows: [], season: null }))

    Promise.all([
      loadSeasonMetadata(year),
      loadAllShowsForSeason(year),
    ])
      .then(([season, shows]) => {
        if (!cancelled) {
          setState((prev) => ({ ...prev, season, shows, isLoading: false, error: null }))
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load data'
          setState((prev) => ({ ...prev, season: null, shows: [], isLoading: false, error: message }))
        }
      })

    return () => {
      cancelled = true
    }
  }, [year, reloadKey])

  return state
}
