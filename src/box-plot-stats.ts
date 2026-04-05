export type BoxPlotStats = {
  min: number
  q1: number
  median: number
  q3: number
  max: number
  avg: number
}

function percentile(sorted: Array<number>, p: number): number {
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)
}

export function computeBoxPlotStats(scores: Array<number>): BoxPlotStats | null {
  if (scores.length === 0) return null
  const sorted = [...scores].sort((a, b) => a - b)
  return {
    min: sorted[0],
    q1: percentile(sorted, 25),
    median: percentile(sorted, 50),
    q3: percentile(sorted, 75),
    max: sorted[sorted.length - 1],
    avg: scores.reduce((a, b) => a + b, 0) / scores.length,
  }
}
