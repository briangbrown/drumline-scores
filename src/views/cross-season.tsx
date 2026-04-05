import { useMemo, useState, useEffect, useCallback } from 'react'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Scatter,
  Cell,
} from 'recharts'
import { Panel } from '../components/panel'
import { ChartContainer } from '../components/chart-container'
import { useAllSeasonShows } from '../hooks/use-all-season-shows'
import { Loading, ErrorMessage } from '../components/loading'
import { loadEnsembleRegistry } from '../data'
import { computeBoxPlotStats } from '../box-plot-stats'
import type { BoxPlotStats } from '../box-plot-stats'
import type { ShowData, EnsembleScore, EnsembleRegistry, EnsembleEntry } from '../types'

type CrossSeasonViewProps = {
  initialEnsemble?: string | null
}

type SeasonDatum = {
  year: number
  showName: string
  nameUsed: string
  className: string
  classType: string
  total: number
  rank: number
  classSize: number
  captions: EnsembleScore['captions']
  penalty: number
}

type ChartDatum = {
  year: string
  Final: number
  boxStats: BoxPlotStats | null
}

export function CrossSeasonView({ initialEnsemble }: CrossSeasonViewProps) {
  const { showsByYear, isLoading, error } = useAllSeasonShows()
  const [registry, setRegistry] = useState<EnsembleRegistry | null>(null)
  const [selectedEnsembleId, setSelectedEnsembleId] = useState<string>('')
  const [activeBoxYear, setActiveBoxYear] = useState<string | null>(null)

  // Load ensemble registry
  useEffect(() => {
    loadEnsembleRegistry().then(setRegistry)
  }, [])

  // Derive the final show per year from all shows
  const finalShows = useMemo(() => {
    const result: Array<ShowData> = []
    for (const [, shows] of showsByYear) {
      if (shows.length > 0) {
        result.push(shows[shows.length - 1])
      }
    }
    return result
  }, [showsByYear])

  // Build a lookup: any name variant → registry entry
  const nameLookup = useMemo(() => {
    if (!registry) return new Map<string, EnsembleEntry>()
    const lookup = new Map<string, EnsembleEntry>()
    for (const entry of registry.ensembles) {
      lookup.set(entry.canonicalName, entry)
      for (const alias of entry.aliases) {
        lookup.set(alias, entry)
      }
    }
    return lookup
  }, [registry])

  // Collect all unique ensembles (by registry ID) that appear in finals data
  const ensembleList = useMemo(() => {
    const seen = new Map<string, EnsembleEntry>()
    for (const show of finalShows) {
      for (const cls of show.classes) {
        for (const e of cls.ensembles) {
          const entry = nameLookup.get(e.ensembleName)
          if (entry && !seen.has(entry.id)) {
            seen.set(entry.id, entry)
          }
        }
      }
    }
    return Array.from(seen.values()).sort((a, b) =>
      a.canonicalName.localeCompare(b.canonicalName),
    )
  }, [finalShows, nameLookup])

  // Auto-select initial ensemble
  useEffect(() => {
    if (selectedEnsembleId || ensembleList.length === 0) return
    if (initialEnsemble) {
      const entry = nameLookup.get(initialEnsemble)
      if (entry) {
        setSelectedEnsembleId(entry.id)
        return
      }
    }
    setSelectedEnsembleId(ensembleList[0].id)
  }, [ensembleList, initialEnsemble, nameLookup, selectedEnsembleId])

  const selectedEntry = ensembleList.find((e) => e.id === selectedEnsembleId)

  // Find the ensemble's final-show data across all seasons
  const seasonData = useMemo(() => {
    if (!selectedEntry) return []

    const allNames = new Set([selectedEntry.canonicalName, ...selectedEntry.aliases])

    return finalShows
      .map((show) => {
        const result = findEnsembleInShow(show, allNames)
        if (!result) return null

        return {
          year: show.metadata.year,
          showName: show.metadata.eventName,
          nameUsed: result.ensemble.ensembleName,
          className: result.className,
          classType: result.classType,
          total: result.ensemble.total,
          rank: result.ensemble.rank,
          classSize: result.classSize,
          captions: result.ensemble.captions,
          penalty: result.ensemble.penalty,
        }
      })
      .filter((d): d is SeasonDatum => d !== null)
      .sort((a, b) => a.year - b.year)
  }, [finalShows, selectedEntry])

  // Compute box plot stats per season from all shows
  const boxStatsByYear = useMemo(() => {
    if (!selectedEntry) return new Map<number, BoxPlotStats>()

    const allNames = new Set([selectedEntry.canonicalName, ...selectedEntry.aliases])
    const result = new Map<number, BoxPlotStats>()

    for (const [year, shows] of showsByYear) {
      const scores: Array<number> = []
      for (const show of shows) {
        const found = findEnsembleInShow(show, allNames)
        if (found) scores.push(found.ensemble.total)
      }
      const stats = computeBoxPlotStats(scores)
      if (stats) result.set(year, stats)
    }

    return result
  }, [showsByYear, selectedEntry])

  // Build chart data
  const chartData = useMemo(() => {
    return seasonData.map((d) => ({
      year: String(d.year),
      Final: d.total,
      boxStats: boxStatsByYear.get(d.year) ?? null,
    }))
  }, [seasonData, boxStatsByYear])

  // Season-over-season growth
  const growthSummary = useMemo(() => {
    if (seasonData.length < 2) return null

    const first = seasonData[0]
    const last = seasonData[seasonData.length - 1]
    const totalGrowth = last.total - first.total
    const avgGrowth = totalGrowth / (seasonData.length - 1)
    const highYear = seasonData.reduce((best, d) => d.total > best.total ? d : best, seasonData[0])

    return {
      seasons: seasonData.length,
      firstYear: first.year,
      lastYear: last.year,
      firstScore: first.total,
      lastScore: last.total,
      totalGrowth,
      avgGrowth,
      highYear: highYear.year,
      highScore: highYear.total,
    }
  }, [seasonData])

  const handleChartClick = useCallback((state: { activeLabel?: string | number }) => {
    if (state.activeLabel !== undefined) {
      const label = String(state.activeLabel)
      setActiveBoxYear((prev) => prev === label ? null : label)
    }
  }, [])

  if (isLoading || !registry) return <Loading />
  if (error) return <ErrorMessage message={error} />

  return (
    <div className="space-y-6">
      {/* Ensemble Selector */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Select Ensemble</label>
        <select
          value={selectedEnsembleId}
          onChange={(e) => setSelectedEnsembleId(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
        >
          {ensembleList.map((entry) => (
            <option key={entry.id} value={entry.id}>{entry.canonicalName}</option>
          ))}
        </select>
      </div>

      {seasonData.length === 0 && selectedEntry && (
        <div className="py-8 text-center text-text-muted">
          No championship data found for {selectedEntry.canonicalName}
        </div>
      )}

      {seasonData.length > 0 && (
        <>
          {/* Score Trajectory Chart with Box Plots */}
          <Panel title="Score Trajectory">
            <ChartContainer className="h-[300px] sm:h-[350px]">
              {(width, height) => (
                <ComposedChart
                  data={chartData}
                  width={width}
                  height={height}
                  margin={{ top: 10, right: 10, bottom: 5, left: 0 }}
                  onClick={handleChartClick}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-grid)" />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    stroke="var(--color-border-grid)"
                  />
                  <YAxis
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                    stroke="var(--color-border-grid)"
                    domain={[
                      (dataMin: number) => {
                        const minWithBox = chartData.reduce((min, d) => {
                          const boxMin = d.boxStats?.min ?? d.Final
                          return Math.min(min, boxMin)
                        }, dataMin)
                        return Math.floor(minWithBox - 2)
                      },
                      (dataMax: number) => {
                        const maxWithBox = chartData.reduce((max, d) => {
                          const boxMax = d.boxStats?.max ?? d.Final
                          return Math.max(max, boxMax)
                        }, dataMax)
                        return Math.ceil(maxWithBox + 2)
                      },
                    ]}
                  />
                  <Tooltip content={<BoxPlotTooltip activeBoxYear={activeBoxYear} />} />
                  {/* 2020 gap indicator — no season */}
                  {chartData.some((d) => d.year === '2019') && !chartData.some((d) => d.year === '2020') && (
                    <ReferenceLine
                      x="2019"
                      stroke="var(--color-text-muted)"
                      strokeDasharray="3 3"
                      label={{ value: 'COVID', position: 'top', fill: 'var(--color-text-muted)', fontSize: 9 }}
                    />
                  )}
                  {/* Box plots rendered via custom bar shapes */}
                  <Scatter
                    dataKey="Final"
                    shape={(props: ScatterDotProps) => <BoxPlotShape {...props} activeBoxYear={activeBoxYear} />}
                    isAnimationActive={false}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.year} fill="var(--color-accent)" />
                    ))}
                  </Scatter>
                  {/* Trajectory line connecting final scores */}
                  <Line
                    type="monotone"
                    dataKey="Final"
                    stroke="var(--color-accent)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                </ComposedChart>
              )}
            </ChartContainer>
            <p className="mt-2 text-center text-[10px] text-text-muted">
              Box: Q1–Q3 &middot; Whiskers: Min–Max &middot; Dot: Final/Latest score &middot; Click a year to pin tooltip
            </p>
          </Panel>

          {/* Season-over-Season Summary */}
          {growthSummary && (
            <Panel title="Multi-Year Summary">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <SummaryCard label="Seasons" value={String(growthSummary.seasons)} />
                <SummaryCard
                  label="Total Growth"
                  value={`${growthSummary.totalGrowth >= 0 ? '+' : ''}${growthSummary.totalGrowth.toFixed(2)}`}
                  color={growthSummary.totalGrowth >= 0 ? 'text-growth-high' : 'text-growth-neg'}
                />
                <SummaryCard
                  label="Avg/Season"
                  value={`${growthSummary.avgGrowth >= 0 ? '+' : ''}${growthSummary.avgGrowth.toFixed(2)}`}
                  color={growthSummary.avgGrowth >= 0 ? 'text-growth-mid' : 'text-growth-neg'}
                />
                <SummaryCard
                  label={`Best (${growthSummary.highYear})`}
                  value={growthSummary.highScore.toFixed(2)}
                  color="text-accent"
                />
              </div>
            </Panel>
          )}

          {/* Year-by-Year Detail Table */}
          <Panel title="Year-by-Year Results">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-text-muted">
                    <th className="py-2 pr-3 text-left font-medium">Year</th>
                    <th className="py-2 px-2 text-left font-medium">Class</th>
                    <th className="py-2 px-2 text-right font-medium">Score</th>
                    <th className="py-2 px-2 text-right font-medium">Rank</th>
                    <th className="py-2 pl-2 text-right font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {[...seasonData].reverse().map((d) => {
                    const idx = seasonData.indexOf(d)
                    const prev = idx > 0 ? seasonData[idx - 1].total : null
                    const change = prev !== null ? d.total - prev : null

                    return (
                      <tr
                        key={d.year}
                        className="border-b border-border/50 hover:bg-surface-alt/50"
                      >
                        <td className="py-2 pr-3 font-medium">{d.year}</td>
                        <td className="py-2 px-2 text-text-secondary">
                          {d.className.replace(/^Percussion\s+/, '')}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">{d.total.toFixed(2)}</td>
                        <td className="py-2 px-2 text-right text-text-secondary">
                          #{d.rank} of {d.classSize}
                        </td>
                        <td className={`py-2 pl-2 text-right tabular-nums font-medium ${
                          change === null
                            ? 'text-text-muted'
                            : change >= 0
                              ? 'text-growth-high'
                              : 'text-growth-neg'
                        }`}>
                          {change !== null
                            ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}`
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Box Plot SVG Shape (rendered per scatter point)
// ---------------------------------------------------------------------------

type ScatterDotProps = {
  cx?: number
  cy?: number
  payload?: ChartDatum
  yAxis?: { scale: (value: number) => number }
  activeBoxYear?: string | null
}

function BoxPlotShape({ cx, cy, payload, yAxis, activeBoxYear }: ScatterDotProps) {
  if (!cx || !cy || !payload?.boxStats || !yAxis?.scale) {
    // No box stats — just render the dot
    return <circle cx={cx} cy={cy} r={5} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={2} />
  }

  const { min, q1, q3, max } = payload.boxStats
  const scale = yAxis.scale

  const yMin = scale(min)
  const yQ1 = scale(q1)
  const yQ3 = scale(q3)
  const yMax = scale(max)

  const boxWidth = 24
  const whiskerWidth = 12
  const isActive = activeBoxYear === payload.year

  return (
    <g>
      {/* Whisker line (min to max) */}
      <line
        x1={cx}
        y1={yMin}
        x2={cx}
        y2={yMax}
        stroke="var(--color-text-secondary)"
        strokeWidth={1.5}
      />
      {/* Min whisker cap */}
      <line
        x1={cx - whiskerWidth / 2}
        y1={yMin}
        x2={cx + whiskerWidth / 2}
        y2={yMin}
        stroke="var(--color-text-secondary)"
        strokeWidth={1.5}
      />
      {/* Max whisker cap */}
      <line
        x1={cx - whiskerWidth / 2}
        y1={yMax}
        x2={cx + whiskerWidth / 2}
        y2={yMax}
        stroke="var(--color-text-secondary)"
        strokeWidth={1.5}
      />
      {/* Box (Q1 to Q3) */}
      <rect
        x={cx - boxWidth / 2}
        y={yQ3}
        width={boxWidth}
        height={yQ1 - yQ3}
        fill={isActive ? 'var(--color-accent)' : 'var(--color-accent)'}
        fillOpacity={isActive ? 0.3 : 0.15}
        stroke="var(--color-accent)"
        strokeWidth={1.5}
        rx={2}
      />
      {/* Median line */}
      <line
        x1={cx - boxWidth / 2}
        y1={scale(payload.boxStats.median)}
        x2={cx + boxWidth / 2}
        y2={scale(payload.boxStats.median)}
        stroke="var(--color-accent)"
        strokeWidth={1.5}
        strokeDasharray="3 2"
      />
      {/* Final score dot (on top) */}
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill="var(--color-accent)"
        stroke="var(--color-surface)"
        strokeWidth={2}
      />
    </g>
  )
}

// ---------------------------------------------------------------------------
// Box Plot Tooltip
// ---------------------------------------------------------------------------

type BoxPlotTooltipPayloadEntry = {
  dataKey?: string | number
  name?: string
  value?: number | string
  payload?: ChartDatum
}

type BoxPlotTooltipProps = {
  active?: boolean
  payload?: Array<BoxPlotTooltipPayloadEntry>
  label?: string
  activeBoxYear?: string | null
}

function BoxPlotTooltip({ active, payload, label, activeBoxYear }: BoxPlotTooltipProps) {
  // Show tooltip if hovered or if this year is pinned
  const entry = payload?.[0]?.payload
  const isActive = active || (activeBoxYear !== null && entry?.year === activeBoxYear)

  if (!isActive || !entry) return null

  const stats = entry.boxStats

  return (
    <div className="rounded-lg border border-border bg-surface p-3 shadow-lg">
      <p className="mb-2 text-xs font-medium text-text-secondary">{label}</p>
      <div className="flex items-center gap-2 text-xs mb-1">
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }} />
        <span className="text-text-secondary">Final:</span>
        <span className="font-medium text-text-primary">{entry.Final.toFixed(2)}</span>
      </div>
      {stats && (
        <div className="border-t border-border/50 mt-1.5 pt-1.5 space-y-0.5">
          <StatRow label="Max" value={stats.max} />
          <StatRow label="Q3" value={stats.q3} />
          <StatRow label="Median" value={stats.median} />
          <StatRow label="Average" value={stats.avg} />
          <StatRow label="Q1" value={stats.q1} />
          <StatRow label="Min" value={stats.min} />
        </div>
      )}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="text-text-muted">{label}</span>
      <span className="font-medium tabular-nums text-text-primary">{value.toFixed(2)}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  color = 'text-text-primary',
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findEnsembleInShow(
  show: ShowData,
  nameVariants: Set<string>,
): { ensemble: EnsembleScore; className: string; classType: string; classSize: number } | null {
  for (const cls of show.classes) {
    const ensemble = cls.ensembles.find((e) => nameVariants.has(e.ensembleName))
    if (ensemble) {
      return {
        ensemble,
        className: cls.classDef.name,
        classType: cls.classDef.classType,
        classSize: cls.ensembles.length,
      }
    }
  }
  return null
}
