import { supabase } from '@/lib/supabaseClient'
import type { SearchLead } from '@/types/prospect'

export interface FeedBandParams {
  lat: number
  lng: number
  bandIndex: number
}

export interface FeedBandResult {
  results: SearchLead[]
  meta: { mode: 'feed'; bandIndex: number; exhausted: boolean }
}

export async function fetchFeedBand({ lat, lng, bandIndex }: FeedBandParams): Promise<FeedBandResult> {
  const { data, error } = await supabase.functions.invoke('search', {
    body: { mode: 'feed', lat, lng, bandIndex },
  })
  if (error) throw error
  return data
}
