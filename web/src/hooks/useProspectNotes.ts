import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/AuthProvider'
import { addProspectNote, listProspectNotes } from '@/services/prospectNotes'

export function useProspectNotes(prospectId: string) {
  return useQuery({
    queryKey: ['prospect-notes', prospectId],
    queryFn: () => listProspectNotes(prospectId),
    enabled: !!prospectId,
  })
}

export function useAddProspectNote(prospectId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => addProspectNote(user!.id, prospectId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospect-notes', prospectId] })
    },
  })
}
