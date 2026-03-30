import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Panel } from '../components/panel'
import { ChartTooltip } from '../components/chart-tooltip'
import type { ShowMetadata, ClassResult } from '../types'

// 12-color palette from the prototype
const PALETTE = [
  '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#e879f9', '#facc15',
]

type ShowWithClass = {
  metadata: ShowMetadata
  classResult: ClassResult | undefined
}

type ProgressionViewProps = {
  classId: string
  shows: Array<ShowWithClass>
  highlight: string | null
}

export function ProgressionView({ shows, highlight }: ProgressionViewProps) {
  // Build chart data: each data point is a show, with a key per ensemble
  const { chartData, ensembleNames, colorMap } = useMemo(() => {
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
    sortedNames.forEach((name, i) => {
      colors.set(name, PALETTE[i % PALETTE.length])
    })

    const data = shows.map((show) => {
      const point: Record<string, string | number> = {
        show: formatShowLabel(show.metadata),
      }
      if (show.classResult) {
        for (const e of show.classResult.ensembles) {
          point[e.ensembleName] = e.total
        }
      }
      return point
    })

    return { chartData: data, ensembleNames: sortedNames, colorMap: colors }
  }, [shows])

  // Build season summary table
  const summary = useMemo(() => {
    return ensembleNames.map((name) => {
      const scores = shows
        .map((show) => {
          const e = show.classResult?.ensembles.find((en) => en.ensembleName === name)
          return e?.total ?? null
        })
        .filter((s): s is number => s !== null)

      const showCount = scores.length
      const first = scores[0] ?? 0
      const last = scores[scores.length - 1] ?? 0
      const high = Math.max(...scores, 0)
      const growth = showCount > 1 ? last - first : 0

      return { name, showCount, first, last, high, growth }
    })
  }, [shows, ensembleNames])

  if (shows.length === 0) {
    return (
      <div className="py-12 text-center text-text-muted">
        No show data available for this class
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progression Chart */}
      <Panel title="Score Progression">
        <div className="h-[300px] sm:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
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
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 10, color: 'var(--color-text-secondary)' }}
              />
              {ensembleNames.map((name) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={colorMap.get(name)}
                  strokeWidth={highlight === name ? 3 : 1.5}
                  dot={{ r: highlight === name ? 4 : 2 }}
                  connectNulls
                  opacity={highlight && highlight !== name ? 0.3 : 1}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
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
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: colorMap.get(row.name) }}
                      />
                      <span className="truncate max-w-[200px]">{row.name}</span>
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
