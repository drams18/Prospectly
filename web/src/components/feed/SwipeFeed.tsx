import { useGeolocation } from '@/hooks/useGeolocation'
import { useFeed } from '@/hooks/useFeed'
import { useSaveLead } from '@/hooks/useSearch'
import { useFeedStore } from '@/store/feedStore'
import type { SearchLead } from '@/types/prospect'
import { FeedEndCard } from './FeedEndCard'
import { FeedStack } from './FeedStack'
import { GeolocationGate } from './GeolocationGate'

export function SwipeFeed() {
  const { status, retry } = useGeolocation()
  const coords = useFeedStore((s) => s.coords)
  const currentIndex = useFeedStore((s) => s.currentIndex)
  const savedIds = useFeedStore((s) => s.savedIds)
  const markSaved = useFeedStore((s) => s.markSaved)
  const saveLead = useSaveLead()

  const { leads, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useFeed(coords)

  if (status !== 'granted' || !coords) {
    return <GeolocationGate status={status} onRetry={retry} />
  }

  if (isLoading && leads.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-border-strong border-t-primary" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-danger-text">{(error as Error)?.message ?? 'Une erreur est survenue.'}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-app border border-border-strong px-4 py-2 text-sm text-text-secondary hover:bg-bg"
        >
          Réessayer
        </button>
      </div>
    )
  }

  const empty = leads.length === 0 && !hasNextPage && !isFetchingNextPage
  const reachedEnd = !empty && !hasNextPage && !isFetchingNextPage && currentIndex >= leads.length - 1

  if (empty || reachedEnd) {
    return <FeedEndCard empty={empty} onRefresh={() => refetch()} />
  }

  function onSave(lead: SearchLead) {
    saveLead.mutate(lead, { onSuccess: () => markSaved(lead.placeId) })
  }

  return (
    <FeedStack
      leads={leads}
      savedIds={savedIds}
      onSave={onSave}
      onNeedMore={() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage()
      }}
    />
  )
}
