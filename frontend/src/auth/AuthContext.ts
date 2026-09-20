import { createContext, useContext } from 'react'
import type { User } from '../lib/types'

export interface AuthState {
  user: User | null
  /** 'loading' only while the initial cookie-based session restore is running. */
  status: 'loading' | 'authenticated' | 'anonymous'
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
