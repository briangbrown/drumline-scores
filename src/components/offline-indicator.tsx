import { useOnlineStatus } from '../hooks/use-online-status'

export function OfflineIndicator() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="mx-auto max-w-[920px] px-4 mb-4">
      <div className="rounded-lg border border-text-muted/30 bg-surface px-4 py-2 text-center text-xs text-text-muted">
        You are offline — showing cached data
      </div>
    </div>
  )
}
