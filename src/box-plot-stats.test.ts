import { describe, it, expect } from 'vitest'
import { computeBoxPlotStats } from './box-plot-stats'

describe('computeBoxPlotStats', () => {
  it('should return null for empty array', () => {
    expect(computeBoxPlotStats([])).toBeNull()
  })

  it('should handle a single value', () => {
    const result = computeBoxPlotStats([80])
    expect(result).not.toBeNull()
    expect(result!.min).toBe(80)
    expect(result!.max).toBe(80)
    expect(result!.q1).toBe(80)
    expect(result!.median).toBe(80)
    expect(result!.q3).toBe(80)
    expect(result!.avg).toBe(80)
  })

  it('should handle two values', () => {
    const result = computeBoxPlotStats([70, 90])
    expect(result).not.toBeNull()
    expect(result!.min).toBe(70)
    expect(result!.max).toBe(90)
    expect(result!.median).toBe(80)
    expect(result!.avg).toBe(80)
    expect(result!.q1).toBe(75)
    expect(result!.q3).toBe(85)
  })

  it('should compute correct stats for odd-length array', () => {
    const result = computeBoxPlotStats([60, 70, 80, 90, 100])
    expect(result).not.toBeNull()
    expect(result!.min).toBe(60)
    expect(result!.max).toBe(100)
    expect(result!.median).toBe(80)
    expect(result!.avg).toBe(80)
    expect(result!.q1).toBe(70)
    expect(result!.q3).toBe(90)
  })

  it('should compute correct stats for even-length array', () => {
    const result = computeBoxPlotStats([60, 70, 80, 90])
    expect(result).not.toBeNull()
    expect(result!.min).toBe(60)
    expect(result!.max).toBe(90)
    expect(result!.median).toBe(75)
    expect(result!.avg).toBeCloseTo(75)
    expect(result!.q1).toBeCloseTo(67.5)
    expect(result!.q3).toBeCloseTo(82.5)
  })

  it('should not mutate the input array', () => {
    const input = [90, 70, 80, 60]
    computeBoxPlotStats(input)
    expect(input).toEqual([90, 70, 80, 60])
  })

  it('should handle duplicate values', () => {
    const result = computeBoxPlotStats([80, 80, 80, 80])
    expect(result).not.toBeNull()
    expect(result!.min).toBe(80)
    expect(result!.max).toBe(80)
    expect(result!.q1).toBe(80)
    expect(result!.median).toBe(80)
    expect(result!.q3).toBe(80)
    expect(result!.avg).toBe(80)
  })

  it('should handle unsorted input', () => {
    const result = computeBoxPlotStats([100, 60, 90, 70, 80])
    expect(result).not.toBeNull()
    expect(result!.min).toBe(60)
    expect(result!.max).toBe(100)
    expect(result!.median).toBe(80)
  })
})
