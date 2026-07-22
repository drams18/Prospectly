import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/AuthProvider'
import {
  deleteProspect, getProspectById, getProspectCounts, listProspects, restoreProspect,
  toggleFavorite, updateProspectEmail, updateProspectPriority, updateProspectStatus,
  updateProspectWebsite,
} from '@/services/prospects'
import type { Prospect, ProspectStatus } from '@/types/prospect'

export interface ProspectsFilter {
  status: ProspectStatus | 'all'
  favoritesOnly: boolean
  validatedOnly?: boolean
  excludeValidated?: boolean
  search: string
  orderBy?: 'updated_at' | 'last_seen_at'
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

// Point 10: a restored prospect must be able to reappear in the feed, so
// this also invalidates the feed/search caches (not just the CRM list).
function useInvalidateAfterRestore() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['prospects'] })
    queryClient.invalidateQueries({ queryKey: ['prospect-counts'] })
    queryClient.invalidateQueries({ queryKey: ['feed'] })
    queryClient.invalidateQueries({ queryKey: ['category-search'] })
  }
}

export function useUpdateProspectStatus() {
  const invalidate = useInvalidateProspects()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProspectStatus }) => updateProspectStatus(id, status),
    onSuccess: invalidate,
  })
}

export function useUpdateProspectPriority() {
  const invalidate = useInvalidateProspects()
  return useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: Prospect['priority'] }) => updateProspectPriority(id, priority),
    onSuccess: invalidate,
  })
}

export function useUpdateProspectEmail() {
  const invalidate = useInvalidateProspects()
  return useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) => updateProspectEmail(id, email),
    onSuccess: invalidate,
  })
}

export function useUpdateProspectWebsite() {
  const invalidate = useInvalidateProspects()
  return useMutation({
    mutationFn: ({ id, website }: { id: string; website: string }) => updateProspectWebsite(id, website),
    onSuccess: invalidate,
  })
}

// Direct fetch by id, independent of any list's current filter/pagination —
// used to open a prospect's fiche straight from a deep link (e.g. the
// redirect right after validating it from Explorer).
export function useProspect(id: string | undefined) {
  return useQuery({
    queryKey: ['prospect', id],
    queryFn: () => getProspectById(id as string),
    enabled: !!id,
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

export function useRestoreProspect() {
  const invalidate = useInvalidateAfterRestore()
  return useMutation({
    mutationFn: (id: string) => restoreProspect(id),
    onSuccess: invalidate,
  })
}
