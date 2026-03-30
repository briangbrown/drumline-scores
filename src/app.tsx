import { useEffect } from 'react'
import { Layout } from './layout'
import { useRoute } from './hooks/use-route'
import { useSeasonData } from './hooks/use-season-data'
import { ProgressionView } from './views/progression'
import { StandingsView } from './views/standings'
import { Loading, ErrorMessage } from './components/loading'

export function App() {
  const { route, setYear, setClassId, setView, setShowId } = useRoute()
  const { season, shows, isLoading, error } = useSeasonData(route.year)

  // Auto-select first class if none selected
  useEffect(() => {
    if (season && !route.classId && season.classes.length > 0) {
      setClassId(season.classes[0].id)
    }
  }, [season, route.classId, setClassId])

  // Get shows filtered to the selected class
  const classShows = shows
    .map((show) => ({
      metadata: show.metadata,
      classResult: show.classes.find((c) => c.classDef.id === route.classId),
    }))
    .filter((s) => s.classResult !== undefined)

  // Auto-select latest show for standings view
  useEffect(() => {
    if (route.view === 'standings' && !route.showId && classShows.length > 0) {
      setShowId(classShows[classShows.length - 1].metadata.id)
    }
  }, [route.view, route.showId, classShows, setShowId])

  return (
    <Layout
      year={route.year}
      season={season}
      classId={route.classId}
      view={route.view}
      onYearChange={setYear}
      onClassChange={setClassId}
      onViewChange={setView}
    >
      {isLoading && <Loading />}
      {error && <ErrorMessage message={error} />}
      {!isLoading && !error && route.classId && (
        <>
          {route.view === 'progression' && (
            <ProgressionView
              classId={route.classId}
              shows={classShows}
              highlight={route.highlight}
            />
          )}
          {route.view === 'standings' && (
            <StandingsView
              classId={route.classId}
              shows={classShows}
              selectedShowId={route.showId}
              onShowChange={setShowId}
            />
          )}
        </>
      )}
      {!isLoading && !error && !route.classId && season && (
        <div className="py-12 text-center text-text-muted">
          Select a class above to view scores
        </div>
      )}
    </Layout>
  )
}
