import type { ReactNode } from 'react'
import { Pill } from './components/pill'
import { getAvailableYears } from './data'
import type { SeasonMetadata } from './types'
import type { ViewType } from './router'

type LayoutProps = {
  year: number
  season: SeasonMetadata | null
  classId: string
  view: ViewType
  onYearChange: (year: number) => void
  onClassChange: (classId: string) => void
  onViewChange: (view: ViewType) => void
  children: ReactNode
}

export function Layout({
  year,
  season,
  classId,
  view,
  onYearChange,
  onClassChange,
  onViewChange,
  children,
}: LayoutProps) {
  const years = getAvailableYears()
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
          <div className="mt-3 flex gap-2">
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
          </div>
        )}
      </header>

      {/* Main content */}
      <main>{children}</main>
    </div>
  )
}
