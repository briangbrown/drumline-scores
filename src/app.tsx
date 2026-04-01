import { useEffect, useCallback, useRef, useState } from 'react'
import { Layout } from './layout'
import { useRoute } from './hooks/use-route'
import { useSeasonData } from './hooks/use-season-data'
import { useFavorite } from './hooks/use-favorite'
import { ProgressionView } from './views/progression'
import { StandingsView } from './views/standings'
import { CrossSeasonView } from './views/cross-season'
import { MyEnsembleView } from './views/my-ensemble'
import { Loading, ErrorMessage } from './components/loading'
import { InstallBanner } from './components/install-banner'
import { OfflineIndicator } from './components/offline-indicator'
import { ToastProvider } from './components/toast'

export function App() {
  const { route, setClassId, setView, setShowId, updateRoute } = useRoute()
  const { years, season, shows, isLoading, error } = useSeasonData(route.year)
  const { favorite, favoriteNames, toggleFavorite, removeFavorite } = useFavorite()
  const myEnsembleRef = useRef<HTMLButtonElement>(null)
  const [isMyEnsembleFlashing, setIsMyEnsembleFlashing] = useState(false)

  // Lifted from ProgressionView so it persists across year/class changes
  const [selectedCaption, setSelectedCaption] = useState('Total')

  // When year changes, keep current class selection, reset show
  const handleYearChange = useCallback((year: number) => {
    updateRoute({ year, showId: null })
  }, [updateRoute])

  // Auto-select first class when none selected or current class doesn't exist in new season
  useEffect(() => {
    if (!season || season.classes.length === 0) return
    // When favorite is set and no class selected, show My Ensemble view
    if (!route.classId && favorite) return

    const classExists = route.classId && season.classes.some((c) => c.id === route.classId)
    if (!classExists) {
      setClassId(season.classes[0].id)
    }
  }, [season, route.classId, setClassId, favorite])

  // Navigate to class view from My Ensemble
  const handleViewClass = useCallback((classId: string) => {
    updateRoute({ classId, view: 'standings' })
  }, [updateRoute])

  // Toggle favorite — flash My Ensemble chip when a new favorite is set
  const handleToggleFavorite = useCallback((ensembleName: string) => {
    const wasFavorited = favoriteNames.has(ensembleName)
    toggleFavorite(ensembleName, route.classId)
    if (!wasFavorited) {
      // Wait for the pill to render, then scroll + flash
      requestAnimationFrame(() => {
        myEnsembleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
        setIsMyEnsembleFlashing(true)
        setTimeout(() => setIsMyEnsembleFlashing(false), 1200)
      })
    }
  }, [toggleFavorite, route.classId, favoriteNames])

  // Get shows filtered to the selected class
  const classShows = shows
    .map((show) => ({
      metadata: show.metadata,
      classResult: show.classes.find((c) => c.classDef.id === route.classId),
    }))
    .filter((s) => s.classResult !== undefined)

  // Auto-select latest show for standings, or fix stale showId
  useEffect(() => {
    if (route.view !== 'standings' || classShows.length === 0) return
    const showExists = classShows.some((s) => s.metadata.id === route.showId)
    if (!showExists) {
      setShowId(classShows[classShows.length - 1].metadata.id)
    }
  }, [route.view, route.showId, classShows, setShowId])

  // Show My Ensemble view when favorite is set and no class is selected
  const isShowingMyEnsemble = !isLoading && !error && !route.classId && favorite !== null

  return (
    <>
    <InstallBanner />
    <OfflineIndicator />
    <Layout
      year={route.year}
      years={years}
      season={season}
      classId={route.classId}
      view={route.view}
      onYearChange={handleYearChange}
      onClassChange={setClassId}
      onViewChange={setView}
      favorite={favorite}
      onShowMyEnsemble={() => updateRoute({ classId: '' })}
      myEnsembleRef={myEnsembleRef}
      isMyEnsembleFlashing={isMyEnsembleFlashing}
    >
      {isLoading && <Loading />}
      {error && <ErrorMessage message={error} />}

      {/* My Ensemble view */}
      {isShowingMyEnsemble && (
        <MyEnsembleView
          key={route.year}
          favorite={favorite}
          year={route.year}
          shows={shows}
          onRemoveFavorite={removeFavorite}
          onViewClass={handleViewClass}
        />
      )}

      {/* Class views */}
      {!isLoading && !error && route.classId && (
        <>
          {route.view === 'progression' && (
            <ProgressionView
              classId={route.classId}
              shows={classShows}
              highlight={route.highlight}
              favoriteNames={favoriteNames}
              onToggleFavorite={handleToggleFavorite}
              selectedCaption={selectedCaption}
              onCaptionChange={setSelectedCaption}
            />
          )}
          {route.view === 'standings' && (
            <StandingsView
              classId={route.classId}
              shows={classShows}
              selectedShowId={route.showId}
              onShowChange={setShowId}
              favoriteNames={favoriteNames}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
          {route.view === 'cross-season' && (
            <CrossSeasonView
              initialEnsemble={favorite?.ensembleName ?? route.highlight}
            />
          )}
        </>
      )}

      {/* No favorite, no class selected */}
      {!isLoading && !error && !route.classId && !favorite && season && (
        <div className="py-12 text-center text-text-muted">
          <p>Select a class above to view scores</p>
          <p className="mt-2 text-xs">
            Tip: tap &#9734; on any ensemble to set it as your default view
          </p>
        </div>
      )}
    </Layout>
    <ToastProvider />
    </>
  )
}
