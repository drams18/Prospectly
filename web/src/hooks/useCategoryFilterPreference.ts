import { useEffect, useRef } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/AuthProvider'
import { getProfile, updateCategoryFilters } from '@/services/profile'
import { useFeedStore } from '@/store/feedStore'
import { useDebouncedValue } from './useDebouncedValue'

// Loads the user's last-used category filter from `profiles.category_filters`
// into feedStore on first mount, then keeps it in sync (debounced) whenever
// the selection changes — so the filter is remembered across devices/sessions.
//
// `deferUntilDecided`/`skipHydration` let a resumed prospecting session take
// priority: while SwipeFeed doesn't yet know whether an active session
// exists, hydration is deferred (never consumed) rather than skipped
// outright, so users with no session still get their profile default; once
// a session IS found, its own category_ids win and this hydration no-ops.
export function useCategoryFilterPreference(deferUntilDecided = false, skipHydration = false) {
  const { user } = useAuth()
  const selectedCategoryIds = useFeedStore((s) => s.selectedCategoryIds)
  const setSelectedCategoryIds = useFeedStore((s) => s.setSelectedCategoryIds)
  const hydrated = useRef(false)

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (hydrated.current || !profile || deferUntilDecided) return
    hydrated.current = true
    if (!skipHydration && profile.category_filters.length) setSelectedCategoryIds(profile.category_filters)
  }, [profile, setSelectedCategoryIds, deferUntilDecided, skipHydration])

  const updateMutation = useMutation({
    mutationFn: (ids: string[]) => updateCategoryFilters(user!.id, ids),
  })

  const debouncedIds = useDebouncedValue(selectedCategoryIds, 500)
  useEffect(() => {
    if (!user || !hydrated.current) return
    const saved = profile?.category_filters ?? []
    const unchanged = saved.length === debouncedIds.length && saved.every((id) => debouncedIds.includes(id))
    if (unchanged) return
    updateMutation.mutate(debouncedIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedIds, user])
}
