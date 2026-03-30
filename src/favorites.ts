// ---------------------------------------------------------------------------
// Favorites — localStorage-backed ensemble personalization
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'rmpa-favorite'

export type FavoriteEnsemble = {
  ensembleName: string
  classId: string
}

/**
 * Get the current favorite ensemble, or null if none set.
 */
export function getFavorite(): FavoriteEnsemble | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as FavoriteEnsemble
  } catch {
    return null
  }
}

/**
 * Set the favorite ensemble.
 */
export function setFavorite(ensembleName: string, classId: string): void {
  const fav: FavoriteEnsemble = { ensembleName, classId }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fav))
}

/**
 * Clear the favorite ensemble.
 */
export function clearFavorite(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Check if a given ensemble is the current favorite.
 */
export function isFavorite(ensembleName: string): boolean {
  const fav = getFavorite()
  return fav !== null && fav.ensembleName === ensembleName
}
