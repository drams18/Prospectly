import { NavLink } from 'react-router-dom'
import { useAuth } from '@/lib/AuthProvider'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useProspectCounts } from '@/hooks/useProspects'
import { GlobalSearchBar } from './GlobalSearchBar'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-app px-3 py-2 text-sm font-medium ${isActive ? 'bg-primary-light text-primary' : 'text-text-secondary hover:bg-bg'}`

export function NavBar() {
  const { user, signOut } = useAuth()
  const { data: counts } = useProspectCounts()
  const seenCount = counts?.seen ?? 0

  useHotkeys({
    '/': (e) => {
      e.preventDefault()
      document.getElementById('global-search-input')?.focus()
    },
  }, [])

  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <span className="mr-2 text-lg font-semibold text-primary">Prospectly</span>

        <NavLink to="/" className={linkClass} end>Explorer</NavLink>
        <NavLink to="/prospects" className={linkClass}>Mon Parcours</NavLink>
        <NavLink to="/deja-vus" className={linkClass}>
          Déjà vus{seenCount > 0 ? ` (${seenCount})` : ''}
        </NavLink>
        <NavLink to="/scripts" className={linkClass}>Scripts</NavLink>

        <div className="ml-auto flex items-center gap-3">
          <GlobalSearchBar />
          <NavLink to="/profile" className={linkClass}>{user?.email}</NavLink>
          <button
            onClick={() => signOut()}
            className="rounded-app border border-border-strong px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg"
          >
            Déconnexion
          </button>
        </div>
      </div>
    </nav>
  )
}
