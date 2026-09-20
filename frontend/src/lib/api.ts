import type { Dashboard, DataPoint, Envelope, Report, User } from './types'

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5001'

export interface ApiErrorDetail {
  field?: string
  message: string
}

/** Typed error mirroring the backend's `{ error: { code, message, details } }` shape. */
export class ApiError extends Error {
  status: number
  code: string
  details: ApiErrorDetail[]

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

/** Turns backend validation details (`body.email`) into `{ email: 'msg' }` for forms. */
export function fieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (err instanceof ApiError) {
    for (const d of err.details) {
      const key = (d.field ?? '').replace(/^(body|query|params)\./, '').replace(/^\d+\./, '')
      if (key && !out[key]) out[key] = d.message
    }
  }
  return out
}

export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Ocurrió un error inesperado'

// ---------------------------------------------------------------------------
// Session state. The ACCESS token lives only in memory; the REFRESH token is an
// httpOnly cookie the browser manages, so JavaScript can never read it.
// ---------------------------------------------------------------------------
let accessToken: string | null = null
let onSessionExpired: (() => void) | null = null

export const setSessionExpiredHandler = (fn: (() => void) | null) => {
  onSessionExpired = fn
}

async function doRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Token-Delivery': 'cookie' },
    })
    if (!res.ok) {
      accessToken = null
      return null
    }
    const json = (await res.json()) as Envelope<{ accessToken: string }>
    accessToken = json.data.accessToken
    return accessToken
  } catch {
    accessToken = null
    return null
  }
}

let inflightRefresh: Promise<string | null> | null = null

/**
 * Refresh tokens rotate and are single-use, so two concurrent refreshes would look like
 * token theft to the backend. Dedupe inside this tab (module-level promise, also covers
 * React StrictMode double effects) and across tabs (Web Locks).
 */
export function refreshSession(): Promise<string | null> {
  if (!inflightRefresh) {
    const run = () => doRefresh()
    const p = typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request('analytics-refresh', run) : run()
    inflightRefresh = p.finally(() => {
      inflightRefresh = null
    })
  }
  return inflightRefresh
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  /** false for login/register (no bearer token, no refresh-on-401). */
  auth?: boolean
}

async function send(path: string, opts: RequestOptions, token: string | null): Promise<Response> {
  const url = new URL(`${API_URL}${path}`)
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
  }
  const headers: Record<string, string> = { 'X-Token-Delivery': 'cookie' }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    return await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      credentials: 'include',
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor')
  }
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const json = (await res.json()) as { error?: { code?: string; message?: string; details?: ApiErrorDetail[] } }
    return new ApiError(res.status, json.error?.code ?? 'UNKNOWN', json.error?.message ?? res.statusText, json.error?.details)
  } catch {
    return new ApiError(res.status, 'UNKNOWN', res.statusText || 'Error del servidor')
  }
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const auth = opts.auth ?? true
  let res = await send(path, opts, auth ? accessToken : null)

  if (res.status === 401 && auth) {
    // Access token missing/expired: try to rotate via the cookie, then retry once.
    const token = await refreshSession()
    if (token) {
      res = await send(path, opts, token)
    } else {
      onSessionExpired?.()
    }
  }

  if (!res.ok) throw await toError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------
interface Session {
  user: User
  accessToken: string
}

export async function login(email: string, password: string): Promise<User> {
  const res = await request<Envelope<Session>>('/auth/login', { method: 'POST', body: { email, password }, auth: false })
  accessToken = res.data.accessToken
  return res.data.user
}

export async function register(email: string, password: string): Promise<User> {
  const res = await request<Envelope<Session>>('/auth/register', { method: 'POST', body: { email, password }, auth: false })
  accessToken = res.data.accessToken
  return res.data.user
}

export async function logout(): Promise<void> {
  try {
    await request<void>('/auth/logout', { method: 'POST', body: {}, auth: false })
  } finally {
    accessToken = null
  }
}

export async function fetchMe(): Promise<User> {
  return (await request<Envelope<{ user: User }>>('/auth/me')).data.user
}

export interface DashboardInput {
  name: string
  description?: string | null
  isPublic?: boolean
}

export const listDashboards = (q: { scope?: 'mine' | 'public'; page?: number; limit?: number }) =>
  request<Envelope<Dashboard[]>>('/dashboards', { query: q })

export const getDashboard = (id: string) => request<Envelope<Dashboard>>(`/dashboards/${id}`)

export const createDashboard = (body: DashboardInput) =>
  request<Envelope<Dashboard>>('/dashboards', { method: 'POST', body })

export const updateDashboard = (id: string, body: Partial<DashboardInput>) =>
  request<Envelope<Dashboard>>(`/dashboards/${id}`, { method: 'PUT', body })

export const deleteDashboard = (id: string) => request<void>(`/dashboards/${id}`, { method: 'DELETE' })

export const listDataPoints = (id: string, q: { page?: number; limit?: number; order?: 'asc' | 'desc' }) =>
  request<Envelope<DataPoint[]>>(`/dashboards/${id}/datapoints`, { query: q })

export const addDataPoint = (id: string, body: { label: string; value: number; timestamp?: string }) =>
  request<Envelope<DataPoint>>(`/dashboards/${id}/datapoints`, { method: 'POST', body })

export const listReports = (q: { page?: number; limit?: number }) => request<Envelope<Report[]>>('/reports', { query: q })

export const getReport = (id: string) => request<Envelope<Report>>(`/reports/${id}`)

export const createReport = (body: { name: string; dashboardId?: string; from?: string; to?: string }) =>
  request<Envelope<Report>>('/reports', { method: 'POST', body })
