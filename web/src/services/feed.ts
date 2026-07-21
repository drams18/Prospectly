import { supabase } from '@/lib/supabaseClient'
import type { SearchLead } from '@/types/prospect'

export interface FeedBandParams {
  lat: number
  lng: number
  bandIndex: number
  categoryIds?: string[]
}

export interface FeedBandResult {
  results: SearchLead[]
  meta: { mode: 'feed'; bandIndex: number; exhausted: boolean }
}

export async function fetchFeedBand({ lat, lng, bandIndex, categoryIds }: FeedBandParams): Promise<FeedBandResult> {
  const { data, error } = await supabase.functions.invoke('search', {
    body: { mode: 'feed', lat, lng, bandIndex, categoryIds },
  })
  if (error) throw error
  return data
}

export interface FeedCategoryCountsParams {
  lat: number
  lng: number
  groupId: string
}

export async function fetchFeedCategoryCounts({ lat, lng, groupId }: FeedCategoryCountsParams): Promise<Record<string, number>> {
  const { data, error } = await supabase.functions.invoke('search', {
    body: { categoryCounts: true, lat, lng, groupId },
  })
  if (error) throw error
  return data.counts
}
