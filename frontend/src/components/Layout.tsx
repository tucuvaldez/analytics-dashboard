import { Suspense } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Spinner } from './ui'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium ${
    isActive
      ? 'bg-stone-200 text-stone-900 dark:bg-stone-800 dark:text-white'
      : 'text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-900'
  }`

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/" className="text-base font-semibold tracking-tight">
            Analytics Dashboard
          </Link>
          <nav className="flex gap-1" aria-label="Principal">
            <NavLink to="/" end className={linkClass}>
              Dashboards
            </NavLink>
            <NavLink to="/reports" className={linkClass}>
              Reportes
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-stone-600 dark:text-stone-400" data-testid="user-email">
              {user?.email}
            </span>
            <button
              className="btn-secondary"
              onClick={async () => {
                await signOut()
                navigate('/login')
              }}
            >
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Lazy pages load inside the layout so the nav bar never disappears. */}
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
