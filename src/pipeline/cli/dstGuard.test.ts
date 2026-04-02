import { describe, it, expect } from 'vitest'
import { isDenverDST, parseHourRange } from './dstGuard'

describe('isDenverDST', () => {
  it('should return false in January (MST)', () => {
    expect(isDenverDST(new Date('2026-01-15T12:00:00Z'))).toBe(false)
  })

  it('should return false in early March before DST (MST)', () => {
    // 2026 DST starts March 8 (2nd Sunday)
    expect(isDenverDST(new Date('2026-03-07T12:00:00Z'))).toBe(false)
  })

  it('should return true in late March (MDT)', () => {
    expect(isDenverDST(new Date('2026-03-15T12:00:00Z'))).toBe(true)
  })

  it('should return true in April (MDT)', () => {
    expect(isDenverDST(new Date('2026-04-04T12:00:00Z'))).toBe(true)
  })

  it('should return false in November after DST ends (MST)', () => {
    expect(isDenverDST(new Date('2026-11-15T12:00:00Z'))).toBe(false)
  })
})

describe('parseHourRange', () => {
  it('should parse a single hour', () => {
    expect(parseHourRange('21')).toEqual([21])
  })

  it('should parse a range', () => {
    expect(parseHourRange('1-6')).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('should parse a single-element range', () => {
    expect(parseHourRange('0-0')).toEqual([0])
  })
})
