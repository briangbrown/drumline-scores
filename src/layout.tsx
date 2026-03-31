import type { ReactNode, Ref } from 'react'
import { Pill } from './components/pill'
import type { SeasonMetadata } from './types'
import type { ViewType } from './router'
import type { FavoriteEnsemble } from './favorites'

type LayoutProps = {
  year: number
  years: Array<number>
  season: SeasonMetadata | null
  classId: string
  view: ViewType
  onYearChange: (year: number) => void
  onClassChange: (classId: string) => void
  onViewChange: (view: ViewType) => void
  favorite: FavoriteEnsemble | null
  onShowMyEnsemble: () => void
  myEnsembleRef?: Ref<HTMLButtonElement>
  isMyEnsembleFlashing?: boolean
  children: ReactNode
}

export function Layout({
  year,
  years,
  season,
  classId,
  view,
  onYearChange,
  onClassChange,
  onViewChange,
  favorite,
  onShowMyEnsemble,
  myEnsembleRef,
  isMyEnsembleFlashing,
  children,
}: LayoutProps) {
  const classes = season?.classes ?? []

  return (
    <div className="mx-auto max-w-[920px] px-4 py-4">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-lg font-bold text-accent tracking-tight">
          RMPA Score Tracker
        </h1>

        {/* Year selector */}
        {years.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {years.map((y) => (
              <Pill
                key={y}
                label={String(y)}
                isActive={y === year}
                onClick={() => onYearChange(y)}
              />
            ))}
          </div>
        )}

        {/* Class selector */}
        {classes.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {favorite && (
              <Pill
                label={`\u2605 My Ensemble`}
                isActive={!classId}
                onClick={onShowMyEnsemble}
                ref={myEnsembleRef}
                isFlashing={isMyEnsembleFlashing}
              />
            )}
            {classes.map((cls) => (
              <Pill
                key={cls.id}
                label={cls.name.replace(/^Percussion\s+/, '')}
                isActive={cls.id === classId}
                onClick={() => onClassChange(cls.id)}
              />
            ))}
          </div>
        )}

        {/* View tabs */}
        {classId && (
          <div className="mt-3 flex gap-2">
            <Pill
              label="Progression"
              isActive={view === 'progression'}
              onClick={() => onViewChange('progression')}
            />
            <Pill
              label="Standings"
              isActive={view === 'standings'}
              onClick={() => onViewChange('standings')}
            />
            <Pill
              label="Cross-Season"
              isActive={view === 'cross-season'}
              onClick={() => onViewChange('cross-season')}
            />
          </div>
        )}

        {/* Incomplete season indicator */}
        {season?.incomplete && (
          <p className="mt-2 text-xs text-text-muted italic">
            {year} season incomplete (cancelled due to COVID)
          </p>
        )}
      </header>

      {/* Main content */}
      <main>{children}</main>
    </div>
  )
}
