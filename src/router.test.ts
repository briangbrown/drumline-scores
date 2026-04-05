import { describe, it, expect } from 'vitest'
import { parseRoute, buildRoute, hashHasYear } from './router'

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

  it('should parse year and class', () => {
    const state = parseRoute('#/2025/percussion-scholastic-a')
    expect(state.year).toBe(2025)
    expect(state.classId).toBe('percussion-scholastic-a')
    expect(state.view).toBe('progression')
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

describe('hashHasYear', () => {
  it('should return false for empty hash', () => {
    expect(hashHasYear('')).toBe(false)
  })

  it('should return false for bare hash', () => {
    expect(hashHasYear('#')).toBe(false)
    expect(hashHasYear('#/')).toBe(false)
  })

  it('should return true when year is present', () => {
    expect(hashHasYear('#/2025')).toBe(true)
    expect(hashHasYear('#/2025/psa/standings')).toBe(true)
  })

  it('should return false for non-year first segment', () => {
    expect(hashHasYear('#/notayear')).toBe(false)
  })

  it('should return false for out-of-range year', () => {
    expect(hashHasYear('#/1999')).toBe(false)
    expect(hashHasYear('#/2101')).toBe(false)
  })
})

describe('buildRoute', () => {
  it('should build year-only route', () => {
    const hash = buildRoute({ year: 2025, classId: '', view: 'progression', showId: null, highlight: null })
    expect(hash).toBe('#/2025')
  })

  it('should build full route', () => {
    const hash = buildRoute({
      year: 2025,
      classId: 'percussion-scholastic-a',
      view: 'standings',
      showId: null,
      highlight: null,
    })
    expect(hash).toBe('#/2025/percussion-scholastic-a/standings')
  })

  it('should include query parameters', () => {
    const hash = buildRoute({
      year: 2025,
      classId: 'psa',
      view: 'standings',
      showId: 'show-1',
      highlight: 'longmont',
    })
    expect(hash).toBe('#/2025/psa/standings?show=show-1&highlight=longmont')
  })

  it('should round-trip with parseRoute', () => {
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
})
