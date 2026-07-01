import { supabase } from '@/lib/supabaseClient'

export async function listSearchHistory(userId: string, limit = 10): Promise<string[]> {
  const { data, error } = await supabase
    .from('search_history')
    .select('location')
    .eq('user_id', userId)
    .order('searched_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(r => r.location as string)
}

export async function addSearchHistory(userId: string, location: string): Promise<void> {
  const { error } = await supabase.from('search_history').insert({ user_id: userId, location })
  if (error) throw error

  const { data: rows } = await supabase
    .from('search_history')
    .select('id')
    .eq('user_id', userId)
    .order('searched_at', { ascending: false })
  const staleIds = (rows ?? []).slice(10).map(r => r.id as string)
  if (staleIds.length) {
    await supabase.from('search_history').delete().in('id', staleIds)
  }
}

export async function removeSearchHistory(userId: string, location: string): Promise<void> {
  const { error } = await supabase.from('search_history').delete().eq('user_id', userId).eq('location', location)
  if (error) throw error
}

export async function clearSearchHistory(userId: string): Promise<void> {
  const { error } = await supabase.from('search_history').delete().eq('user_id', userId)
  if (error) throw error
}
