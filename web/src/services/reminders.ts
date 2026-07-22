import { supabase } from '@/lib/supabaseClient'
import type { Reminder, ReminderType, ReminderWithProspect } from '@/types/prospect'

export async function listRemindersForProspect(prospectId: string): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('prospect_id', prospectId)
    .order('remind_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Feeds the dashboard/calendar view (Rappels page): every pending reminder
// for the user, joined with the prospect's name so each row is a single
// query rather than N+1 lookups.
export async function listUpcomingReminders(userId: string): Promise<ReminderWithProspect[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*, prospects(name)')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('remind_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => {
    const { prospects, ...reminder } = row as Reminder & { prospects: { name: string } | null }
    return { ...reminder, prospect_name: prospects?.name ?? '' }
  })
}

export interface CreateReminderInput {
  userId: string
  prospectId: string
  remindAt: string
  title: string
  comment: string | null
  type?: ReminderType
}

export async function createReminder(input: CreateReminderInput): Promise<Reminder> {
  const { data, error } = await supabase
    .from('reminders')
    .insert({
      user_id: input.userId,
      prospect_id: input.prospectId,
      remind_at: input.remindAt,
      title: input.title,
      comment: input.comment,
      type: input.type ?? 'call',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export interface UpdateReminderInput {
  remindAt?: string
  title?: string
  comment?: string | null
}

export async function updateReminder(id: string, input: UpdateReminderInput): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.remindAt !== undefined) patch.remind_at = input.remindAt
  if (input.title !== undefined) patch.title = input.title
  if (input.comment !== undefined) patch.comment = input.comment
  const { error } = await supabase.from('reminders').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteReminder(id: string): Promise<void> {
  const { error } = await supabase.from('reminders').delete().eq('id', id)
  if (error) throw error
}

export async function completeReminder(id: string): Promise<void> {
  const { error } = await supabase
    .from('reminders')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// "Reporter" — push the reminder to a new time and clear notified_at so it
// can fire its own notification again instead of being silently skipped.
export async function snoozeReminder(id: string, newRemindAt: string): Promise<void> {
  const { error } = await supabase
    .from('reminders')
    .update({ remind_at: newRemindAt, notified_at: null })
    .eq('id', id)
  if (error) throw error
}

export async function duplicateReminder(reminder: Reminder): Promise<Reminder> {
  const { data, error } = await supabase
    .from('reminders')
    .insert({
      user_id: reminder.user_id,
      prospect_id: reminder.prospect_id,
      remind_at: reminder.remind_at,
      title: reminder.title,
      comment: reminder.comment,
      type: reminder.type,
    })
    .select()
    .single()
  if (error) throw error
  return data
}
