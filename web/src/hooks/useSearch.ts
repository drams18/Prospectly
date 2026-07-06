import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/AuthProvider'
import { searchCategory, type SearchFilters } from '@/services/search'
import { fetchKnownStatuses, saveLead } from '@/services/prospects'
import type { SearchLead } from '@/types/prospect'

export interface CategorySearchInput extends SearchFilters {
  location: string
  lat?: number
  lng?: number
  keywords: string[]
  categoryLabel: string
}

export function useCategorySearch() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ categoryLabel, ...input }: CategorySearchInput) => {
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
