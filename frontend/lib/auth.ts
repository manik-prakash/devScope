import Cookies from 'js-cookie'
import type { JwtPayload, UserRole } from './types'

// ─── Cookie / storage keys ────────────────────────────────────────────────────

const ACCESS_KEY       = 'ds_access'       // sessionStorage — cleared on tab close
const REFRESH_KEY      = 'ds_refresh'      // 7-day cookie — survives tab close
const ROLE_KEY         = 'ds_role'         // short-lived cookie — read by proxy.ts for route guards
const MUST_CHANGE_KEY  = 'ds_must_change'  // short-lived cookie — proxy redirects to /change-password when set

// ─── Access token (sessionStorage) ───────────────────────────────────────────

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(ACCESS_KEY)
}

export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(ACCESS_KEY, token)
}

export function clearAccessToken(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(ACCESS_KEY)
}

// ─── Refresh token (cookie) ───────────────────────────────────────────────────

export function getRefreshToken(): string | null {
  return Cookies.get(REFRESH_KEY) ?? null
}

// js-cookie's `expires`: a Date (absolute) or a number of days. Prefer the
// server-supplied refresh-token expiry so the cookie can't outlive — or die
// before — the token the backend actually persisted.
export function refreshCookieExpiry(expiresAt?: string): Date | number {
  if (expiresAt) {
    const d = new Date(expiresAt)
    if (!Number.isNaN(d.getTime())) return d
  }
  return 7
}

export function setRefreshToken(token: string, expiresAt?: string): void {
  Cookies.set(REFRESH_KEY, token, {
    expires: refreshCookieExpiry(expiresAt),
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  })
}

export function clearRefreshToken(): void {
  Cookies.remove(REFRESH_KEY, { sameSite: 'strict' })
}

// ─── Role cookie (read by proxy.ts for server-side route guards) ──────────────

export function setRoleCookie(role: UserRole): void {
  Cookies.set(ROLE_KEY, role, {
    expires: 7,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  })
}

export function clearRoleCookie(): void {
  Cookies.remove(ROLE_KEY, { sameSite: 'strict' })
}

// ─── Must-change-password cookie (read by proxy.ts) ──────────────────────────

export function setMustChangeCookie(): void {
  Cookies.set(MUST_CHANGE_KEY, '1', {
    expires: 1,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  })
}

export function clearMustChangeCookie(): void {
  Cookies.remove(MUST_CHANGE_KEY, { sameSite: 'strict' })
}

// ─── Clear everything ─────────────────────────────────────────────────────────

export function clearAllTokens(): void {
  clearAccessToken()
  clearRefreshToken()
  clearRoleCookie()
  clearMustChangeCookie()
}

// ─── JWT decoding ─────────────────────────────────────────────────────────────

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // Base64url → Base64 → JSON
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(payload)
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

export function getUserFromToken(token: string): JwtPayload | null {
  const payload = decodeJwt(token)
  if (!payload) return null
  // Reject expired tokens
  if (payload.exp && payload.exp * 1000 < Date.now()) return null
  return payload
}

// ─── Convenience: store both tokens after login ───────────────────────────────

export function persistAuthTokens(
  accessToken: string,
  refreshToken: string,
  mustChangePass: boolean = false,
  user?: { name: string; email: string },
  refreshExpiresAt?: string,
): void {
  setAccessToken(accessToken)
  setRefreshToken(refreshToken, refreshExpiresAt)
  const payload = decodeJwt(accessToken)
  if (payload?.role) setRoleCookie(payload.role)
  if (mustChangePass) setMustChangeCookie()
  else clearMustChangeCookie()
  // The JWT carries only sub/orgId/role — persist the display identity separately
  // so the sidebar/topnav show a real name right after login. Left untouched when
  // absent (e.g. the silent token refresh in lib/api.ts).
  if (user && typeof window !== 'undefined') {
    sessionStorage.setItem('ds_user', JSON.stringify({ name: user.name, email: user.email }))
  }
}
