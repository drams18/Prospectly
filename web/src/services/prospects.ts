import { supabase } from '@/lib/supabaseClient'
import type { Prospect, ProspectHistoryEntry, ProspectStatus, SearchLead } from '@/types/prospect'

const PAGE_SIZE = 30

export type ProspectSort = 'updated_desc' | 'created_desc' | 'name_asc' | 'score_desc'

export interface ListProspectsParams {
  userId: string
  status?: ProspectStatus | 'all'
  favoritesOnly?: boolean
  search?: string
  sort?: ProspectSort
  page: number
}

export interface ListProspectsResult {
  rows: Prospect[]
  nextPage: number | null
}

export async function listProspects({
  userId, status = 'all', favoritesOnly = false, search = '', sort = 'updated_desc', page,
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

  const [column, ascending] = sortToOrder(sort)
  query = query.order(column, { ascending, nullsFirst: false })

  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data, error } = await query.range(from, to)
  if (error) throw error

  const rows = (data ?? []) as Prospect[]
  return { rows, nextPage: rows.length === PAGE_SIZE ? page + 1 : null }
}

function sortToOrder(sort: ProspectSort): [string, boolean] {
  switch (sort) {
    case 'created_desc': return ['created_at', false]
    case 'name_asc': return ['name', true]
    case 'score_desc': return ['score', false]
    default: return ['updated_at', false]
  }
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

export async function getProspectById(id: string): Promise<Prospect | null> {
  const { data, error } = await supabase.from('prospects').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function getProspectHistory(prospectId: string): Promise<ProspectHistoryEntry[]> {
  const { data, error } = await supabase
    .from('prospect_history')
    .select('*')
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ProspectHistoryEntry[]
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

// Called when a prospect card is opened during a search: persists it and
// marks it 'seen' — never downgrades a prospect that's already further along
// the pipeline (e.g. already 'contacted').
export async function markLeadSeen(userId: string, lead: SearchLead): Promise<Prospect> {
  const { data: existing, error: selectError } = await supabase
    .from('prospects')
    .select('id, status')
    .eq('user_id', userId)
    .eq('place_id', lead.placeId)
    .maybeSingle()
  if (selectError) throw selectError

  const fields = {
    name: lead.name,
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
      status: 'seen',
      ...fields,
    }).select().single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('prospects')
    .update({
      ...fields,
      ...(existing.status === 'new' ? { status: 'seen' } : {}),
    })
    .eq('id', existing.id)
    .select()
    .single()
  if (error) throw error
  return data
}
