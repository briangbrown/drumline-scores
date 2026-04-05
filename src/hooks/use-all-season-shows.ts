import { useState, useEffect } from 'react'
import { loadAllShowsAllSeasons } from '../data'
import type { ShowData } from '../types'

type AllSeasonShowsState = {
  showsByYear: Map<number, Array<ShowData>>
  isLoading: boolean
  error: string | null
}

/**
 * Hook to load all shows for every available season.
 * Used for computing season-level box plot stats.
 */
export function useAllSeasonShows(): AllSeasonShowsState {
  const [state, setState] = useState<AllSeasonShowsState>({
    showsByYear: new Map(),
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    loadAllShowsAllSeasons()
      .then((showsByYear) => {
        if (!cancelled) {
          setState({ showsByYear, isLoading: false, error: null })
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load data'
          setState({ showsByYear: new Map(), isLoading: false, error: message })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
