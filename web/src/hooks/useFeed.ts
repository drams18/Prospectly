import { useInfiniteQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAuth } from '@/lib/AuthProvider'
import { fetchFeedBand } from '@/services/feed'
import { fetchKnownStatuses } from '@/services/prospects'
import type { SearchLead } from '@/types/prospect'

const FEED_STALE_TIME = Infinity
const FEED_GC_TIME = 60 * 60_000

interface Coords {
  lat: number
  lng: number
}

// Exported so a resumed prospecting session can seed this exact cache entry
// (queryClient.setQueryData) instead of re-fetching — the key must match
// byte-for-byte or the seeded data would just sit next to a fresh fetch.
export function buildFeedQueryKey(userId: string, coords: Coords | null, categoryIds: string[]) {
  const catKey = categoryIds.length ? [...categoryIds].sort().join(',') : 'all'
  return ['feed', coords?.lat.toFixed(4), coords?.lng.toFixed(4), userId, catKey] as const
}

export function useFeed(coords: Coords | null, categoryIds: string[] = []) {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const query = useInfiniteQuery({
    queryKey: buildFeedQueryKey(userId, coords, categoryIds),
    queryFn: async ({ pageParam }) => {
      const { lat, lng } = coords as Coords
      const { results, meta } = await fetchFeedBand({ lat, lng, bandIndex: pageParam, categoryIds })

      const placeIds = results.map((r) => r.placeId).filter(Boolean)
      const known = user ? await fetchKnownStatuses(user.id, placeIds) : new Map()
      const filtered = results.filter((r) => !known.get(r.placeId))

      return { results: filtered, meta }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.meta.exhausted ? undefined : lastPage.meta.bandIndex + 1),
    enabled: !!coords,
    staleTime: FEED_STALE_TIME,
    gcTime: FEED_GC_TIME,
    refetchOnMount: false,
  })

  const leads = useMemo<SearchLead[]>(
    () => query.data?.pages.flatMap((page) => page.results) ?? [],
    [query.data],
  )

  return { ...query, leads }
}
