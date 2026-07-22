import { create } from 'zustand'

interface Coords {
  lat: number
  lng: number
}

interface FeedState {
  coords: Coords | null
  currentIndex: number
  isTransitioning: boolean
  savedIds: Set<string>
  selectedCategoryIds: string[]
  sessionId: string | null
  sessionHydrated: boolean
  sessionEnded: boolean
  setCoords: (coords: Coords) => void
  goNext: (count: number) => void
  goPrevious: () => void
  setIndex: (index: number) => void
  setTransitioning: (value: boolean) => void
  markSaved: (placeId: string) => void
  setSelectedCategoryIds: (categoryIds: string[]) => void
  setSessionId: (id: string | null) => void
  setSessionHydrated: (value: boolean) => void
  setSessionEnded: (value: boolean) => void
}

/**
 * Holds the Explorer feed's position + progress outside the component tree
 * so it survives route changes (React Router unmounts SearchPage when
 * navigating away) — same rationale as the legacy searchStore.ts.
 * `isTransitioning` is a single shared lock: drag, wheel, and keyboard
 * navigation all check/set it so an animation in flight can't be
 * double-triggered into skipping a card.
 * `sessionId`/`sessionHydrated`/`sessionEnded` used to be local refs in
 * SwipeFeed — since the component unmounts on every route change, those refs
 * reset on each return to Explorer, re-running the session-hydration effect
 * with a stale snapshot and clobbering the (correctly preserved) index and
 * feed cache. Living here instead means they only reset on a real page
 * reload or an explicit "Nouvelle session".
 */
export const useFeedStore = create<FeedState>((set) => ({
  coords: null,
  currentIndex: 0,
  isTransitioning: false,
  savedIds: new Set(),
  selectedCategoryIds: [],
  sessionId: null,
  sessionHydrated: false,
  sessionEnded: false,
  setCoords: (coords) => set({ coords }),
  goNext: (count) => set((s) => ({ currentIndex: Math.min(s.currentIndex + 1, Math.max(count - 1, 0)) })),
  goPrevious: () => set((s) => ({ currentIndex: Math.max(s.currentIndex - 1, 0) })),
  // Absolute jump, used only to hydrate a resumed prospecting session — the
  // in-app navigation always goes through goNext/goPrevious.
  setIndex: (index) => set({ currentIndex: index }),
  setTransitioning: (isTransitioning) => set({ isTransitioning }),
  markSaved: (placeId) => set((s) => ({ savedIds: new Set(s.savedIds).add(placeId) })),
  // A new category selection means a whole new leads list — the previous
  // scroll position/card index no longer means anything.
  setSelectedCategoryIds: (categoryIds) => set({ selectedCategoryIds: categoryIds, currentIndex: 0 }),
  setSessionId: (sessionId) => set({ sessionId }),
  setSessionHydrated: (sessionHydrated) => set({ sessionHydrated }),
  setSessionEnded: (sessionEnded) => set({ sessionEnded }),
}))
