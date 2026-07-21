import { supabase } from '@/lib/supabaseClient'
import type { Prospect, ProspectStatus, SearchLead } from '@/types/prospect'

const PAGE_SIZE = 30

export interface ListProspectsParams {
  userId: string
  status?: ProspectStatus | 'all'
  favoritesOnly?: boolean
  search?: string
  page: number
  orderBy?: 'updated_at' | 'last_seen_at'
}

export interface ListProspectsResult {
  rows: Prospect[]
  nextPage: number | null
}

// Point 8: the Historique page reuses this with orderBy: 'last_seen_at' to
// surface the most recently (re)consulted prospects first, regardless of
// status — it lists every row ever seen, not just the CRM-curated ones.
export async function listProspects({
  userId, status = 'all', favoritesOnly = false, search = '', page, orderBy = 'updated_at',
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

  query = query.order(orderBy, { ascending: false, nullsFirst: false })

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

// Point 10: "Remettre dans le feed" — un prospect restauré redevient
// éligible au feed (is_seen=false) sans perdre son historique/statut/notes.
export async function restoreProspect(id: string): Promise<void> {
  const { error } = await supabase.from('prospects').update({ is_seen: false }).eq('id', id)
  if (error) throw error
}

// Fetches the current user's *currently hidden* prospects (is_seen=true)
// among a batch of Google place_ids — used to exclude already-seen or
// already-processed businesses from fresh search results. A restored
// prospect (is_seen=false) is deliberately absent so it can reappear.
export async function fetchKnownStatuses(userId: string, placeIds: string[]): Promise<Map<string, ProspectStatus>> {
  if (!placeIds.length) return new Map()
  const { data, error } = await supabase
    .from('prospects')
    .select('place_id, status')
    .eq('user_id', userId)
    .eq('is_seen', true)
    .in('place_id', placeIds)
  if (error) throw error

  const map = new Map<string, ProspectStatus>()
  for (const row of data ?? []) {
    if (row.place_id) map.set(row.place_id, row.status as ProspectStatus)
  }
  return map
}

function leadToProspectFields(lead: SearchLead) {
  return {
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
    photos: lead.photos ?? null,
    opening_hours: lead.openingHours ?? null,
  }
}

// Point 7 + 11: every lead the user is actually shown (feed card displayed,
// or explicit "Sauvegarder") gets upserted here — unique on (user_id,
// place_id), so re-encountering the same business updates the existing row
// instead of duplicating it. is_seen/last_seen_at are always refreshed;
// first_seen_at/status are only set on the very first insert, so an
// already-processed prospect never loses the status the user gave it.
async function upsertSeenProspect(userId: string, lead: SearchLead): Promise<Prospect> {
  const { data: existing, error: selectError } = await supabase
    .from('prospects')
    .select('id')
    .eq('user_id', userId)
    .eq('place_id', lead.placeId)
    .maybeSingle()
  if (selectError) throw selectError

  const fields = leadToProspectFields(lead)
  const now = new Date().toISOString()

  if (!existing) {
    const { data, error } = await supabase.from('prospects').insert({
      user_id: userId,
      place_id: lead.placeId,
      status: 'to_contact',
      is_seen: true,
      first_seen_at: now,
      last_seen_at: now,
      ...fields,
    }).select().single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('prospects')
    .update({ ...fields, is_seen: true, last_seen_at: now })
    .eq('id', existing.id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Explicit "Sauvegarder" action from the feed/search results.
export const saveLead = upsertSeenProspect

// Called as soon as a lead is displayed to the user (current feed card) —
// this is what makes a prospect never reappear, independent of whether the
// user explicitly saves it.
export const markProspectSeen = upsertSeenProspect
