import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/AuthProvider'
import {
  completeReminder, createReminder, deleteReminder, duplicateReminder,
  listRemindersForProspect, listUpcomingReminders, snoozeReminder, updateReminder,
  type CreateReminderInput, type UpdateReminderInput,
} from '@/services/reminders'
import type { Reminder } from '@/types/prospect'

export function useRemindersForProspect(prospectId: string) {
  return useQuery({
    queryKey: ['reminders', prospectId],
    queryFn: () => listRemindersForProspect(prospectId),
    enabled: !!prospectId,
  })
}

export function useUpcomingReminders() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  return useQuery({
    queryKey: ['reminders', 'upcoming', userId],
    queryFn: () => listUpcomingReminders(userId),
    enabled: !!userId,
  })
}

function useInvalidateReminders(prospectId?: string) {
  const queryClient = useQueryClient()
  return () => {
    if (prospectId) queryClient.invalidateQueries({ queryKey: ['reminders', prospectId] })
    queryClient.invalidateQueries({ queryKey: ['reminders', 'upcoming'] })
  }
}

export function useCreateReminder(prospectId: string) {
  const { user } = useAuth()
  const invalidate = useInvalidateReminders(prospectId)
  return useMutation({
    mutationFn: (input: Omit<CreateReminderInput, 'userId' | 'prospectId'>) =>
      createReminder({ ...input, userId: user!.id, prospectId }),
    onSuccess: invalidate,
  })
}

export function useUpdateReminder(prospectId: string) {
  const invalidate = useInvalidateReminders(prospectId)
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateReminderInput }) => updateReminder(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteReminder(prospectId: string) {
  const invalidate = useInvalidateReminders(prospectId)
  return useMutation({
    mutationFn: (id: string) => deleteReminder(id),
    onSuccess: invalidate,
  })
}

export function useCompleteReminder(prospectId: string) {
  const invalidate = useInvalidateReminders(prospectId)
  return useMutation({
    mutationFn: (id: string) => completeReminder(id),
    onSuccess: invalidate,
  })
}

export function useSnoozeReminder(prospectId: string) {
  const invalidate = useInvalidateReminders(prospectId)
  return useMutation({
    mutationFn: ({ id, newRemindAt }: { id: string; newRemindAt: string }) => snoozeReminder(id, newRemindAt),
    onSuccess: invalidate,
  })
}

export function useDuplicateReminder(prospectId: string) {
  const invalidate = useInvalidateReminders(prospectId)
  return useMutation({
    mutationFn: (reminder: Reminder) => duplicateReminder(reminder),
    onSuccess: invalidate,
  })
}
