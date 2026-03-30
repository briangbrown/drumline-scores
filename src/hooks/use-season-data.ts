import { useState, useEffect } from 'react'
import { loadSeasonMetadata, loadAllShowsForSeason, loadAvailableYears } from '../data'
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
 */
export function useSeasonData(year: number): SeasonDataState {
  const [state, setState] = useState<SeasonDataState>({
    years: [],
    season: null,
    shows: [],
    isLoading: true,
    error: null,
  })

  // Load available years once
  useEffect(() => {
    loadAvailableYears().then((years) => {
      setState((prev) => ({ ...prev, years }))
    })
  }, [])

  // Load season data when year changes
  useEffect(() => {
    let cancelled = false

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

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
  }, [year])

  return state
}
