import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/AuthProvider'
import {
  deleteProspect, getProspectCounts, listProspects,
  toggleFavorite, updateProspectNotes, updateProspectStatus,
} from '@/services/prospects'
import type { ProspectStatus } from '@/types/prospect'

export interface ProspectsFilter {
  status: ProspectStatus | 'all'
  favoritesOnly: boolean
  search: string
}

export function useProspects(filter: ProspectsFilter) {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  return useInfiniteQuery({
    queryKey: ['prospects', userId, filter],
    queryFn: ({ pageParam }) => listProspects({ userId, page: pageParam, ...filter }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!userId,
  })
}

export function useProspectCounts() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  return useQuery({
    queryKey: ['prospect-counts', userId],
    queryFn: () => getProspectCounts(userId),
    enabled: !!userId,
  })
}

function useInvalidateProspects() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['prospects'] })
    queryClient.invalidateQueries({ queryKey: ['prospect-counts'] })
  }
}

export function useUpdateProspectStatus() {
  const invalidate = useInvalidateProspects()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProspectStatus }) => updateProspectStatus(id, status),
    onSuccess: invalidate,
  })
}

export function useUpdateProspectNotes() {
  const invalidate = useInvalidateProspects()
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => updateProspectNotes(id, notes),
    onSuccess: invalidate,
  })
}

export function useToggleFavorite() {
  const invalidate = useInvalidateProspects()
  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) => toggleFavorite(id, isFavorite),
    onSuccess: invalidate,
  })
}

export function useDeleteProspect() {
  const invalidate = useInvalidateProspects()
  return useMutation({
    mutationFn: (id: string) => deleteProspect(id),
    onSuccess: invalidate,
  })
}
