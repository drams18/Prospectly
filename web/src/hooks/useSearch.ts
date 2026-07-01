import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/AuthProvider'
import { fetchCategoryCounts, searchCategory, type SearchFilters } from '@/services/search'
import { fetchKnownStatuses, markLeadSeen } from '@/services/prospects'
import type { SearchLead } from '@/types/prospect'

export interface ZoneSearchInput {
  location: string
  lat?: number
  lng?: number
}

export function useZoneSearch() {
  return useMutation({
    mutationFn: (input: ZoneSearchInput) => fetchCategoryCounts(input),
  })
}

export interface CategorySearchInput extends ZoneSearchInput, SearchFilters {
  keywords: string[]
}

export function useCategorySearch() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: CategorySearchInput) => {
      const { results, meta } = await searchCategory(input)
      const placeIds = results.map(r => r.placeId).filter(Boolean)
      const known = user ? await fetchKnownStatuses(user.id, placeIds) : new Map()

      // Hide anything the user has already processed (any status but 'new').
      const filtered = results.filter(r => {
        const status = known.get(r.placeId)
        return !status || status === 'new'
      })

      return { results: filtered, meta, known }
    },
  })
}

export function useMarkSeen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (lead: SearchLead) => markLeadSeen(user!.id, lead),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] })
      queryClient.invalidateQueries({ queryKey: ['prospect-counts'] })
    },
  })
}
