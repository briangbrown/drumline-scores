import { useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Panel } from '../components/panel'
import { ChartTooltip } from '../components/chart-tooltip'
import { useCrossSeason } from '../hooks/use-cross-season'
import { Loading, ErrorMessage } from '../components/loading'
import type { ShowData, EnsembleScore } from '../types'

// Domain colors
const DOMAIN_COLORS: Record<string, string> = {
  'Total': '#f59e0b',
  'Music': '#c4985a',
  'Visual': '#8a7ab8',
  'Effect': '#cc7a5a',
}

type CrossSeasonViewProps = {
  initialEnsemble?: string | null
}

export function CrossSeasonView({ initialEnsemble }: CrossSeasonViewProps) {
  const { shows, isLoading, error } = useCrossSeason()
  const [selectedEnsemble, setSelectedEnsemble] = useState<string>(initialEnsemble ?? '')

  // Collect all unique ensemble names across all seasons
  const allEnsembles = useMemo(() => {
    const names = new Set<string>()
    for (const show of shows) {
      for (const cls of show.classes) {
        for (const e of cls.ensembles) {
          names.add(e.ensembleName)
        }
      }
    }
    return Array.from(names).sort()
  }, [shows])

  // Auto-select first ensemble if none selected
  const activeEnsemble = selectedEnsemble || allEnsembles[0] || ''

  // Find the ensemble's data across all seasons
  const seasonData = useMemo(() => {
    if (!activeEnsemble) return []

    return shows
      .map((show) => {
        const result = findEnsembleInShow(show, activeEnsemble)
        if (!result) return null

        return {
          year: show.metadata.year,
          showName: show.metadata.eventName,
          className: result.className,
          classType: result.classType,
          total: result.ensemble.total,
          rank: result.ensemble.rank,
          classSize: result.classSize,
          captions: result.ensemble.captions,
          penalty: result.ensemble.penalty,
        }
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => a.year - b.year)
  }, [shows, activeEnsemble])

  // Build chart data
  const chartData = useMemo(() => {
    return seasonData.map((d) => ({
      year: String(d.year),
      Total: d.total,
    }))
  }, [seasonData])

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

  if (isLoading) return <Loading />
  if (error) return <ErrorMessage message={error} />

  return (
    <div className="space-y-6">
      {/* Ensemble Selector */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Select Ensemble</label>
        <select
          value={activeEnsemble}
          onChange={(e) => setSelectedEnsemble(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
        >
          {allEnsembles.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {seasonData.length === 0 && (
        <div className="py-8 text-center text-text-muted">
          No championship data found for {activeEnsemble}
        </div>
      )}

      {seasonData.length > 0 && (
        <>
          {/* Score Trajectory Chart */}
          <Panel title="Score Trajectory">
            <div className="h-[300px] sm:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-grid)" />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    stroke="var(--color-border-grid)"
                  />
                  <YAxis
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                    stroke="var(--color-border-grid)"
                    domain={['auto', 'auto']}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  {/* 2020 gap indicator — no season */}
                  {chartData.some((d) => d.year === '2019') && !chartData.some((d) => d.year === '2020') && (
                    <ReferenceLine
                      x="2019"
                      stroke="var(--color-text-muted)"
                      strokeDasharray="3 3"
                      label={{ value: 'COVID', position: 'top', fill: 'var(--color-text-muted)', fontSize: 9 }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="Total"
                    stroke={DOMAIN_COLORS['Total']}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: DOMAIN_COLORS['Total'] }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
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
                  {seasonData.map((d, i) => {
                    const prev = i > 0 ? seasonData[i - 1].total : null
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

function findEnsembleInShow(
  show: ShowData,
  ensembleName: string,
): { ensemble: EnsembleScore; className: string; classType: string; classSize: number } | null {
  for (const cls of show.classes) {
    const ensemble = cls.ensembles.find((e) => e.ensembleName === ensembleName)
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
