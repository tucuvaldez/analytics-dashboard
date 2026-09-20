import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Spinner } from './ui'

/** Renders child routes only for signed-in users; otherwise redirects to /login. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <Spinner className="min-h-screen" />
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** Login/register pages bounce signed-in users to the app. */
export function PublicOnly() {
  const { status } = useAuth()
  if (status === 'loading') return <Spinner className="min-h-screen" />
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}
