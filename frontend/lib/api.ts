import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import type { RefreshResponse } from './types'

// ─── Token storage helpers (inline to avoid circular import with auth.ts) ─────
// auth.ts is built in Step 3 — these thin helpers are duplicated intentionally
// so api.ts has no dependency on auth.ts.

function readAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('ds_access')
}

function writeAccessToken(token: string): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem('ds_access', token)
}

function readRefreshToken(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)ds_refresh=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

function clearTokens(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem('ds_access')
  sessionStorage.removeItem('ds_user')
  document.cookie = 'ds_refresh=; Max-Age=0; path=/'
  document.cookie = 'ds_role=; Max-Age=0; path=/'
  document.cookie = 'ds_must_change=; Max-Age=0; path=/'
}

/**
 * Persist everything a /auth/refresh response carries — not just the access
 * token. `ds_user` lives in sessionStorage (gone on tab close) while the refresh
 * cookie lasts 7 days, so a silent refresh that only saved the token left every
 * returning user without a name until a full re-login. Cookie flags mirror
 * lib/auth.ts (SameSite=Strict, Secure in production, ~1 day).
 */
export function applyRefreshedSession(data: RefreshResponse): void {
  if (typeof window === 'undefined') return

  writeAccessToken(data.accessToken)

  if (data.user) {
    sessionStorage.setItem(
      'ds_user',
      JSON.stringify({ name: data.user.name, email: data.user.email }),
    )
  }

  if (data.mustChangePass !== undefined) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    document.cookie = data.mustChangePass
      ? `ds_must_change=1; path=/; max-age=86400; SameSite=Strict${secure}`
      : 'ds_must_change=; Max-Age=0; path=/; SameSite=Strict'
  }
}

// ─── Axios instance ───────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
})

// ─── Request interceptor — attach access token ────────────────────────────────

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = readAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ─── Response interceptor — refresh on 401 ───────────────────────────────────

let isRefreshing = false
let pendingQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function flushQueue(token: string | null, err: unknown = null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token)
    else reject(err)
  })
  pendingQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean }

    // Only intercept 401s that haven't already been retried
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    // Don't intercept the refresh call itself
    if (original.url?.includes('/auth/refresh')) {
      clearTokens()
      if (typeof window !== 'undefined') window.location.href = '/login'
      return Promise.reject(error)
    }

    if (isRefreshing) {
      // Queue concurrent requests while refresh is in flight
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      }).then((newToken) => {
        original._retry = true
        if (!original.headers) original.headers = {}
        original.headers['Authorization'] = `Bearer ${newToken}`
        return api(original)
      })
    }

    original._retry = true
    isRefreshing = true

    const refreshToken = readRefreshToken()

    if (!refreshToken) {
      isRefreshing = false
      clearTokens()
      if (typeof window !== 'undefined') window.location.href = '/login'
      return Promise.reject(error)
    }

    try {
      const { data } = await axios.post<RefreshResponse>(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/auth/refresh`,
        { refreshToken },
      )

      applyRefreshedSession(data)
      flushQueue(data.accessToken)

      if (!original.headers) original.headers = {}
      original.headers['Authorization'] = `Bearer ${data.accessToken}`
      return api(original)
    } catch (refreshError) {
      flushQueue(null, refreshError)
      clearTokens()
      if (typeof window !== 'undefined') window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export default api
