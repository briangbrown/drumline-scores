import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Pill } from '../components/pill'
import { Panel } from '../components/panel'
import { ChartTooltip } from '../components/chart-tooltip'
import { StarButton } from '../components/star-button'
import { RecapView } from './recap'
import type { ShowMetadata, ClassResult, EnsembleScore } from '../types'

// Caption colors from the theme — accessed as CSS variables for theme support
const CAPTION_COLORS = [
  'var(--color-cap-em)',
  'var(--color-cap-ev)',
  'var(--color-cap-m)',
  'var(--color-cap-v)',
  '#14b8a6',
  '#e879f9',
]

type ShowWithClass = {
  metadata: ShowMetadata
  classResult: ClassResult | undefined
}

type StandingsViewProps = {
  classId: string
  shows: Array<ShowWithClass>
  selectedShowId: string | null
  onShowChange: (showId: string) => void
  favoriteNames: Set<string>
  onToggleFavorite: (ensembleName: string) => void
}

export function StandingsView({
  shows,
  selectedShowId,
  onShowChange,
  favoriteNames,
  onToggleFavorite,
}: StandingsViewProps) {
  const [expandedEnsemble, setExpandedEnsemble] = useState<string | null>(null)
  const selectedShow = shows.find((s) => s.metadata.id === selectedShowId)
  const ensembles = selectedShow?.classResult?.ensembles ?? []

  // Score comparison chart data
  const comparisonData = useMemo(() => {
    return ensembles
      .map((e) => ({
        name: shortenName(e.ensembleName),
        total: e.total,
        fullName: e.ensembleName,
      }))
      .sort((a, b) => b.total - a.total)
  }, [ensembles])

  // Caption breakdown data
  const captionData = useMemo(() => {
    if (ensembles.length === 0) return []
    return ensembles
      .map((e) => {
        const row: Record<string, string | number> = {
          name: shortenName(e.ensembleName),
        }
        for (const cap of e.captions) {
          row[cap.captionName] = cap.captionTotal
        }
        return row
      })
      .sort((a, b) => {
        const aTotal = ensembles.find((e) => shortenName(e.ensembleName) === a.name)?.total ?? 0
        const bTotal = ensembles.find((e) => shortenName(e.ensembleName) === b.name)?.total ?? 0
        return bTotal - aTotal
      })
  }, [ensembles])

  const captionNames = ensembles.length > 0
    ? ensembles[0].captions.map((c) => c.captionName)
    : []

  if (shows.length === 0) {
    return (
      <div className="py-12 text-center text-text-muted">
        No show data available for this class
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Show selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {shows.map((show) => (
          <Pill
            key={show.metadata.id}
            label={formatShowLabel(show.metadata)}
            isActive={show.metadata.id === selectedShowId}
            onClick={() => onShowChange(show.metadata.id)}
          />
        ))}
      </div>

      {selectedShow && (
        <>
          {/* Score Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {ensembles.map((e) => (
              <ScoreCard
                key={e.ensembleName}
                ensemble={e}
                isFavorited={favoriteNames.has(e.ensembleName)}
                isExpanded={e.ensembleName === expandedEnsemble}
                onToggleFavorite={() => onToggleFavorite(e.ensembleName)}
                onToggleExpand={() => setExpandedEnsemble(
                  expandedEnsemble === e.ensembleName ? null : e.ensembleName,
                )}
              />
            ))}
          </div>

          {/* Expanded Recap */}
          {expandedEnsemble && (() => {
            const ensemble = ensembles.find((e) => e.ensembleName === expandedEnsemble)
            if (!ensemble) return null
            return (
              <Panel title={`Recap: ${ensemble.ensembleName}`}>
                <RecapView ensemble={ensemble} allEnsembles={ensembles} />
              </Panel>
            )
          })()}

          {/* Score Comparison Bar Chart */}
          <Panel title="Score Comparison">
            <div className="h-[250px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart
                  data={comparisonData}
                  layout="vertical"
                  margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-grid)" />
                  <XAxis
                    type="number"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                    stroke="var(--color-border-grid)"
                    domain={['auto', 'auto']}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                    stroke="var(--color-border-grid)"
                    width={120}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {comparisonData.map((entry, i) => (
                      <Cell
                        key={entry.name}
                        fill={i === 0 ? 'var(--color-accent)' : 'var(--color-text-muted)'}
                        fillOpacity={i === 0 ? 1 : 0.5}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          {/* Caption Breakdown Stacked Bar */}
          {captionNames.length > 0 && (
            <Panel title="Caption Breakdown">
              <div className="h-[250px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart
                    data={captionData}
                    layout="vertical"
                    margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-grid)" />
                    <XAxis
                      type="number"
                      tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                      stroke="var(--color-border-grid)"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                      stroke="var(--color-border-grid)"
                      width={120}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    {captionNames.map((cap, i) => (
                      <Bar
                        key={cap}
                        dataKey={cap}
                        stackId="captions"
                        fill={CAPTION_COLORS[i % CAPTION_COLORS.length]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Caption legend */}
              <div className="mt-3 flex flex-wrap gap-3">
                {captionNames.map((cap, i) => (
                  <span key={cap} className="flex items-center gap-1 text-xs text-text-secondary">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: CAPTION_COLORS[i % CAPTION_COLORS.length] }}
                    />
                    {cap}
                  </span>
                ))}
              </div>
            </Panel>
          )}

          {/* Caption Scores Table */}
          <Panel title="Caption Scores">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-text-muted">
                    <th className="py-2 pr-4 text-left font-medium">Rank</th>
                    <th className="py-2 pr-4 text-left font-medium">Ensemble</th>
                    {captionNames.map((cap) => (
                      <th key={cap} className="py-2 px-2 text-right font-medium">{cap}</th>
                    ))}
                    <th className="py-2 px-2 text-right font-medium">Pen</th>
                    <th className="py-2 pl-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ensembles.map((e) => {
                    // Find best score per caption for highlighting
                    const isBest = captionNames.map((cap) => {
                      const scores = ensembles.map(
                        (en) => en.captions.find((c) => c.captionName === cap)?.captionTotal ?? 0,
                      )
                      const myScore = e.captions.find((c) => c.captionName === cap)?.captionTotal ?? 0
                      return myScore === Math.max(...scores) && myScore > 0
                    })

                    return (
                      <tr
                        key={e.ensembleName}
                        className="border-b border-border/50 hover:bg-surface-alt/50"
                      >
                        <td className="py-2 pr-4 text-text-muted">{e.rank}</td>
                        <td className="py-2 pr-4">
                          <span className="flex items-center gap-1.5">
                            <StarButton
                              isFavorited={favoriteNames.has(e.ensembleName)}
                              onClick={() => onToggleFavorite(e.ensembleName)}
                            />
                            <span className="truncate max-w-[120px] sm:max-w-[200px] lg:max-w-none">{e.ensembleName}</span>
                          </span>
                        </td>
                        {captionNames.map((cap, i) => {
                          const score = e.captions.find((c) => c.captionName === cap)?.captionTotal ?? 0
                          return (
                            <td
                              key={cap}
                              className={`py-2 px-2 text-right ${isBest[i] ? 'text-accent font-medium' : ''}`}
                            >
                              {score.toFixed(2)}
                            </td>
                          )
                        })}
                        <td className={`py-2 px-2 text-right ${e.penalty > 0 ? 'text-error' : 'text-text-muted'}`}>
                          {e.penalty > 0 ? `-${e.penalty.toFixed(1)}` : '—'}
                        </td>
                        <td className="py-2 pl-2 text-right font-medium">{e.total.toFixed(2)}</td>
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

function ScoreCard({
  ensemble,
  isFavorited,
  isExpanded,
  onToggleFavorite,
  onToggleExpand,
}: {
  ensemble: EnsembleScore
  isFavorited: boolean
  isExpanded: boolean
  onToggleFavorite: () => void
  onToggleExpand: () => void
}) {
  return (
    <div
      className={`rounded-lg border bg-surface p-4 cursor-pointer transition-colors ${
        isExpanded
          ? 'border-accent ring-1 ring-accent/30'
          : isFavorited
            ? 'border-accent/50'
            : 'border-border hover:border-text-muted/30'
      }`}
      onClick={onToggleExpand}
    >
      <div className="flex items-center gap-1.5">
        <p className="text-xs text-accent font-medium">#{ensemble.rank}</p>
        <StarButton isFavorited={isFavorited} onClick={onToggleFavorite} />
        <p className="text-xl font-bold text-accent tabular-nums ml-auto">
          {ensemble.total.toFixed(2)}
        </p>
      </div>
      <p className="mt-1 text-sm font-medium">{ensemble.ensembleName}</p>
      {ensemble.location && (
        <p className="text-xs text-text-muted">{ensemble.location}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        {ensemble.penalty > 0 ? (
          <p className="text-xs text-error">
            Penalty: -{ensemble.penalty.toFixed(1)}
          </p>
        ) : <span />}
        <p className="text-xs text-text-muted">
          {isExpanded ? 'tap to collapse' : 'tap for recap'}
        </p>
      </div>
    </div>
  )
}

function formatShowLabel(metadata: ShowMetadata): string {
  const match = metadata.date.match(/(\w+),\s+(\w+)\s+(\d+)/)
  if (match) return `${match[2].slice(0, 3)} ${match[3]}`
  return metadata.eventName.slice(0, 10)
}

function shortenName(name: string): string {
  return name
    .replace(/\s+(High School|HS|Winter Percussion|Indoor Percussion|Percussion Ensemble|Percussion)\b/gi, '')
    .replace(/\s*"[^"]*"\s*$/, '')
    .trim()
}
