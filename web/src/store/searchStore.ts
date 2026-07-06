import { create } from 'zustand'
import { CATEGORY_GROUPS } from '@/data/categories'

const DEFAULT_CATEGORY_ID = CATEGORY_GROUPS[0]?.categories[0]?.id ?? ''

export interface SubmittedSearch {
  location: string
  lat?: number
  lng?: number
  keywords: string[]
  categoryLabel: string
  hasWebsite?: boolean
  hasBooking?: boolean
}

interface SearchState {
  location: string
  coords: { lat: number; lng: number } | null
  categoryId: string
  noWebsite: boolean
  noBooking: boolean
  submittedSearch: SubmittedSearch | null
  savedIds: Set<string>
  scrollY: number
  setLocation: (location: string) => void
  setCoords: (coords: { lat: number; lng: number } | null) => void
  setCategoryId: (categoryId: string) => void
  setNoWebsite: (value: boolean) => void
  setNoBooking: (value: boolean) => void
  submitSearch: (search: SubmittedSearch) => void
  markSaved: (placeId: string) => void
  setScrollY: (scrollY: number) => void
}

/**
 * Holds the Explorer page's search state outside the component tree so it
 * survives route changes (React Router unmounts SearchPage when navigating
 * away). Lives for the lifetime of the tab/session — not persisted to storage.
 */
export const useSearchStore = create<SearchState>((set) => ({
  location: '',
  coords: null,
  categoryId: DEFAULT_CATEGORY_ID,
  noWebsite: false,
  noBooking: false,
  submittedSearch: null,
  savedIds: new Set(),
  scrollY: 0,
  setLocation: (location) => set({ location }),
  setCoords: (coords) => set({ coords }),
  setCategoryId: (categoryId) => set({ categoryId }),
  setNoWebsite: (noWebsite) => set({ noWebsite }),
  setNoBooking: (noBooking) => set({ noBooking }),
  submitSearch: (submittedSearch) => set({ submittedSearch }),
  markSaved: (placeId) => set((s) => ({ savedIds: new Set(s.savedIds).add(placeId) })),
  setScrollY: (scrollY) => set({ scrollY }),
}))
