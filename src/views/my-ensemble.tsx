import { useMemo, useState, useEffect } from 'react'
import { Panel } from '../components/panel'
import { StarButton } from '../components/star-button'
import { loadEnsembleRegistry } from '../data'
import type { ShowData, EnsembleRegistry, EnsembleEntry } from '../types'
import type { FavoriteEnsemble } from '../favorites'

type MyEnsembleViewProps = {
  favorite: FavoriteEnsemble
  shows: Array<ShowData>
  onRemoveFavorite: () => void
  onViewClass: (classId: string) => void
}

export function MyEnsembleView({
  favorite,
  shows,
  onRemoveFavorite,
  onViewClass,
}: MyEnsembleViewProps) {
  const [registry, setRegistry] = useState<EnsembleRegistry | null>(null)

  useEffect(() => {
    loadEnsembleRegistry().then(setRegistry)
  }, [])

  // Resolve the favorited name to a registry entry and get all name variants
  const { entry, nameVariants } = useMemo(() => {
    if (!registry) return { entry: null, nameVariants: new Set<string>() }

    let found: EnsembleEntry | null = null
    for (const e of registry.ensembles) {
      if (e.canonicalName === favorite.ensembleName || e.aliases.includes(favorite.ensembleName)) {
        found = e
        break
      }
    }

    const variants = new Set<string>()
    if (found) {
      variants.add(found.canonicalName)
      for (const a of found.aliases) variants.add(a)
    } else {
      variants.add(favorite.ensembleName)
    }

    return { entry: found, nameVariants: variants }
  }, [registry, favorite.ensembleName])

  const displayName = entry?.canonicalName ?? favorite.ensembleName

  const { latestResult, seasonScores, nearbyEnsembles, latestClassId } = useMemo(() => {
    // Find all appearances of this ensemble across shows (any class)
    const appearances: Array<{
      showDate: string
      showName: string
      total: number
      rank: number
      classSize: number
      classId: string
      className: string
    }> = []

    for (const show of shows) {
      for (const cls of show.classes) {
        const ensemble = cls.ensembles.find((e) => nameVariants.has(e.ensembleName))
        if (ensemble) {
          appearances.push({
            showDate: show.metadata.date,
            showName: show.metadata.eventName,
            total: ensemble.total,
            rank: ensemble.rank,
            classSize: cls.ensembles.length,
            classId: cls.classDef.id,
            className: cls.classDef.name,
          })
        }
      }
    }

    const latest = appearances.length > 0 ? appearances[appearances.length - 1] : null

    // Find ensembles ranked immediately above and below in latest show
    let nearby: Array<{ name: string; total: number; rank: number }> = []
    if (latest) {
      const latestShow = shows[shows.length - 1]
      const cls = latestShow?.classes.find((c) => c.classDef.id === latest.classId)
      if (cls) {
        const sorted = [...cls.ensembles].sort((a, b) => a.rank - b.rank)
        const idx = sorted.findIndex((e) => nameVariants.has(e.ensembleName))
        if (idx >= 0) {
          const start = Math.max(0, idx - 1)
          const end = Math.min(sorted.length, idx + 2)
          nearby = sorted.slice(start, end).map((e) => ({
            name: e.ensembleName,
            total: e.total,
            rank: e.rank,
          }))
        }
      }
    }

    return {
      latestResult: latest,
      seasonScores: appearances,
      nearbyEnsembles: nearby,
      latestClassId: latest?.classId ?? favorite.classId,
    }
  }, [shows, favorite.classId, nameVariants])

  const growth = seasonScores.length > 1
    ? seasonScores[seasonScores.length - 1].total - seasonScores[0].total
    : null

  return (
    <div className="space-y-6">
      {/* Ensemble Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">{displayName}</h2>
            <StarButton isFavorited onClick={onRemoveFavorite} size="md" />
          </div>
          {latestResult && (
            <p className="text-xs text-text-muted mt-1">
              {latestResult.className.replace(/^Percussion\s+/i, '')}
            </p>
          )}
        </div>
      </div>

      {/* Latest Result */}
      {latestResult && (
        <Panel title="Latest Result">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-secondary">{latestResult.showName}</p>
              <p className="text-xs text-text-muted">{formatShortDate(latestResult.showDate)}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-accent tabular-nums">
                {latestResult.total.toFixed(2)}
              </p>
              <p className="text-sm text-text-secondary">
                #{latestResult.rank} of {latestResult.classSize}
                {growth !== null && (
                  <span className={`ml-2 ${growth >= 0 ? 'text-growth-high' : 'text-growth-neg'}`}>
                    {growth >= 0 ? '\u25B2' : '\u25BC'} {Math.abs(growth).toFixed(2)}
                  </span>
                )}
              </p>
            </div>
          </div>
        </Panel>
      )}

      {/* Season Progression */}
      {seasonScores.length > 1 && (
        <Panel title="Season Progression">
          <div className="space-y-2">
            {seasonScores.map((s, i) => {
              const prev = i > 0 ? seasonScores[i - 1].total : null
              const diff = prev !== null ? s.total - prev : null

              return (
                <div
                  key={s.showDate}
                  className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-xs truncate">{s.showName}</p>
                    <p className="text-xs text-text-muted">{formatShortDate(s.showDate)}</p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-xs text-text-muted">#{s.rank}</span>
                    <span className="font-medium tabular-nums">{s.total.toFixed(2)}</span>
                    {diff !== null && (
                      <span className={`text-xs tabular-nums w-12 text-right ${
                        diff > 0 ? 'text-growth-high' : diff < 0 ? 'text-growth-neg' : 'text-text-muted'
                      }`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {/* Nearby Ensembles */}
      {nearbyEnsembles.length > 0 && (
        <Panel title="Nearby in Standings">
          <div className="space-y-2">
            {nearbyEnsembles.map((e) => (
              <div
                key={e.name}
                className={`flex items-center justify-between text-sm ${
                  nameVariants.has(e.name) ? 'text-accent font-medium' : ''
                }`}
              >
                <span className="truncate max-w-[200px]">
                  #{e.rank} {e.name}
                </span>
                <span className="tabular-nums">{e.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Link to full class view */}
      <button
        onClick={() => onViewClass(latestClassId)}
        className="w-full rounded-lg border border-border bg-surface p-3 text-center text-sm text-text-secondary hover:text-accent hover:border-accent/50 transition-colors cursor-pointer"
      >
        View full class standings
      </button>

      {/* No data state */}
      {!latestResult && (
        <div className="py-8 text-center text-text-muted">
          <p>No scores found for {displayName}</p>
          <p className="text-xs mt-1">This ensemble may not have competed this season</p>
        </div>
      )}
    </div>
  )
}

function formatShortDate(date: string): string {
  const match = date.match(/(\w+),\s+(\w+)\s+(\d+),?\s*(\d{4})/)
  if (match) return `${match[2].slice(0, 3)} ${match[3]}, ${match[4]}`
  return date
}
