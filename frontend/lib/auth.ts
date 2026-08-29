import Cookies from 'js-cookie'
import type { JwtPayload, UserRole } from './types'
import {
  setAccessToken,
  clearAccessToken,
  setStoredUser,
  clearStoredUser,
} from './token-storage'

// ─── Cookie keys ─────────────────────────────────────────────────────────────

const ROLE_KEY         = 'ds_role'         // short-lived cookie — read by proxy.ts for route guards
const MUST_CHANGE_KEY  = 'ds_must_change'  // short-lived cookie — proxy redirects to /change-password when set
// ds_refresh is an HttpOnly cookie the backend sets/rotates/clears — never touched from JS.

// The sessionStorage accessors live in ./token-storage (no deps → no import cycle);
// re-export the reads so existing `@/lib/auth` imports keep working.
export { getAccessToken, getStoredUser } from './token-storage'

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
  clearStoredUser()
  clearRoleCookie()
  clearMustChangeCookie()
  // ds_refresh is HttpOnly — cleared server-side by POST /auth/logout.
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

// ─── Convenience: persist the session after login/register/refresh ────────────
// The refresh token is an HttpOnly cookie the backend set on the same response —
// nothing to do with it here.

export function persistAuthTokens(
  accessToken: string,
  mustChangePass: boolean = false,
  user?: { name: string; email: string },
): void {
  setAccessToken(accessToken)
  const payload = decodeJwt(accessToken)
  if (payload?.role) setRoleCookie(payload.role)
  if (mustChangePass) setMustChangeCookie()
  else clearMustChangeCookie()
  // The JWT carries only sub/orgId/role — persist the display identity separately
  // so the sidebar/topnav show a real name right after login. Left untouched when
  // absent (e.g. the silent token refresh in lib/api.ts).
  if (user) setStoredUser(user)
}
