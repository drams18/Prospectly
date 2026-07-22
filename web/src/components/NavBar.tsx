import { NavLink } from 'react-router-dom'
import { useAuth } from '@/lib/AuthProvider'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-app px-3 py-2 text-sm font-medium ${isActive ? 'bg-primary-light text-primary' : 'text-text-secondary hover:bg-bg'}`

export function NavBar() {
  const { signOut } = useAuth()

  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3">
        <span className="mr-2 text-lg font-semibold text-primary">Prospectly</span>

        <NavLink to="/" className={linkClass} end>Explorer</NavLink>
        <NavLink to="/prospects" className={linkClass}>Mes Prospects</NavLink>
        <NavLink to="/rappels" className={linkClass}>Rappels</NavLink>
        <NavLink to="/historique" className={linkClass}>Historique</NavLink>
        <NavLink to="/profile" className={linkClass}>Profil</NavLink>

        <div className="ml-auto flex items-center gap-3">
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
