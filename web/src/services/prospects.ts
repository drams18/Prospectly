import { supabase } from '@/lib/supabaseClient'
import type { Prospect, ProspectStatus, SearchLead } from '@/types/prospect'

const PAGE_SIZE = 30

export interface ListProspectsParams {
  userId: string
  status?: ProspectStatus | 'all'
  favoritesOnly?: boolean
  search?: string
  page: number
}

export interface ListProspectsResult {
  rows: Prospect[]
  nextPage: number | null
}

export async function listProspects({
  userId, status = 'all', favoritesOnly = false, search = '', page,
}: ListProspectsParams): Promise<ListProspectsResult> {
  let query = supabase.from('prospects').select('*').eq('user_id', userId)

  if (status !== 'all') query = query.eq('status', status)
  if (favoritesOnly) query = query.eq('is_favorite', true)
  if (search.trim()) {
    const term = `%${search.trim()}%`
    query = query.or(
      `name.ilike.${term},address.ilike.${term},phone.ilike.${term},website.ilike.${term},category.ilike.${term}`
    )
  }

  query = query.order('updated_at', { ascending: false, nullsFirst: false })

  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data, error } = await query.range(from, to)
  if (error) throw error

  const rows = (data ?? []) as Prospect[]
  return { rows, nextPage: rows.length === PAGE_SIZE ? page + 1 : null }
}

export async function getProspectCounts(userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('prospects').select('status').eq('user_id', userId)
  if (error) throw error

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1
  }
  return counts
}

export async function updateProspectStatus(id: string, status: ProspectStatus): Promise<void> {
  const { error } = await supabase.from('prospects').update({ status }).eq('id', id)
  if (error) throw error
}

export async function updateProspectNotes(id: string, notes: string): Promise<void> {
  const { error } = await supabase.from('prospects').update({ notes }).eq('id', id)
  if (error) throw error
}

export async function toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
  const { error } = await supabase.from('prospects').update({ is_favorite: isFavorite }).eq('id', id)
  if (error) throw error
}

export async function deleteProspect(id: string): Promise<void> {
  const { error } = await supabase.from('prospects').delete().eq('id', id)
  if (error) throw error
}

// Fetches the current user's known prospects among a batch of Google place_ids
// — used to exclude already-processed businesses from fresh search results.
export async function fetchKnownStatuses(userId: string, placeIds: string[]): Promise<Map<string, ProspectStatus>> {
  if (!placeIds.length) return new Map()
  const { data, error } = await supabase
    .from('prospects')
    .select('place_id, status')
    .eq('user_id', userId)
    .in('place_id', placeIds)
  if (error) throw error

  const map = new Map<string, ProspectStatus>()
  for (const row of data ?? []) {
    if (row.place_id) map.set(row.place_id, row.status as ProspectStatus)
  }
  return map
}

// Explicit "Sauvegarder" action: persists a search lead into the user's
// prospects. Only writes a fresh 'to_contact' status on first insert — an
// already-saved prospect keeps whatever status the user has since set.
export async function saveLead(userId: string, lead: SearchLead): Promise<Prospect> {
  const { data: existing, error: selectError } = await supabase
    .from('prospects')
    .select('id')
    .eq('user_id', userId)
    .eq('place_id', lead.placeId)
    .maybeSingle()
  if (selectError) throw selectError

  const fields = {
    name: lead.name,
    category: lead.category,
    address: lead.address,
    phone: lead.phone,
    website: lead.website,
    rating: lead.rating,
    reviews: lead.reviews,
    google_maps_url: lead.googleMapsUrl,
    lat: lead.lat,
    lng: lead.lng,
    score: lead.score,
    has_booking: lead.hasBooking,
    booking_type: lead.bookingType,
    has_instagram: lead.hasInstagram,
    is_hot: lead.isHot,
    wasted_potential: lead.wastedPotential,
  }

  if (!existing) {
    const { data, error } = await supabase.from('prospects').insert({
      user_id: userId,
      place_id: lead.placeId,
      status: 'to_contact',
      ...fields,
    }).select().single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('prospects')
    .update(fields)
    .eq('id', existing.id)
    .select()
    .single()
  if (error) throw error
  return data
}
