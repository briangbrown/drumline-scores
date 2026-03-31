import { useMemo } from 'react'
import { Panel } from '../components/panel'
import type { EnsembleScore, ClassResult } from '../types'

// Caption colors from the theme — accessed as CSS variables for theme support
const CAPTION_COLORS: Record<string, string> = {
  'Effect – Music': 'var(--color-cap-em)',
  'Effect - Music': 'var(--color-cap-em)',
  'Effect – Visual': 'var(--color-cap-ev)',
  'Effect - Visual': 'var(--color-cap-ev)',
  'Effect': 'var(--color-cap-em)',
  'Music': 'var(--color-cap-m)',
  'Visual': 'var(--color-cap-v)',
  'Artistry': 'var(--color-cap-ev)',
}

const DEFAULT_CAPTION_COLOR = 'var(--color-text-muted)'

type RecapViewProps = {
  ensemble: EnsembleScore
  allEnsembles: ClassResult['ensembles']
}

export function RecapView({ ensemble, allEnsembles }: RecapViewProps) {
  // Compute per-caption ranks across all ensembles
  const captionRanks = useMemo(() => {
    const ranks = new Map<string, { rank: number; total: number }>()

    for (const cap of ensemble.captions) {
      const allScores = allEnsembles
        .map((e) => e.captions.find((c) => c.captionName === cap.captionName)?.captionTotal ?? 0)
        .sort((a, b) => b - a)
      const rank = allScores.indexOf(cap.captionTotal) + 1
      ranks.set(cap.captionName, { rank, total: allEnsembles.length })
    }

    return ranks
  }, [ensemble, allEnsembles])

  return (
    <div className="space-y-4">
      {/* Caption Rank Summary */}
      <div className="flex flex-wrap gap-3">
        {ensemble.captions.map((cap) => {
          const rankInfo = captionRanks.get(cap.captionName)
          const color = CAPTION_COLORS[cap.captionName] ?? DEFAULT_CAPTION_COLOR

          return (
            <div
              key={cap.captionName}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-center"
            >
              <p className="text-xs font-medium" style={{ color }}>
                {cap.captionName}
              </p>
              <p className="text-lg font-bold tabular-nums">{cap.captionTotal.toFixed(2)}</p>
              <p className="text-xs text-text-muted">
                {rankInfo && (
                  <span>#{rankInfo.rank} of {rankInfo.total}</span>
                )}
              </p>
            </div>
          )
        })}
      </div>

      {/* Judge-Level Detail Table */}
      {ensemble.captions.map((cap) => {
        const color = CAPTION_COLORS[cap.captionName] ?? DEFAULT_CAPTION_COLOR

        return (
          <Panel key={cap.captionName}>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold" style={{ color }}>
                {cap.captionName}
              </h4>
              <span className="text-sm font-bold tabular-nums">{cap.captionTotal.toFixed(2)}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-text-muted">
                    <th className="py-1.5 pr-3 text-left font-medium">Judge</th>
                    {cap.judges[0]?.subCaptions.map((sub) => (
                      <th key={sub.key} className="py-1.5 px-2 text-right font-medium">
                        {sub.key}
                      </th>
                    ))}
                    <th className="py-1.5 pl-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cap.judges.map((judge) => (
                    <tr
                      key={judge.judgeName}
                      className="border-b border-border/30"
                    >
                      <td className="py-1.5 pr-3 text-text-secondary">{judge.judgeName}</td>
                      {judge.subCaptions.map((sub) => (
                        <td key={sub.key} className="py-1.5 px-2 text-right tabular-nums">
                          {sub.rawScore}
                          {sub.rank !== null && (
                            <span className="ml-1 text-text-muted text-[10px]">({sub.rank})</span>
                          )}
                        </td>
                      ))}
                      <td className="py-1.5 pl-2 text-right font-medium tabular-nums">
                        {judge.total.toFixed(2)}
                        {judge.rank !== null && (
                          <span className="ml-1 text-text-muted text-[10px]">({judge.rank})</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )
      })}

      {/* Penalty */}
      {ensemble.penalty > 0 && (
        <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
          Timing Penalty: -{ensemble.penalty.toFixed(1)}
        </div>
      )}
    </div>
  )
}
