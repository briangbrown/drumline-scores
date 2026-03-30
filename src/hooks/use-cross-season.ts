import { useState, useEffect } from 'react'
import { loadFinalShowPerSeason } from '../data'
import type { ShowData } from '../types'

type CrossSeasonState = {
  shows: Array<ShowData>
  isLoading: boolean
  error: string | null
}

/**
 * Hook to load the final show from each available season.
 */
export function useCrossSeason(): CrossSeasonState {
  const [state, setState] = useState<CrossSeasonState>({
    shows: [],
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    loadFinalShowPerSeason()
      .then((shows) => {
        if (!cancelled) {
          setState({ shows, isLoading: false, error: null })
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load data'
          setState({ shows: [], isLoading: false, error: message })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
