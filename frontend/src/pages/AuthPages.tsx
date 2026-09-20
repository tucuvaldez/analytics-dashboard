import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ErrorBanner, FieldError } from '../components/ui'
import { errorMessage, fieldErrors } from '../lib/api'

function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">Analytics Dashboard</h1>
        <p className="mb-5 text-sm text-stone-600 dark:text-stone-400">{title}</p>
        {children}
        <p className="mt-5 text-center text-sm text-stone-600 dark:text-stone-400">{footer}</p>
      </div>
    </div>
  )
}

function useAuthForm(mode: 'login' | 'register') {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setErrors({})
    try {
      await (mode === 'login' ? signIn : signUp)(email, password)
      navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setErrors(fieldErrors(err))
      setBusy(false)
    }
  }

  return { email, setEmail, password, setPassword, busy, error, errors, submit }
}

export function LoginPage() {
  const f = useAuthForm('login')
  return (
    <AuthShell
      title="Iniciá sesión para ver tus dashboards"
      footer={
        <>
          ¿No tenés cuenta?{' '}
          <Link to="/register" className="font-medium text-blue-700 hover:underline dark:text-blue-400">
            Registrate
          </Link>
        </>
      }
    >
      <form onSubmit={f.submit} className="space-y-4">
        <ErrorBanner message={f.error} />
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" type="email" className="input" autoComplete="email" value={f.email} onChange={(e) => f.setEmail(e.target.value)} required />
          <FieldError message={f.errors.email} />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            className="input"
            autoComplete="current-password"
            value={f.password}
            onChange={(e) => f.setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={f.busy}>
          {f.busy ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </AuthShell>
  )
}

export function RegisterPage() {
  const f = useAuthForm('register')
  return (
    <AuthShell
      title="Creá tu cuenta"
      footer={
        <>
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="font-medium text-blue-700 hover:underline dark:text-blue-400">
            Iniciá sesión
          </Link>
        </>
      }
    >
      <form onSubmit={f.submit} className="space-y-4">
        <ErrorBanner message={f.error} />
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" type="email" className="input" autoComplete="email" value={f.email} onChange={(e) => f.setEmail(e.target.value)} required />
          <FieldError message={f.errors.email} />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            className="input"
            autoComplete="new-password"
            value={f.password}
            onChange={(e) => f.setPassword(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">Mínimo 8 caracteres, con mayúscula, minúscula y número.</p>
          <FieldError message={f.errors.password} />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={f.busy}>
          {f.busy ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
    </AuthShell>
  )
}
