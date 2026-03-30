import { useState, useCallback, useEffect, useMemo } from 'react'
import { getFavorite, setFavorite, clearFavorite } from '../favorites'
import { loadEnsembleRegistry } from '../data'
import type { FavoriteEnsemble } from '../favorites'
import type { EnsembleRegistry } from '../types'

/**
 * Hook to manage the favorited ensemble with reactive state.
 * Uses the ensemble registry to resolve name variants.
 */
export function useFavorite(): {
  favorite: FavoriteEnsemble | null
  favoriteNames: Set<string>
  toggleFavorite: (ensembleName: string, classId: string) => void
  removeFavorite: () => void
  isFavoriteName: (name: string) => boolean
} {
  const [favorite, setFavoriteState] = useState<FavoriteEnsemble | null>(getFavorite)
  const [registry, setRegistry] = useState<EnsembleRegistry | null>(null)

  useEffect(() => {
    loadEnsembleRegistry().then(setRegistry)
  }, [])

  // Build the set of all name variants for the current favorite
  const favoriteNames = useMemo(() => {
    const names = new Set<string>()
    if (!favorite) return names

    names.add(favorite.ensembleName)

    if (registry) {
      for (const entry of registry.ensembles) {
        if (entry.canonicalName === favorite.ensembleName || entry.aliases.includes(favorite.ensembleName)) {
          names.add(entry.canonicalName)
          for (const a of entry.aliases) names.add(a)
          break
        }
      }
    }

    return names
  }, [favorite, registry])

  const isFavoriteName = useCallback((name: string) => {
    return favoriteNames.has(name)
  }, [favoriteNames])

  const toggleFavorite = useCallback((ensembleName: string, classId: string) => {
    // Check if this name is already the favorite (using registry awareness)
    if (favoriteNames.has(ensembleName)) {
      clearFavorite()
      setFavoriteState(null)
    } else {
      setFavorite(ensembleName, classId)
      setFavoriteState({ ensembleName, classId })
    }
  }, [favoriteNames])

  const removeFavorite = useCallback(() => {
    clearFavorite()
    setFavoriteState(null)
  }, [])

  return { favorite, favoriteNames, toggleFavorite, removeFavorite, isFavoriteName }
}
