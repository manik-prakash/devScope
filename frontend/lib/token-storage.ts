/**
 * The per-tab session values kept in `sessionStorage`: the access token and the
 * cached display identity. This module depends on nothing, so both `lib/auth.ts`
 * and `lib/api.ts` (and any component) can import it without a circular import.
 *
 * The refresh token is NOT here — it's an HttpOnly `ds_refresh` cookie the
 * backend owns and JS cannot read.
 */

const ACCESS_KEY = 'ds_access'
const USER_KEY = 'ds_user'

// ─── Access token ─────────────────────────────────────────────────────────────

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

// ─── Cached display identity ─────────────────────────────────────────────────
// The JWT carries only sub/orgId/role, so name/email are stashed separately for
// the sidebar/topnav to render immediately.

export interface StoredUser {
  name: string
  email: string
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as StoredUser) : null
  } catch {
    return null
  }
}

export function setStoredUser(user: StoredUser): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(USER_KEY, JSON.stringify({ name: user.name, email: user.email }))
}

export function clearStoredUser(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(USER_KEY)
}
