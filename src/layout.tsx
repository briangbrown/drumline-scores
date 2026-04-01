import { useRef, useEffect, useMemo, type ReactNode, type Ref } from 'react'
import { Star } from 'lucide-react'
import { Pill } from './components/pill'
import { SettingsButton } from './components/settings-dialog'
import { ShareButton } from './components/share-button'
import { showToast } from './components/toast'
import { getClassAbbreviation, compareClassOrder } from './parser'
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

/**
 * Horizontally scroll the container so the active pill is visible,
 * without affecting vertical page scroll.
 */
function scrollActiveIntoView(container: HTMLDivElement | null, behavior: ScrollBehavior = 'smooth') {
  if (!container) return
  const active = container.querySelector<HTMLElement>('[data-active]')
  if (!active) return

  const containerLeft = container.scrollLeft
  const containerWidth = container.clientWidth
  const pillLeft = active.offsetLeft
  const pillWidth = active.offsetWidth

  if (pillLeft < containerLeft) {
    container.scrollTo({ left: pillLeft, behavior })
  } else if (pillLeft + pillWidth > containerLeft + containerWidth) {
    container.scrollTo({ left: pillLeft + pillWidth - containerWidth, behavior })
  }
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
  const classes = useMemo(
    () => (season?.classes ?? []).toSorted((a, b) => compareClassOrder(a.name, b.name)),
    [season?.classes],
  )
  const isCrossSeason = view === 'cross-season'

  // Refs for pill row containers (auto-scroll)
  const yearRowRef = useRef<HTMLDivElement>(null)
  const classRowRef = useRef<HTMLDivElement>(null)

  // When the year changes, jump instantly so the class row doesn't visibly animate
  useEffect(() => {
    requestAnimationFrame(() => {
      scrollActiveIntoView(yearRowRef.current, 'instant')
      scrollActiveIntoView(classRowRef.current, 'instant')
    })
  }, [year])
  // When the user picks a different class within the same year, smooth-scroll to it
  useEffect(() => {
    requestAnimationFrame(() => scrollActiveIntoView(classRowRef.current))
  }, [classId])

  const handleDisabledClick = () => {
    showToast('Switch to Progression or Standings first')
  }

  return (
    <div className="mx-auto max-w-[920px] px-4 py-4">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <a
            href="#/"
            className="text-lg font-bold text-accent tracking-tight hover:text-accent/80 transition-colors"
          >
            Drumline Scores
          </a>
          <div className="flex items-center gap-1">
            <ShareButton />
            <SettingsButton />
          </div>
        </div>

        {/* Year selector */}
        {years.length > 1 && (
          <div ref={yearRowRef} className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {years.map((y) => (
              <Pill
                key={y}
                label={String(y)}
                isActive={y === year}
                disabled={isCrossSeason}
                onClick={isCrossSeason ? handleDisabledClick : () => onYearChange(y)}
              />
            ))}
          </div>
        )}

        {/* Class selector */}
        {classes.length > 0 && (
          <div ref={classRowRef} className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pt-1 pb-1 scrollbar-none">
            {favorite && (
              <Pill
                label={<span className="flex items-center gap-1.5"><Star className="h-3 w-3" fill="currentColor" />My Ensemble</span>}
                isActive={!classId}
                disabled={isCrossSeason}
                onClick={isCrossSeason ? handleDisabledClick : onShowMyEnsemble}
                ref={myEnsembleRef}
                isFlashing={isMyEnsembleFlashing}
              />
            )}
            {classes.map((cls) => (
              <Pill
                key={cls.id}
                label={cls.id === classId ? cls.name.replace(/^Percussion\s+/, '') : getClassAbbreviation(cls.name)}
                isActive={cls.id === classId}
                disabled={isCrossSeason}
                onClick={isCrossSeason ? handleDisabledClick : () => onClassChange(cls.id)}
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

      {/* Disclaimer */}
      <footer className="mt-8 pb-6 text-center text-xs text-text-muted">
        Scores are unofficial. For official scores visit{' '}
        <a
          href="https://rmpa.org/scores"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-text-secondary transition-colors"
        >
          rmpa.org/scores
        </a>
      </footer>
    </div>
  )
}
