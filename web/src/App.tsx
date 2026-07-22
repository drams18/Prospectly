import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { IosInstallBanner, NotificationPermissionBanner } from '@/components/NotificationPermissionBanner'
import { NavBar } from '@/components/NavBar'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuth } from '@/lib/AuthProvider'
import HistoriquePage from '@/pages/HistoriquePage'
import LoginPage from '@/pages/LoginPage'
import ProfilePage from '@/pages/ProfilePage'
import ProspectsPage from '@/pages/ProspectsPage'
import RegisterPage from '@/pages/RegisterPage'
import RemindersPage from '@/pages/RemindersPage'
import SearchPage from '@/pages/SearchPage'

function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <NavBar />
      <IosInstallBanner />
      <NotificationPermissionBanner />
      {children}
    </>
  )
}

export default function App() {
  const { loading } = useAuth()
  if (loading) return <div className="flex min-h-screen items-center justify-center text-text-muted">Chargement…</div>

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route path="/" element={<ProtectedRoute><AppShell><SearchPage /></AppShell></ProtectedRoute>} />
      <Route path="/prospects" element={<ProtectedRoute><AppShell><ProspectsPage /></AppShell></ProtectedRoute>} />
      <Route path="/prospects/:id" element={<ProtectedRoute><AppShell><ProspectsPage /></AppShell></ProtectedRoute>} />
      <Route path="/historique" element={<ProtectedRoute><AppShell><HistoriquePage /></AppShell></ProtectedRoute>} />
      <Route path="/rappels" element={<ProtectedRoute><AppShell><RemindersPage /></AppShell></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><AppShell><ProfilePage /></AppShell></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
