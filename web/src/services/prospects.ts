import { supabase } from '@/lib/supabaseClient'
import type { Prospect, ProspectStatus, SearchLead } from '@/types/prospect'

const PAGE_SIZE = 30

export interface ListProspectsParams {
  userId: string
  status?: ProspectStatus | 'all'
  favoritesOnly?: boolean
  validatedOnly?: boolean
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
// "Mes Prospects" passes validatedOnly: true so it only shows what the user
// explicitly validated (✚), not every card that merely passed through the feed.
export async function listProspects({
  userId, status = 'all', favoritesOnly = false, validatedOnly = false, search = '', page, orderBy = 'updated_at',
}: ListProspectsParams): Promise<ListProspectsResult> {
  let query = supabase.from('prospects').select('*').eq('user_id', userId)

  if (status !== 'all') query = query.eq('status', status)
  if (favoritesOnly) query = query.eq('is_favorite', true)
  if (validatedOnly) query = query.eq('is_validated', true)
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

// Counts feed "Mes Prospects" tab badges, so only validated prospects count.
export async function getProspectCounts(userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('prospects')
    .select('status')
    .eq('user_id', userId)
    .eq('is_validated', true)
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
// or explicit "Sauvegarder"/valider) gets upserted here — unique on
// (user_id, place_id), so re-encountering the same business updates the
// existing row instead of duplicating it. is_seen/last_seen_at are always
// refreshed; first_seen_at/status are only set on the very first insert, so
// an already-processed prospect never loses the status the user gave it.
//
// `validate` distinguishes the two outcomes the user asked for: a passively
// seen card (skip / just displayed) never sets is_validated, so it only
// ever shows up in Historique. The explicit "valider" action sets
// is_validated=true, which is what makes it appear in "Mes Prospects". Once
// validated, re-encountering the same lead must never un-validate it — the
// update branch only ever sets is_validated to true, never resets it.
async function upsertProspect(userId: string, lead: SearchLead, validate: boolean): Promise<Prospect> {
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
      is_validated: validate,
      first_seen_at: now,
      last_seen_at: now,
      ...fields,
    }).select().single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('prospects')
    .update({ ...fields, is_seen: true, last_seen_at: now, ...(validate ? { is_validated: true } : {}) })
    .eq('id', existing.id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Explicit "Sauvegarder"/valider action from the feed/search results — the
// only path that makes a prospect appear in "Mes Prospects".
export function saveLead(userId: string, lead: SearchLead): Promise<Prospect> {
  return upsertProspect(userId, lead, true)
}

// Called as soon as a lead is displayed to the user (current feed card, or
// explicitly skipped with ✕) — persists it into Historique only, without
// touching is_validated, so it never appears in "Mes Prospects" unless the
// user separately validates it.
export function markProspectSeen(userId: string, lead: SearchLead): Promise<Prospect> {
  return upsertProspect(userId, lead, false)
}
