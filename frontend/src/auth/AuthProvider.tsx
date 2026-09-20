import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as api from '../lib/api'
import type { User } from '../lib/types'
import { AuthContext, type AuthState } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthState['status']>('loading')

  // Restore the session on page load: the httpOnly refresh cookie gives us a new access token.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await api.refreshSession()
      if (!token) return cancelled ? undefined : setStatus('anonymous')
      try {
        const me = await api.fetchMe()
        if (!cancelled) {
          setUser(me)
          setStatus('authenticated')
        }
      } catch {
        if (!cancelled) setStatus('anonymous')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // If a refresh fails mid-session (cookie expired/revoked), drop back to the login screen.
  useEffect(() => {
    api.setSessionExpiredHandler(() => {
      setUser(null)
      setStatus('anonymous')
    })
    return () => api.setSessionExpiredHandler(null)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setUser(await api.login(email, password))
    setStatus('authenticated')
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    setUser(await api.register(email, password))
    setStatus('authenticated')
  }, [])

  const signOut = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  const value = useMemo(() => ({ user, status, signIn, signUp, signOut }), [user, status, signIn, signUp, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
