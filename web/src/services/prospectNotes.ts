import { supabase } from '@/lib/supabaseClient'
import type { ProspectNote } from '@/types/prospect'

export async function listProspectNotes(prospectId: string): Promise<ProspectNote[]> {
  const { data, error } = await supabase
    .from('prospect_notes')
    .select('*')
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function addProspectNote(userId: string, prospectId: string, content: string): Promise<ProspectNote> {
  const { data, error } = await supabase
    .from('prospect_notes')
    .insert({ user_id: userId, prospect_id: prospectId, content })
    .select()
    .single()
  if (error) throw error
  return data
}
