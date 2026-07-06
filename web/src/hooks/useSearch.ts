import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/AuthProvider'
import { searchCategory } from '@/services/search'
import { fetchKnownStatuses, saveLead } from '@/services/prospects'
import type { SearchLead } from '@/types/prospect'
import type { SubmittedSearch } from '@/store/searchStore'

// Kept in cache for an hour of inactivity so navigating away and back to
// Explorer never re-hits the Edge Function for an unchanged search.
const SEARCH_STALE_TIME = Infinity
const SEARCH_GC_TIME = 60 * 60_000

export function useCategorySearch(search: SubmittedSearch | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['category-search', search, user?.id],
    queryFn: async () => {
      const { categoryLabel, ...input } = search as SubmittedSearch
      const { results, meta } = await searchCategory(input)
      const placeIds = results.map(r => r.placeId).filter(Boolean)
      const known = user ? await fetchKnownStatuses(user.id, placeIds) : new Map()

      // Hide anything the user has already saved — every saved prospect has
      // a status by definition, so any known status means "already processed".
      const filtered = results
        .filter(r => !known.get(r.placeId))
        .map(r => ({ ...r, category: categoryLabel }))

      return { results: filtered, meta }
    },
    enabled: !!search,
    staleTime: SEARCH_STALE_TIME,
    gcTime: SEARCH_GC_TIME,
    refetchOnMount: false,
  })
}

export function useSaveLead() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (lead: SearchLead) => saveLead(user!.id, lead),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] })
      queryClient.invalidateQueries({ queryKey: ['prospect-counts'] })
    },
  })
}
