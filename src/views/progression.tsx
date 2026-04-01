import { useMemo, useRef, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { Pill } from '../components/pill'
import { Panel } from '../components/panel'
import { ChartContainer } from '../components/chart-container'
import { ChartTooltip } from '../components/chart-tooltip'
import { StarButton } from '../components/star-button'
import type { ShowMetadata, ClassResult } from '../types'

// 12-color chart palette — mid-saturation colors readable on both light and dark backgrounds
const PALETTE = [
  '#e09000', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#d946a8',
  '#14b8a6', '#e06820', '#0891b2', '#65a30d', '#c026d3', '#ca8a04',
]

const TOTAL_KEY = 'Total'

type ShowWithClass = {
  metadata: ShowMetadata
  classResult: ClassResult | undefined
}

type ProgressionViewProps = {
  classId: string
  shows: Array<ShowWithClass>
  highlight: string | null
  favoriteNames: Set<string>
  onToggleFavorite: (ensembleName: string) => void
  selectedCaption: string
  onCaptionChange: (caption: string) => void
}

export function ProgressionView({ shows, highlight, favoriteNames, onToggleFavorite, selectedCaption, onCaptionChange }: ProgressionViewProps) {
  const captionRowRef = useRef<HTMLDivElement>(null)

  // Discover available caption names from the data
  const captionNames = useMemo(() => {
    for (const show of shows) {
      if (!show.classResult) continue
      for (const e of show.classResult.ensembles) {
        if (e.captions.length > 0) {
          return e.captions.map((c) => c.captionName)
        }
      }
    }
    return []
  }, [shows])

  const captionOptions = [TOTAL_KEY, ...captionNames]

  // Auto-scroll active caption pill into view (horizontal only)
  useEffect(() => {
    requestAnimationFrame(() => {
      const container = captionRowRef.current
      if (!container) return
      const active = container.querySelector<HTMLElement>('[data-active]')
      if (!active) return
      const containerLeft = container.scrollLeft
      const containerWidth = container.clientWidth
      const pillLeft = active.offsetLeft
      const pillWidth = active.offsetWidth
      if (pillLeft < containerLeft) {
        container.scrollTo({ left: pillLeft, behavior: 'smooth' })
      } else if (pillLeft + pillWidth > containerLeft + containerWidth) {
        container.scrollTo({ left: pillLeft + pillWidth - containerWidth, behavior: 'smooth' })
      }
    })
  }, [selectedCaption, captionNames])

  // Reset caption selection if it doesn't exist in the current data
  const activeCaption = captionOptions.includes(selectedCaption) ? selectedCaption : TOTAL_KEY

  // Build chart data: each data point is a show, with a key per ensemble
  const { chartData, ensembleNames, colorMap, shortNameMap } = useMemo(() => {
    const names = new Set<string>()

    // Collect all ensemble names across shows
    for (const show of shows) {
      if (!show.classResult) continue
      for (const e of show.classResult.ensembles) {
        names.add(e.ensembleName)
      }
    }

    const sortedNames = Array.from(names).sort()
    const colors = new Map<string, string>()
    const shorts = new Map<string, string>()
    sortedNames.forEach((name, i) => {
      colors.set(name, PALETTE[i % PALETTE.length])
      shorts.set(name, shortenName(name))
    })

    const data = shows.map((show) => {
      const point: Record<string, string | number> = {
        show: formatShowLabel(show.metadata),
      }
      if (show.classResult) {
        for (const e of show.classResult.ensembles) {
          if (activeCaption === TOTAL_KEY) {
            point[e.ensembleName] = e.total
          } else {
            const cap = e.captions.find((c) => c.captionName === activeCaption)
            if (cap) point[e.ensembleName] = cap.captionTotal
          }
        }
      }
      return point
    })

    return { chartData: data, ensembleNames: sortedNames, colorMap: colors, shortNameMap: shorts }
  }, [shows, activeCaption])

  // Build season summary table
  const summary = useMemo(() => {
    return ensembleNames.map((name) => {
      const scores = shows
        .map((show) => {
          const e = show.classResult?.ensembles.find((en) => en.ensembleName === name)
          if (!e) return null
          if (activeCaption === TOTAL_KEY) return e.total
          const cap = e.captions.find((c) => c.captionName === activeCaption)
          return cap?.captionTotal ?? null
        })
        .filter((s): s is number => s !== null)

      const showCount = scores.length
      const first = scores[0] ?? 0
      const last = scores[scores.length - 1] ?? 0
      const high = Math.max(...scores, 0)
      const growth = showCount > 1 ? last - first : 0

      return { name, showCount, first, last, high, growth }
    })
  }, [shows, ensembleNames, activeCaption])

  // Build penalties data
  const penalties = useMemo(() => {
    const entries: Array<{ ensembleName: string; showLabel: string; penalty: number }> = []
    for (const show of shows) {
      if (!show.classResult) continue
      for (const e of show.classResult.ensembles) {
        if (e.penalty > 0) {
          entries.push({
            ensembleName: e.ensembleName,
            showLabel: formatShowLabel(show.metadata),
            penalty: e.penalty,
          })
        }
      }
    }
    return entries
  }, [shows])

  if (shows.length === 0) {
    return (
      <div className="py-12 text-center text-text-muted">
        No show data available for this class
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Caption Toggle Pills */}
      {captionNames.length > 1 && (
        <div ref={captionRowRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {captionOptions.map((cap) => (
            <Pill
              key={cap}
              label={cap}
              isActive={cap === activeCaption}
              onClick={() => onCaptionChange(cap)}
            />
          ))}
        </div>
      )}

      {/* Progression Chart */}
      <Panel title={`${activeCaption} Progression`}>
        <ChartContainer className="h-[300px] sm:h-[400px]">
          {(width, height) => (
            <LineChart data={chartData} width={width} height={height} margin={{ top: 5, right: 5, bottom: 5, left: -35 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-grid)" />
              <XAxis
                dataKey="show"
                tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                stroke="var(--color-border-grid)"
              />
              <YAxis
                tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                stroke="var(--color-border-grid)"
                domain={['auto', 'auto']}
                tickFormatter={(value: number) => Math.round(value).toString()}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 10, color: 'var(--color-text-secondary)' }}
                formatter={(value: string) => shortNameMap.get(value) ?? value}
              />
              {ensembleNames.map((name) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  name={name}
                  stroke={colorMap.get(name)}
                  strokeWidth={highlight === name ? 3 : 1.5}
                  dot={{ r: highlight === name ? 4 : 2 }}
                  connectNulls
                  opacity={highlight && highlight !== name ? 0.3 : 1}
                />
              ))}
            </LineChart>
          )}
        </ChartContainer>
      </Panel>

      {/* Season Summary Table */}
      <Panel title="Season Summary">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="py-2 pr-4 text-left font-medium">Ensemble</th>
                <th className="py-2 px-2 text-right font-medium">Shows</th>
                <th className="py-2 px-2 text-right font-medium">First</th>
                <th className="py-2 px-2 text-right font-medium">Last</th>
                <th className="py-2 px-2 text-right font-medium">High</th>
                <th className="py-2 pl-2 text-right font-medium">Growth</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr
                  key={row.name}
                  className="border-b border-border/50 hover:bg-surface-alt/50"
                >
                  <td className="py-2 pr-4">
                    <span className="flex items-center gap-2">
                      <StarButton
                        isFavorited={favoriteNames.has(row.name)}
                        onClick={() => onToggleFavorite(row.name)}
                      />
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: colorMap.get(row.name) }}
                      />
                      <span className="truncate max-w-[150px] sm:max-w-[300px] lg:max-w-none">{row.name}</span>
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right text-text-secondary">{row.showCount}</td>
                  <td className="py-2 px-2 text-right">{row.first.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right">{row.last.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right text-accent">{row.high.toFixed(2)}</td>
                  <td className={`py-2 pl-2 text-right font-medium ${growthColor(row.growth)}`}>
                    {row.growth > 0 ? '+' : ''}{row.growth.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Timing Penalties */}
      {penalties.length > 0 && (
        <Panel title="Timing Penalties">
          <div className="space-y-1.5">
            {penalties.map((p, i) => (
              <div
                key={`${p.ensembleName}-${i}`}
                className="flex items-center justify-between text-xs"
              >
                <span className="truncate max-w-[200px] sm:max-w-none">
                  {p.ensembleName}
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-text-muted">{p.showLabel}</span>
                  <span className="text-error font-medium">-{p.penalty.toFixed(1)}</span>
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}

function formatShowLabel(metadata: ShowMetadata): string {
  // Extract short date like "Mar 29"
  const match = metadata.date.match(/(\w+),\s+(\w+)\s+(\d+)/)
  if (match) return `${match[2].slice(0, 3)} ${match[3]}`
  return metadata.eventName.slice(0, 10)
}

function growthColor(growth: number): string {
  if (growth >= 3) return 'text-growth-high'
  if (growth >= 1) return 'text-growth-mid'
  if (growth >= 0) return 'text-growth-low'
  return 'text-growth-neg'
}

function shortenName(name: string): string {
  return name
    .replace(/\s+(High School|HS|Winter Percussion|Indoor Percussion|Percussion Ensemble|Percussion)\b/gi, '')
    .replace(/\s*"[^"]*"\s*$/, '')
    .trim()
}
