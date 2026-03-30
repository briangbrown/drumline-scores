import type { SeasonMetadata, ShowData, EnsembleRegistry } from './types'

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

const cache = {
  seasons: new Map<number, SeasonMetadata>(),
  shows: new Map<string, ShowData>(),
  registry: null as EnsembleRegistry | null,
}

// ---------------------------------------------------------------------------
// Data loading functions
// ---------------------------------------------------------------------------

/**
 * Load season metadata for a given year.
 */
export async function loadSeasonMetadata(year: number): Promise<SeasonMetadata> {
  const cached = cache.seasons.get(year)
  if (cached) return cached

  const resp = await fetch(`/data/${year}/season.json`)
  if (!resp.ok) throw new Error(`Failed to load season ${year}: ${resp.status}`)

  const data = await resp.json() as SeasonMetadata
  cache.seasons.set(year, data)
  return data
}

/**
 * Load a single show's data.
 */
export async function loadShowData(year: number, showId: string): Promise<ShowData> {
  const key = `${year}/${showId}`
  const cached = cache.shows.get(key)
  if (cached) return cached

  const resp = await fetch(`/data/${year}/${showId}.json`)
  if (!resp.ok) throw new Error(`Failed to load show ${showId}: ${resp.status}`)

  const data = await resp.json() as ShowData
  cache.shows.set(key, data)
  return data
}

/**
 * Load all shows for a season (for progression view).
 */
export async function loadAllShowsForSeason(year: number): Promise<Array<ShowData>> {
  const season = await loadSeasonMetadata(year)
  const shows = await Promise.all(
    season.shows.map((show) => loadShowData(year, show.id)),
  )
  return shows
}

/**
 * Load the global ensemble registry.
 */
export async function loadEnsembleRegistry(): Promise<EnsembleRegistry> {
  if (cache.registry) return cache.registry

  const resp = await fetch('/data/ensembles.json')
  if (!resp.ok) throw new Error(`Failed to load ensemble registry: ${resp.status}`)

  const data = await resp.json() as EnsembleRegistry
  cache.registry = data
  return data
}

/**
 * Get the list of available seasons.
 * For now, returns a hardcoded list. Will be dynamic once we have a manifest.
 */
export function getAvailableYears(): Array<number> {
  return [2025]
}
