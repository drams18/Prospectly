import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/AuthProvider'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="flex min-h-screen items-center justify-center text-text-muted">Chargement…</div>
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />

  return <>{children}</>
}
