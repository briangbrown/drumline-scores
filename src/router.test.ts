import { describe, it, expect } from 'vitest'
import { parseRoute, buildRoute } from './router'

describe('parseRoute', () => {
  it('should parse empty hash to defaults', () => {
    const state = parseRoute('')
    expect(state.year).toBe(2025)
    expect(state.classId).toBe('')
    expect(state.view).toBe('progression')
    expect(state.showId).toBeNull()
    expect(state.highlight).toBeNull()
  })

  it('should parse year only', () => {
    const state = parseRoute('#/2023')
    expect(state.year).toBe(2023)
    expect(state.classId).toBe('')
    expect(state.view).toBe('progression')
  })

  it('should parse year and full class id', () => {
    const state = parseRoute('#/2025/percussion-scholastic-a')
    expect(state.year).toBe(2025)
    expect(state.classId).toBe('percussion-scholastic-a')
    expect(state.view).toBe('progression')
  })

  it('should resolve abbreviated class id to full id', () => {
    const state = parseRoute('#/2023/psa/progression')
    expect(state.classId).toBe('percussion-scholastic-a')
  })

  it('should resolve abbreviated class id case-insensitively', () => {
    const state = parseRoute('#/2023/PSA/progression')
    expect(state.classId).toBe('percussion-scholastic-a')
  })

  it('should resolve all known abbreviations', () => {
    const cases: Array<[string, string]> = [
      ['pscra', 'percussion-scholastic-concert-regional-a'],
      ['pssra', 'percussion-scholastic-standstill-regional-a'],
      ['psra', 'percussion-scholastic-regional-a'],
      ['psca', 'percussion-scholastic-concert-a'],
      ['pssa', 'percussion-scholastic-standstill-a'],
      ['psa', 'percussion-scholastic-a'],
      ['psco', 'percussion-scholastic-concert-open'],
      ['psso', 'percussion-scholastic-standstill-open'],
      ['pso', 'percussion-scholastic-open'],
      ['pscw', 'percussion-scholastic-concert-world'],
      ['psw', 'percussion-scholastic-world'],
      ['psna', 'percussion-scholastic-national-a'],
      ['pia', 'percussion-independent-a'],
      ['pisa', 'percussion-independent-standstill-a'],
      ['pio', 'percussion-independent-open'],
      ['piw', 'percussion-independent-world'],
      ['sepi', 'small-ensemble-percussion-independent'],
    ]
    for (const [abbrev, expected] of cases) {
      expect(parseRoute(`#/2025/${abbrev}/standings`).classId).toBe(expected)
    }
  })

  it('should pass through unknown class ids unchanged', () => {
    const state = parseRoute('#/2025/some-unknown-class/standings')
    expect(state.classId).toBe('some-unknown-class')
  })

  it('should parse full path', () => {
    const state = parseRoute('#/2025/percussion-scholastic-a/standings')
    expect(state.year).toBe(2025)
    expect(state.classId).toBe('percussion-scholastic-a')
    expect(state.view).toBe('standings')
  })

  it('should parse query parameters', () => {
    const state = parseRoute('#/2025/percussion-scholastic-a/standings?show=show-1&highlight=longmont')
    expect(state.showId).toBe('show-1')
    expect(state.highlight).toBe('longmont')
  })

  it('should parse cross-season view', () => {
    const state = parseRoute('#/2025/percussion-scholastic-a/cross-season')
    expect(state.view).toBe('cross-season')
  })

  it('should handle invalid year gracefully', () => {
    const state = parseRoute('#/notayear')
    expect(state.year).toBe(2025) // default
  })

  it('should handle invalid view gracefully', () => {
    const state = parseRoute('#/2025/psa/badview')
    expect(state.view).toBe('progression') // default
  })
})

describe('buildRoute', () => {
  it('should build year-only route', () => {
    const hash = buildRoute({ year: 2025, classId: '', view: 'progression', showId: null, highlight: null })
    expect(hash).toBe('#/2025')
  })

  it('should build route with abbreviated class id', () => {
    const hash = buildRoute({
      year: 2025,
      classId: 'percussion-scholastic-a',
      view: 'standings',
      showId: null,
      highlight: null,
    })
    expect(hash).toBe('#/2025/psa/standings')
  })

  it('should pass through unknown class ids unchanged', () => {
    const hash = buildRoute({
      year: 2025,
      classId: 'some-unknown-class',
      view: 'standings',
      showId: null,
      highlight: null,
    })
    expect(hash).toBe('#/2025/some-unknown-class/standings')
  })

  it('should include query parameters', () => {
    const hash = buildRoute({
      year: 2025,
      classId: 'percussion-scholastic-a',
      view: 'standings',
      showId: 'show-1',
      highlight: 'longmont',
    })
    expect(hash).toBe('#/2025/psa/standings?show=show-1&highlight=longmont')
  })

  it('should round-trip with parseRoute using full id', () => {
    const original = {
      year: 2023,
      classId: 'percussion-scholastic-a',
      view: 'standings' as const,
      showId: 'champs-finals',
      highlight: 'blue-knights',
    }
    const hash = buildRoute(original)
    const parsed = parseRoute(hash)
    expect(parsed).toEqual(original)
  })

  it('should round-trip with parseRoute using abbreviation', () => {
    const hash = '#/2023/psa/standings?show=champs-finals&highlight=blue-knights'
    const parsed = parseRoute(hash)
    const rebuilt = buildRoute(parsed)
    const reparsed = parseRoute(rebuilt)
    expect(reparsed).toEqual(parsed)
  })
})
