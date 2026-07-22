import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/AuthProvider'
import {
  completeSession, createSession, getActiveSession, updateSessionProgress,
  type CreateSessionInput, type UpdateSessionInput,
} from '@/services/prospectingSession'

// Point 16: the active session (if any) is the single source of truth for
// resuming Explorer exactly where the user left off — fetched once per
// mount, never refetched in the background (its own mutations below keep it
// current, so there is nothing else that would invalidate it externally).
export function useActiveProspectingSession() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  return useQuery({
    queryKey: ['prospecting-session', userId],
    queryFn: () => getActiveSession(userId),
    enabled: !!userId,
    staleTime: Infinity,
    refetchOnMount: false,
  })
}

export function useCreateProspectingSession() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<CreateSessionInput, 'userId'>) => createSession({ ...input, userId: user!.id }),
    onSuccess: (session) => {
      queryClient.setQueryData(['prospecting-session', user?.id], session)
    },
  })
}

export function useUpdateProspectingSession() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSessionInput }) => updateSessionProgress(id, input),
  })
}

export function useCompleteProspectingSession() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => completeSession(id),
    onSuccess: () => {
      queryClient.setQueryData(['prospecting-session', user?.id], null)
    },
  })
}
