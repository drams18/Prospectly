import { supabase } from '@/lib/supabaseClient'
import type { SearchLead } from '@/types/prospect'

export interface SearchFilters {
  hasWebsite?: boolean
  hasBooking?: boolean
  minRating?: number
  minReviews?: number
  category?: string
  onlyHot?: boolean
}

interface BaseSearchBody extends SearchFilters {
  location: string
  lat?: number
  lng?: number
}

export async function fetchCategoryCounts(body: BaseSearchBody): Promise<Record<string, number>> {
  const { data, error } = await supabase.functions.invoke('search', {
    body: { ...body, categoryCounts: true },
  })
  if (error) throw error
  return data.counts ?? {}
}

export interface CategorySearchResult {
  results: SearchLead[]
  meta: { mode: string; total: number; totalUnfiltered: number; keywords?: string[] }
}

export async function searchCategory(body: BaseSearchBody & { keywords: string[] }): Promise<CategorySearchResult> {
  const { data, error } = await supabase.functions.invoke('search', {
    body: { ...body, mode: 'multi' },
  })
  if (error) throw error
  return data
}
