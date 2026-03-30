import { useState, useCallback } from 'react'
import { getFavorite, setFavorite, clearFavorite } from '../favorites'
import type { FavoriteEnsemble } from '../favorites'

/**
 * Hook to manage the favorited ensemble with reactive state.
 */
export function useFavorite(): {
  favorite: FavoriteEnsemble | null
  toggleFavorite: (ensembleName: string, classId: string) => void
  removeFavorite: () => void
} {
  const [favorite, setFavoriteState] = useState<FavoriteEnsemble | null>(getFavorite)

  const toggleFavorite = useCallback((ensembleName: string, classId: string) => {
    const current = getFavorite()
    if (current?.ensembleName === ensembleName) {
      clearFavorite()
      setFavoriteState(null)
    } else {
      setFavorite(ensembleName, classId)
      setFavoriteState({ ensembleName, classId })
    }
  }, [])

  const removeFavorite = useCallback(() => {
    clearFavorite()
    setFavoriteState(null)
  }, [])

  return { favorite, toggleFavorite, removeFavorite }
}
