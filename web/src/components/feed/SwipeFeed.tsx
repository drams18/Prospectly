import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategoryFilterPreference } from '@/hooks/useCategoryFilterPreference'
import { buildFeedQueryKey, useFeed } from '@/hooks/useFeed'
import { useGeolocation } from '@/hooks/useGeolocation'
import {
  useActiveProspectingSession, useCompleteProspectingSession,
  useCreateProspectingSession, useUpdateProspectingSession,
} from '@/hooks/useProspectingSession'
import { useMarkSeen, useSaveLead } from '@/hooks/useSearch'
import { useAuth } from '@/lib/AuthProvider'
import type { UpdateSessionInput } from '@/services/prospectingSession'
import { useFeedStore } from '@/store/feedStore'
import type { SearchLead } from '@/types/prospect'
import { CategoryFilterButton } from './CategoryFilterButton'
import { CategoryFilterSheet } from './CategoryFilterSheet'
import { FeedEndCard } from './FeedEndCard'
import { FeedStack } from './FeedStack'
import { GeolocationGate } from './GeolocationGate'

const PROGRESS_SAVE_DEBOUNCE_MS = 1000

export function SwipeFeed() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const queryClient = useQueryClient()

  const { status, retry } = useGeolocation()
  const coords = useFeedStore((s) => s.coords)
  const currentIndex = useFeedStore((s) => s.currentIndex)
  const setIndex = useFeedStore((s) => s.setIndex)
  const savedIds = useFeedStore((s) => s.savedIds)
  const markSaved = useFeedStore((s) => s.markSaved)
  const selectedCategoryIds = useFeedStore((s) => s.selectedCategoryIds)
  const setSelectedCategoryIds = useFeedStore((s) => s.setSelectedCategoryIds)
  const saveLead = useSaveLead()
  const markSeen = useMarkSeen()
  const [filterOpen, setFilterOpen] = useState(false)

  // Point 16: an active session (exact leads/index/filters) takes priority
  // over both fresh geolocation-driven fetching and the profile's last-used
  // category filter — see useCategoryFilterPreference's defer/skip params.
  const { data: session, isLoading: sessionLoading } = useActiveProspectingSession()
  const createSession = useCreateProspectingSession()
  const updateSession = useUpdateProspectingSession()
  const completeSession = useCompleteProspectingSession()

  useCategoryFilterPreference(sessionLoading, !!session)

  // These guards used to be local refs, which reset to their initial value
  // every time this component remounts (i.e. every time the user leaves and
  // comes back to Explorer) — re-running hydration and clobbering the
  // already-correct in-progress index/feed with a stale snapshot. Reading
  // them from feedStore instead means they only reset on a real page reload.
  useEffect(() => {
    if (sessionLoading || useFeedStore.getState().sessionHydrated) return
    useFeedStore.getState().setSessionHydrated(true)
    if (!session) return
    useFeedStore.getState().setSessionId(session.id)
    if (session.coords) useFeedStore.getState().setCoords(session.coords)
    setSelectedCategoryIds(session.category_ids)
    setIndex(session.current_index)
    if (session.coords) {
      queryClient.setQueryData(buildFeedQueryKey(userId, session.coords, session.category_ids), {
        pages: [{ results: session.leads, meta: { bandIndex: Math.max(session.next_band_index - 1, 0), exhausted: false } }],
        pageParams: [0],
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, sessionLoading])

  const { leads, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, data } = useFeed(coords, selectedCategoryIds)

  // Point 7: the card currently on screen is considered "vu" and must never
  // reappear — persisted right away, not only when the user swipes past it.
  const seenPlaceIdsRef = useRef(new Set<string>())
  useEffect(() => {
    const lead = leads[currentIndex]
    if (!lead || seenPlaceIdsRef.current.has(lead.placeId)) return
    seenPlaceIdsRef.current.add(lead.placeId)
    markSeen.mutate(lead)
  }, [currentIndex, leads, markSeen])

  // Creates the session row lazily, the first time this device has fetched
  // a real page of leads without finding an existing active one to resume.
  useEffect(() => {
    if (sessionLoading || useFeedStore.getState().sessionId || !coords || leads.length === 0) return
    const nextBandIndex = (data?.pages.at(-1)?.meta.bandIndex ?? -1) + 1
    createSession.mutate(
      { coords, categoryIds: selectedCategoryIds, leads, nextBandIndex },
      { onSuccess: (created) => { useFeedStore.getState().setSessionId(created.id) } },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, coords, leads.length])

  // Debounced progress persistence: index moves on every swipe, and leads
  // grow every time a new band is fetched — both get folded back into the
  // session row so a reload resumes with byte-identical state. The pending
  // payload also lives in a ref so the unmount effect below can flush it
  // immediately if the user navigates away before the debounce fires.
  const pendingSaveRef = useRef<{ id: string; input: UpdateSessionInput } | null>(null)
  useEffect(() => {
    const sessionId = useFeedStore.getState().sessionId
    if (!sessionId) return
    const nextBandIndex = (data?.pages.at(-1)?.meta.bandIndex ?? -1) + 1
    pendingSaveRef.current = { id: sessionId, input: { leads, currentIndex, nextBandIndex, categoryIds: selectedCategoryIds } }
    const timer = setTimeout(() => {
      if (!pendingSaveRef.current) return
      updateSession.mutate(pendingSaveRef.current)
      pendingSaveRef.current = null
    }, PROGRESS_SAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, leads.length, selectedCategoryIds])

  // Runs only on true unmount (route navigation away from Explorer) — flushes
  // a save that was debounced but never got to fire, so a quick swipe right
  // before leaving isn't lost.
  useEffect(() => () => {
    if (!pendingSaveRef.current) return
    updateSession.mutate(pendingSaveRef.current)
    pendingSaveRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const empty = !isLoading && leads.length === 0 && !hasNextPage && !isFetchingNextPage
  const reachedEnd = !empty && !isLoading && !hasNextPage && !isFetchingNextPage && currentIndex >= leads.length - 1

  // Once the feed is genuinely exhausted, the session is done — reopening
  // Explorer later should start a fresh one rather than resume an empty list.
  useEffect(() => {
    const feedState = useFeedStore.getState()
    if (!reachedEnd || feedState.sessionEnded || !feedState.sessionId) return
    feedState.setSessionEnded(true)
    completeSession.mutate(feedState.sessionId)
    feedState.setSessionId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reachedEnd])

  if (status !== 'granted' || !coords) {
    return <GeolocationGate status={status} onRetry={retry} />
  }

  function onSave(lead: SearchLead) {
    // Point 1: validating a prospect is meant to hand off straight into its
    // fiche so the user can keep working on it, not stay stuck in the feed.
    saveLead.mutate(lead, {
      onSuccess: (prospect) => {
        markSaved(lead.placeId)
        navigate(`/prospects/${prospect.id}`)
      },
    })
  }

  // Point 16: "Nouvelle session de prospection" — the only way the feed
  // ever resets on purpose. Everything else (reload, logout, tab close)
  // must resume exactly where the user left off.
  function onNewSession() {
    const { sessionId } = useFeedStore.getState()
    useFeedStore.setState({ sessionId: null, sessionHydrated: true, sessionEnded: false })
    setIndex(0)
    seenPlaceIdsRef.current.clear()
    pendingSaveRef.current = null
    queryClient.removeQueries({ queryKey: ['feed'] })
    if (sessionId) completeSession.mutate(sessionId)
    refetch()
  }

  let content: ReactNode
  if ((isLoading && leads.length === 0) || sessionLoading) {
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
    content = <FeedEndCard empty={empty} onRefresh={onNewSession} />
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
      <button
        type="button"
        onClick={onNewSession}
        className="fixed right-4 top-4 z-30 rounded-full bg-white/90 px-3 py-2 text-xs font-medium text-text shadow-sm backdrop-blur-sm hover:bg-white"
      >
        Nouvelle session
      </button>
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
