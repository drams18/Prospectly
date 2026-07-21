import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useCategoryFilterPreference } from '@/hooks/useCategoryFilterPreference'
import { useFeed } from '@/hooks/useFeed'
import { useMarkSeen, useSaveLead } from '@/hooks/useSearch'
import { useFeedStore } from '@/store/feedStore'
import type { SearchLead } from '@/types/prospect'
import { CategoryFilterButton } from './CategoryFilterButton'
import { CategoryFilterSheet } from './CategoryFilterSheet'
import { FeedEndCard } from './FeedEndCard'
import { FeedStack } from './FeedStack'
import { GeolocationGate } from './GeolocationGate'

export function SwipeFeed() {
  const { status, retry } = useGeolocation()
  const coords = useFeedStore((s) => s.coords)
  const currentIndex = useFeedStore((s) => s.currentIndex)
  const savedIds = useFeedStore((s) => s.savedIds)
  const markSaved = useFeedStore((s) => s.markSaved)
  const selectedCategoryIds = useFeedStore((s) => s.selectedCategoryIds)
  const setSelectedCategoryIds = useFeedStore((s) => s.setSelectedCategoryIds)
  const saveLead = useSaveLead()
  const markSeen = useMarkSeen()
  const [filterOpen, setFilterOpen] = useState(false)

  useCategoryFilterPreference()

  const { leads, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useFeed(coords, selectedCategoryIds)

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

  function onSave(lead: SearchLead) {
    saveLead.mutate(lead, { onSuccess: () => markSaved(lead.placeId) })
  }

  const empty = !isLoading && leads.length === 0 && !hasNextPage && !isFetchingNextPage
  const reachedEnd = !empty && !isLoading && !hasNextPage && !isFetchingNextPage && currentIndex >= leads.length - 1

  let content: ReactNode
  if (isLoading && leads.length === 0) {
    content = (
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-border-strong border-t-primary" />
      </div>
    )
  } else if (isError) {
    content = (
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
  } else if (empty || reachedEnd) {
    content = <FeedEndCard empty={empty} onRefresh={() => refetch()} />
  } else {
    content = (
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

  return (
    <>
      <CategoryFilterButton activeCount={selectedCategoryIds.length} onClick={() => setFilterOpen(true)} />
      <CategoryFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        selectedCategoryIds={selectedCategoryIds}
        onChange={setSelectedCategoryIds}
        coords={coords}
      />
      {content}
    </>
  )
}
