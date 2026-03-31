import type { SeasonMetadata, ShowData, EnsembleRegistry } from './types'

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

const cache = {
  seasons: new Map<number, SeasonMetadata>(),
  shows: new Map<string, ShowData>(),
  registry: null as EnsembleRegistry | null,
  years: null as Array<number> | null,
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
 * Parse a show date string into a Date for sorting.
 * Handles formats like "Saturday, February 27, 2016 - Heritage High School"
 * and "Saturday, April 6, 2019".
 */
export function parseShowDate(dateStr: string): Date {
  const withoutDay = dateStr.replace(/^\w+,\s*/, '')
  const withoutVenue = withoutDay.replace(/\s*-\s*.*$/, '')
  return new Date(withoutVenue)
}

/**
 * Load all shows for a season (for progression view).
 * Shows are sorted chronologically by date.
 */
export async function loadAllShowsForSeason(year: number): Promise<Array<ShowData>> {
  const season = await loadSeasonMetadata(year)
  const shows = await Promise.all(
    season.shows.map((show) => loadShowData(year, show.id)),
  )
  shows.sort((a, b) => parseShowDate(a.metadata.date).getTime() - parseShowDate(b.metadata.date).getTime())
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
 * Load the last show (typically finals) from each available season.
 * Used for cross-season comparison.
 */
export async function loadFinalShowPerSeason(): Promise<Array<ShowData>> {
  const years = await loadAvailableYears()
  const results: Array<ShowData> = []

  for (const year of years) {
    try {
      const season = await loadSeasonMetadata(year)
      if (season.shows.length === 0) continue
      // Last show in the list is typically finals/championships
      const lastShow = season.shows[season.shows.length - 1]
      const showData = await loadShowData(year, lastShow.id)
      results.push(showData)
    } catch {
      // Skip years that fail to load
    }
  }

  return results
}

/**
 * Clear all in-memory caches. Call when coming back online to force refetch.
 */
export function clearCache(): void {
  cache.seasons.clear()
  cache.shows.clear()
  cache.registry = null
  cache.years = null
}

/**
 * Load the list of available seasons from the years manifest.
 */
export async function loadAvailableYears(): Promise<Array<number>> {
  if (cache.years) return cache.years

  const resp = await fetch('/data/years.json')
  if (!resp.ok) return [2025]

  const data = await resp.json() as { years: Array<number> }
  cache.years = data.years
  return data.years
}
