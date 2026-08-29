import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import type { RefreshResponse } from './types'
import { getAccessToken, setAccessToken, clearAccessToken, setStoredUser, clearStoredUser } from './token-storage'

function clearTokens(): void {
  if (typeof window === 'undefined') return
  clearAccessToken()
  clearStoredUser()
  // ds_refresh is HttpOnly and backend-owned — the server clears it on
  // /auth/logout and on refresh-reuse detection. Only the client-set cookies
  // are ours to drop here.
  document.cookie = 'ds_role=; Max-Age=0; path=/'
  document.cookie = 'ds_must_change=; Max-Age=0; path=/'
}

/**
 * Persist what a /auth/refresh response carries — the access token plus display
 * identity (`ds_user` lives in sessionStorage and dies on tab close). The
 * refresh token itself is never in the body; it's the HttpOnly `ds_refresh`
 * cookie the backend rotated.
 */
export function applyRefreshedSession(data: RefreshResponse): void {
  if (typeof window === 'undefined') return

  setAccessToken(data.accessToken)
  if (data.user) setStoredUser(data.user)

  if (data.mustChangePass !== undefined) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    document.cookie = data.mustChangePass
      ? `ds_must_change=1; path=/; max-age=86400; SameSite=Strict${secure}`
      : 'ds_must_change=; Max-Age=0; path=/; SameSite=Strict'
  }
}

// ─── Axios instance ───────────────────────────────────────────────────────────

// Default to the same-origin path served by next.config.ts's rewrite, so the
// HttpOnly ds_refresh cookie is sent on every call. An explicit
// NEXT_PUBLIC_API_URL still wins for setups that talk to the backend directly.
const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 15_000,
})

// ─── Request interceptor — attach access token ────────────────────────────────

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken()
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

    try {
      // The HttpOnly ds_refresh cookie rides along via withCredentials — no body.
      const { data } = await axios.post<RefreshResponse>(
        `${api.defaults.baseURL}/auth/refresh`,
        {},
        { withCredentials: true },
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
