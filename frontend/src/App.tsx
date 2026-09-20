import { lazy } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import Layout from './components/Layout'
import { PublicOnly, RequireAuth } from './components/RouteGuards'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import DashboardsPage from './pages/DashboardsPage'

// Pages with charts pull in Recharts (large): load them on demand.
const DashboardDetailPage = lazy(() => import('./pages/DashboardDetailPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <Link to="/" className="mt-4 inline-block text-blue-700 hover:underline dark:text-blue-400">
        Volver al inicio
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route index element={<DashboardsPage />} />
              <Route path="dashboards/:id" element={<DashboardDetailPage />} />
              <Route path="reports" element={<ReportsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
