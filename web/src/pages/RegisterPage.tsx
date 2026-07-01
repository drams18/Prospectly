import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthProvider'
import { supabase } from '@/lib/supabaseClient'
import { updateStartAddress } from '@/services/profile'

export default function RegisterPage() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [startAddress, setStartAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setLoading(false)
      setError(error.message)
      return
    }

    if (data.user && startAddress.trim()) {
      try { await updateStartAddress(data.user.id, startAddress.trim()) } catch { /* profile row may not exist yet if email confirmation is pending */ }
    }

    setLoading(false)
    if (!data.session) {
      setInfo('Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse avant de vous connecter.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-app-lg bg-surface p-8 shadow-md">
        <h1 className="text-center text-2xl font-semibold text-primary">Prospectly</h1>
        <p className="mt-1 text-center text-sm text-text-secondary">Créer un compte</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-app border border-border-strong px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Mot de passe</label>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-app border border-border-strong px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Adresse de départ (optionnel)</label>
            <input
              value={startAddress} onChange={(e) => setStartAddress(e.target.value)}
              className="w-full rounded-app border border-border-strong px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-danger-text">{error}</p>}
          {info && <p className="text-sm text-success-text">{info}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full rounded-app bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          Déjà un compte ? <Link to="/login" className="text-primary">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
