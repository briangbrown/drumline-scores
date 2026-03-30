import { describe, it, expect } from 'vitest'
import {
  normalizeLocation,
  matchEnsemble,
  createEnsembleEntry,
  addAlias,
} from './ensemble-registry'
import type { EnsembleRegistry } from './types'

describe('normalizeLocation', () => {
  it('should normalize full state names to abbreviations', () => {
    expect(normalizeLocation('Lakewood, Colorado')).toBe('Lakewood, CO')
    expect(normalizeLocation('Parker, Colorado')).toBe('Parker, CO')
  })

  it('should handle missing comma between city and state', () => {
    expect(normalizeLocation('Lakewood CO')).toBe('Lakewood, CO')
  })

  it('should handle already-abbreviated state', () => {
    expect(normalizeLocation('Lakewood, CO')).toBe('Lakewood, CO')
  })

  it('should fix extra whitespace', () => {
    expect(normalizeLocation('Englewood , Colorado')).toBe('Englewood, CO')
    expect(normalizeLocation('  Lakewood,  CO  ')).toBe('Lakewood, CO')
  })

  it('should handle city-only (no state)', () => {
    expect(normalizeLocation('Colorado Springs')).toBe('Colorado Springs')
  })

  it('should return empty string for empty input', () => {
    expect(normalizeLocation('')).toBe('')
    expect(normalizeLocation('  ')).toBe('')
  })

  it('should strip zip codes', () => {
    expect(normalizeLocation('Lakewood, CO 80401')).toBe('Lakewood, CO')
  })

  it('should title-case city names', () => {
    expect(normalizeLocation('LAKEWOOD, CO')).toBe('Lakewood, CO')
    expect(normalizeLocation('lakewood, co')).toBe('Lakewood, CO')
  })

  it('should handle three-part addresses by keeping last two', () => {
    expect(normalizeLocation('123 Main St, Lakewood, CO')).toBe('Lakewood, CO')
  })
})

describe('matchEnsemble', () => {
  const registry: EnsembleRegistry = {
    ensembles: [
      {
        id: 'longmont-high-school',
        canonicalName: 'Longmont High School',
        shortName: 'Longmont',
        aliases: ['Longmont HS', 'Longmont High School Winter Percussion'],
        city: 'Longmont',
        state: 'CO',
      },
      {
        id: 'blue-knights',
        canonicalName: 'Blue Knights',
        shortName: 'Blue Knights',
        aliases: ['Blue Knights Indoor Percussion', 'Blue Knights Percussion Ensemble'],
        city: 'Denver',
        state: 'CO',
      },
      {
        id: 'highlands-ranch-high-school',
        canonicalName: 'Highlands Ranch High School',
        shortName: 'Highlands Ranch',
        aliases: [],
        city: 'Highlands Ranch',
        state: 'CO',
      },
    ],
  }

  it('should match by exact canonical name', () => {
    const result = matchEnsemble(registry, 'Longmont High School')
    expect(result.confidence).toBe('exact')
    expect(result.entry?.id).toBe('longmont-high-school')
  })

  it('should match by alias', () => {
    const result = matchEnsemble(registry, 'Longmont HS')
    expect(result.confidence).toBe('alias')
    expect(result.entry?.id).toBe('longmont-high-school')
  })

  it('should fuzzy match after stripping suffixes', () => {
    const result = matchEnsemble(registry, 'Longmont High School Percussion')
    expect(result.confidence).toBe('fuzzy')
    expect(result.entry?.id).toBe('longmont-high-school')
  })

  it('should return unknown for unrecognized names', () => {
    const result = matchEnsemble(registry, 'Totally Unknown School')
    expect(result.confidence).toBe('unknown')
    expect(result.entry).toBeNull()
  })

  it('should boost confidence with location match', () => {
    const result = matchEnsemble(registry, 'Highlands Ranch', 'Highlands Ranch, CO')
    expect(result.confidence).toBe('fuzzy')
    expect(result.entry?.id).toBe('highlands-ranch-high-school')
  })
})

describe('createEnsembleEntry', () => {
  it('should create an entry with normalized location', () => {
    const entry = createEnsembleEntry('Longmont High School', 'Longmont, Colorado')
    expect(entry.id).toBe('longmont-high-school')
    expect(entry.canonicalName).toBe('Longmont High School')
    expect(entry.shortName).toBe('Longmont')
    expect(entry.city).toBe('Longmont')
    expect(entry.state).toBe('CO')
    expect(entry.aliases).toEqual([])
  })

  it('should generate short name by stripping common suffixes', () => {
    const entry = createEnsembleEntry('Silver Creek High School', 'Longmont, CO')
    expect(entry.shortName).toBe('Silver Creek')
  })

  it('should handle percussion ensemble suffix', () => {
    const entry = createEnsembleEntry('Harrison District 2 Percussion Ensemble', 'Colorado Springs, CO')
    expect(entry.shortName).toBe('Harrison District 2')
  })
})

describe('addAlias', () => {
  it('should add a new alias', () => {
    const entry = createEnsembleEntry('Test School', 'Denver, CO')
    addAlias(entry, 'Test HS')
    expect(entry.aliases).toContain('Test HS')
  })

  it('should not add duplicate aliases', () => {
    const entry = createEnsembleEntry('Test School', 'Denver, CO')
    addAlias(entry, 'Test HS')
    addAlias(entry, 'Test HS')
    expect(entry.aliases.length).toBe(1)
  })

  it('should not add canonical name as alias', () => {
    const entry = createEnsembleEntry('Test School', 'Denver, CO')
    addAlias(entry, 'Test School')
    expect(entry.aliases.length).toBe(0)
  })
})
