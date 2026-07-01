import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/AuthProvider'
import { listProspects } from '@/services/prospects'
import { useDebouncedValue } from './useDebouncedValue'

export function useGlobalSearch(term: string) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const debounced = useDebouncedValue(term, 250)

  return useQuery({
    queryKey: ['global-search', userId, debounced],
    queryFn: () => listProspects({ userId, status: 'all', search: debounced, sort: 'updated_desc', page: 0 }),
    enabled: !!userId && debounced.trim().length >= 2,
  })
}
