import { supabase } from '@/lib/supabaseClient'

export interface Profile {
  id: string
  start_address: string | null
  category_filters: string[]
  created_at: string
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

export async function updateStartAddress(userId: string, startAddress: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ start_address: startAddress }).eq('id', userId)
  if (error) throw error
}

export async function updateCategoryFilters(userId: string, categoryIds: string[]): Promise<void> {
  const { error } = await supabase.from('profiles').update({ category_filters: categoryIds }).eq('id', userId)
  if (error) throw error
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

export async function deleteAccount(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Session invalide')

  const { error } = await supabase.functions.invoke('delete-account', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (error) throw error
}
