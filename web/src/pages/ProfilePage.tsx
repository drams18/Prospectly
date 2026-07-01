import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmModal } from '@/components/ConfirmModal'
import { useAuth } from '@/lib/AuthProvider'
import { useQuery } from '@tanstack/react-query'
import { deleteAccount, getProfile, updatePassword, updateStartAddress } from '@/services/profile'
import { clearSearchHistory } from '@/services/searchHistory'

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: profile, refetch } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
  })

  const [startAddress, setStartAddress] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [confirmAction, setConfirmAction] = useState<'clearHistory' | 'deleteAccount' | null>(null)

  useEffect(() => {
    if (profile?.start_address) setStartAddress(profile.start_address)
  }, [profile?.start_address])

  async function onAddressSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    try {
      await updateStartAddress(user.id, startAddress.trim())
      await refetch()
      setStatus({ type: 'success', message: 'Adresse mise à jour.' })
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Erreur' })
    }
  }

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      setStatus({ type: 'error', message: 'Le mot de passe doit faire au moins 6 caractères' })
      return
    }
    try {
      await updatePassword(newPassword)
      setNewPassword('')
      setStatus({ type: 'success', message: 'Mot de passe mis à jour.' })
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Erreur' })
    }
  }

  async function runConfirmedAction() {
    const action = confirmAction
    setConfirmAction(null)
    if (!user || !action) return

    try {
      if (action === 'clearHistory') {
        await clearSearchHistory(user.id)
        setStatus({ type: 'success', message: 'Historique de recherche supprimé.' })
      } else if (action === 'deleteAccount') {
        await deleteAccount()
        await signOut()
        navigate('/login', { replace: true })
      }
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Erreur' })
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-semibold text-text">Profil</h1>
      <p className="mt-1 text-sm text-text-secondary">{user?.email}</p>

      {status && (
        <p className={`mt-4 rounded-app px-3 py-2 text-sm ${status.type === 'success' ? 'bg-success-bg text-success-text' : 'bg-danger-bg text-danger-text'}`}>
          {status.message}
        </p>
      )}

      <form onSubmit={onAddressSubmit} className="mt-6 rounded-app-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-text">Adresse de départ</h2>
        <p className="mt-1 text-xs text-text-muted">Utilisée comme référence pour trier votre parcours par distance.</p>
        <input
          value={startAddress} onChange={(e) => setStartAddress(e.target.value)}
          className="mt-3 w-full rounded-app border border-border-strong px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <button type="submit" className="mt-3 rounded-app bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
          Enregistrer
        </button>
      </form>

      <form onSubmit={onPasswordSubmit} className="mt-4 rounded-app-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-text">Changer le mot de passe</h2>
        <input
          type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Nouveau mot de passe"
          className="mt-3 w-full rounded-app border border-border-strong px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <button type="submit" className="mt-3 rounded-app bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
          Mettre à jour
        </button>
      </form>

      <div className="mt-4 rounded-app-lg border border-danger-bg bg-surface p-5">
        <h2 className="text-sm font-semibold text-danger-text">Zone de danger</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            onClick={() => setConfirmAction('clearHistory')}
            className="rounded-app border border-border-strong px-3 py-2 text-sm text-text-secondary hover:bg-bg"
          >
            Supprimer l'historique de recherche
          </button>
          <button
            onClick={() => setConfirmAction('deleteAccount')}
            className="rounded-app bg-danger-text px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Supprimer mon compte
          </button>
        </div>
      </div>

      <ConfirmModal
        open={!!confirmAction}
        title={confirmAction === 'deleteAccount' ? 'Supprimer votre compte ?' : "Supprimer l'historique ?"}
        message={
          confirmAction === 'deleteAccount'
            ? 'Cette action est IRRÉVERSIBLE et supprime votre compte, tous vos prospects et leur historique.'
            : 'Cette action est irréversible.'
        }
        critical={confirmAction === 'deleteAccount'}
        onConfirm={runConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
