import { useEffect, useRef } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useFeed } from '@/hooks/useFeed'
import { useMarkSeen, useSaveLead } from '@/hooks/useSearch'
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
  const markSeen = useMarkSeen()

  const { leads, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useFeed(coords)

  // Point 7: the card currently on screen is considered "vu" and must never
  // reappear — persisted right away, not only when the user swipes past it.
  const seenPlaceIdsRef = useRef(new Set<string>())
  useEffect(() => {
    const lead = leads[currentIndex]
    if (!lead || seenPlaceIdsRef.current.has(lead.placeId)) return
    seenPlaceIdsRef.current.add(lead.placeId)
    markSeen.mutate(lead)
  }, [currentIndex, leads, markSeen])

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
