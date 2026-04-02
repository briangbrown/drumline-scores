import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseScorePage, filterByYear } from './scrapeScores'

const html = readFileSync(
  resolve(import.meta.dirname, '../../data/test-fixtures/rmpa-scores-page.html'),
  'utf-8',
)

describe('parseScorePage', () => {
  const entries = parseScorePage(html)

  it('should parse entries from multiple years', () => {
    const years = new Set(entries.map((e) => e.year))
    expect(years.size).toBeGreaterThan(5)
    expect(years.has(2025)).toBe(true)
    expect(years.has(2024)).toBe(true)
    expect(years.has(2015)).toBe(true)
  })

  it('should parse all 8 entries for 2025', () => {
    const y2025 = entries.filter((e) => e.year === 2025)
    expect(y2025).toHaveLength(8)
  })

  it('should extract correct recap URLs', () => {
    const y2025 = entries.filter((e) => e.year === 2025)
    expect(y2025[0].recapUrl).toContain('recaps.competitionsuite.com')
    expect(y2025[0].recapUrl).toMatch(/\.htm$/)
  })

  it('should extract date text from link', () => {
    const y2025 = entries.filter((e) => e.year === 2025)
    expect(y2025[0].date).toBe('March, 29 2025')
  })

  it('should extract event name from adjacent text', () => {
    const y2025 = entries.filter((e) => e.year === 2025)
    expect(y2025[0].eventName).toBe('RMPA State Championships')
    const show1 = y2025.find((e) => e.date.includes('February, 8'))
    expect(show1?.eventName).toBe('Regular Season Show #1')
  })

  it('should skip non-competitionsuite links (pre-2013 PDFs)', () => {
    // Entries before 2013 link to PDFs, not competitionsuite
    const allUrls = entries.map((e) => e.recapUrl)
    expect(allUrls.every((url) => url.includes('competitionsuite.com'))).toBe(true)
  })

  it('should parse 7 entries for 2024', () => {
    const y2024 = entries.filter((e) => e.year === 2024)
    expect(y2024).toHaveLength(7)
  })
})

describe('filterByYear', () => {
  const entries = parseScorePage(html)

  it('should return only entries for the specified year', () => {
    const y2025 = filterByYear(entries, 2025)
    expect(y2025.every((e) => e.year === 2025)).toBe(true)
    expect(y2025).toHaveLength(8)
  })

  it('should return empty array for a year with no entries', () => {
    expect(filterByYear(entries, 9999)).toEqual([])
  })
})
