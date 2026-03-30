import type { EnsembleEntry, EnsembleRegistry, MatchResult } from './types'

// ---------------------------------------------------------------------------
// US State abbreviations for location normalization
// ---------------------------------------------------------------------------

const STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR',
  california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
  illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS',
  kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
  'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
  wisconsin: 'WI', wyoming: 'WY',
  'district of columbia': 'DC',
}

// Common suffixes to strip for fuzzy matching
const STRIP_SUFFIXES = [
  'high school',
  'hs',
  'winter percussion',
  'indoor percussion',
  'percussion ensemble',
  'percussion',
  'winter guard',
  'drumline',
  'indoor',
]

// ---------------------------------------------------------------------------
// Location normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a location string to "City, ST" format.
 * Handles:
 * - Full state names → abbreviations ("Colorado" → "CO")
 * - Missing commas ("Lakewood CO" → "Lakewood, CO")
 * - Extra whitespace and inconsistent casing
 * - Addresses (strips street portions)
 */
export function normalizeLocation(raw: string): string {
  if (!raw || !raw.trim()) return ''

  let loc = raw.trim()

  // Remove zip codes
  loc = loc.replace(/\b\d{5}(-\d{4})?\b/, '').trim()

  // Remove street addresses (anything before a city, like "123 Main St, City, ST")
  // Heuristic: if there are 3+ comma-separated parts, drop the first
  const parts = loc.split(',').map((p) => p.trim()).filter(Boolean)

  if (parts.length >= 3) {
    // Keep last two parts (City, State)
    loc = parts.slice(-2).join(', ')
  } else if (parts.length === 2) {
    loc = parts.join(', ')
  } else if (parts.length === 1) {
    // No comma — try to split on last word being a state
    loc = parts[0]
  }

  // Normalize state name to abbreviation
  for (const [fullName, abbr] of Object.entries(STATE_ABBREVIATIONS)) {
    // Match full state name at the end (case-insensitive)
    const stateRegex = new RegExp(`\\b${fullName}$`, 'i')
    if (stateRegex.test(loc)) {
      loc = loc.replace(stateRegex, abbr)
      break
    }
  }

  // Ensure comma between city and state abbreviation
  const stateAbbrMatch = loc.match(/^(.+?)\s+([A-Z]{2})$/)
  if (stateAbbrMatch) {
    const city = stateAbbrMatch[1].replace(/,\s*$/, '')
    loc = `${city}, ${stateAbbrMatch[2]}`
  }

  // Fix double spaces and trim
  loc = loc.replace(/\s+/g, ' ').trim()

  // Title case the city portion
  const commaIdx = loc.lastIndexOf(',')
  if (commaIdx > 0) {
    const city = loc.slice(0, commaIdx).trim()
    const state = loc.slice(commaIdx + 1).trim()
    loc = `${titleCase(city)}, ${state.toUpperCase()}`
  }

  return loc
}

function titleCase(str: string): string {
  return str.replace(/\w\S*/g, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  )
}

// ---------------------------------------------------------------------------
// Ensemble matching
// ---------------------------------------------------------------------------

/**
 * Match an ensemble name against the registry.
 * Returns the best match with confidence level.
 */
export function matchEnsemble(
  registry: EnsembleRegistry,
  name: string,
  location: string = '',
): MatchResult {
  const trimmedName = name.trim()

  // 1. Exact match on canonical name
  for (const entry of registry.ensembles) {
    if (entry.canonicalName === trimmedName) {
      return { entry, confidence: 'exact', matchedOn: entry.canonicalName }
    }
  }

  // 2. Alias match
  for (const entry of registry.ensembles) {
    for (const alias of entry.aliases) {
      if (alias === trimmedName) {
        return { entry, confidence: 'alias', matchedOn: alias }
      }
    }
  }

  // 3. Fuzzy match: strip common suffixes and compare core name
  const normalizedInput = stripSuffixes(trimmedName.toLowerCase())
  const normalizedLocation = normalizeLocation(location)

  let bestMatch: EnsembleEntry | null = null
  let bestScore = 0
  let bestMatchedOn: string | null = null

  for (const entry of registry.ensembles) {
    const normalizedCanonical = stripSuffixes(entry.canonicalName.toLowerCase())

    // Check canonical name
    const score = fuzzyScore(normalizedInput, normalizedCanonical, normalizedLocation, entry)
    if (score > bestScore) {
      bestScore = score
      bestMatch = entry
      bestMatchedOn = entry.canonicalName
    }

    // Check aliases
    for (const alias of entry.aliases) {
      const normalizedAlias = stripSuffixes(alias.toLowerCase())
      const aliasScore = fuzzyScore(normalizedInput, normalizedAlias, normalizedLocation, entry)
      if (aliasScore > bestScore) {
        bestScore = aliasScore
        bestMatch = entry
        bestMatchedOn = alias
      }
    }
  }

  if (bestMatch && bestScore >= 0.7) {
    return { entry: bestMatch, confidence: 'fuzzy', matchedOn: bestMatchedOn }
  }

  return { entry: null, confidence: 'unknown', matchedOn: null }
}

function stripSuffixes(name: string): string {
  let result = name
  for (const suffix of STRIP_SUFFIXES) {
    const regex = new RegExp(`\\s+${suffix}$`, 'i')
    result = result.replace(regex, '')
  }
  // Also strip quoted suffixes like '"A"', '"Open"'
  result = result.replace(/\s*"[^"]*"\s*$/, '')
  return result.trim()
}

function fuzzyScore(
  normalizedInput: string,
  normalizedCandidate: string,
  normalizedLocation: string,
  entry: EnsembleEntry,
): number {
  if (!normalizedInput || !normalizedCandidate) return 0

  // Exact match after stripping
  if (normalizedInput === normalizedCandidate) {
    let score = 0.9
    // Location boost
    if (normalizedLocation && locationMatches(normalizedLocation, entry)) {
      score = 0.95
    }
    return score
  }

  // Check if one contains the other
  if (normalizedInput.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedInput)) {
    let score = 0.75
    if (normalizedLocation && locationMatches(normalizedLocation, entry)) {
      score = 0.85
    }
    return score
  }

  return 0
}

function locationMatches(normalizedLocation: string, entry: EnsembleEntry): boolean {
  if (!entry.city || !entry.state) return false
  const entryLocation = `${entry.city}, ${entry.state}`
  return normalizedLocation.toLowerCase() === entryLocation.toLowerCase()
}

// ---------------------------------------------------------------------------
// Registry construction helpers
// ---------------------------------------------------------------------------

/**
 * Create a new ensemble entry from parsed data.
 */
export function createEnsembleEntry(
  name: string,
  location: string,
): EnsembleEntry {
  const normalized = normalizeLocation(location)
  const parts = normalized.split(',').map((p) => p.trim())

  return {
    id: generateEnsembleId(name),
    canonicalName: name,
    shortName: generateShortName(name),
    aliases: [],
    city: parts[0] ?? '',
    state: parts[1] ?? '',
  }
}

function generateEnsembleId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function generateShortName(name: string): string {
  // Strip common suffixes for a shorter display name
  let short = name
    .replace(/\s+(High School|HS|Winter Percussion|Indoor Percussion|Percussion Ensemble|Percussion)\b/gi, '')
    .replace(/\s*"[^"]*"\s*$/, '')
    .trim()

  // If result is too long, abbreviate further
  if (short.length > 20) {
    short = short.replace(/\s+(International|Community|District \d+)\b/gi, '')
  }

  return short || name
}

/**
 * Add an alias to an existing registry entry if not already present.
 */
export function addAlias(entry: EnsembleEntry, alias: string): void {
  if (alias !== entry.canonicalName && !entry.aliases.includes(alias)) {
    entry.aliases.push(alias)
  }
}
