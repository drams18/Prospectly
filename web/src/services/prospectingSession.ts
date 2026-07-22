import { supabase } from '@/lib/supabaseClient'
import type { ProspectingSession, SearchLead } from '@/types/prospect'

export async function getActiveSession(userId: string): Promise<ProspectingSession | null> {
  const { data, error } = await supabase
    .from('prospecting_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  return data
}

export interface CreateSessionInput {
  userId: string
  coords: { lat: number; lng: number } | null
  categoryIds: string[]
  leads: SearchLead[]
  nextBandIndex: number
}

export async function createSession(input: CreateSessionInput): Promise<ProspectingSession> {
  const { data, error } = await supabase
    .from('prospecting_sessions')
    .insert({
      user_id: input.userId,
      coords: input.coords,
      category_ids: input.categoryIds,
      leads: input.leads,
      next_band_index: input.nextBandIndex,
      current_index: 0,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export interface UpdateSessionInput {
  leads?: SearchLead[]
  currentIndex?: number
  nextBandIndex?: number
  categoryIds?: string[]
}

export async function updateSessionProgress(id: string, input: UpdateSessionInput): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.leads !== undefined) patch.leads = input.leads
  if (input.currentIndex !== undefined) patch.current_index = input.currentIndex
  if (input.nextBandIndex !== undefined) patch.next_band_index = input.nextBandIndex
  if (input.categoryIds !== undefined) patch.category_ids = input.categoryIds
  const { error } = await supabase.from('prospecting_sessions').update(patch).eq('id', id)
  if (error) throw error
}

export async function completeSession(id: string): Promise<void> {
  const { error } = await supabase.from('prospecting_sessions').update({ status: 'completed' }).eq('id', id)
  if (error) throw error
}
