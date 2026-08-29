// ─── Duration ─────────────────────────────────────────────────────────────────

export function formatDuration(ms: number | string): string {
  const totalMs = typeof ms === 'string' ? parseInt(ms, 10) : ms
  if (isNaN(totalMs) || totalMs < 0) return '–'

  const totalSeconds = Math.floor(totalMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function formatDurationLong(ms: number | string): string {
  const totalMs = typeof ms === 'string' ? parseInt(ms, 10) : ms
  if (isNaN(totalMs) || totalMs < 0) return '–'

  const totalSeconds = Math.floor(totalMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (hours > 0 && minutes > 0) return `${hours} hr ${minutes} min`
  if (hours > 0) return `${hours} hr`
  if (minutes > 0) return `${minutes} min`
  return `< 1 min`
}

// ─── Relative time ────────────────────────────────────────────────────────────

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const diffSecs = Math.floor(diffMs / 1000)

  if (diffSecs < 60) return 'just now'
  if (diffSecs < 3600) {
    const m = Math.floor(diffSecs / 60)
    return `${m}m ago`
  }
  if (diffSecs < 86400) {
    const h = Math.floor(diffSecs / 3600)
    return `${h}h ago`
  }
  if (diffSecs < 86400 * 7) {
    const d = Math.floor(diffSecs / 86400)
    return `${d}d ago`
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Score ────────────────────────────────────────────────────────────────────

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '–'
  return Math.round(score).toString()
}

export type ScoreLevel = 'high' | 'mid' | 'low'

export function scoreLevel(score: number | null | undefined): ScoreLevel {
  if (score === null || score === undefined) return 'low'
  if (score >= 71) return 'high'
  if (score >= 41) return 'mid'
  return 'low'
}

export interface ScoreColors {
  bg: string
  text: string
  border: string
}

export function scoreColors(score: number | null | undefined): ScoreColors {
  const level = scoreLevel(score)
  switch (level) {
    case 'high':
      return {
        bg: 'rgba(22, 163, 74, 0.12)',
        text: '#86EFAC',
        border: 'rgba(22, 163, 74, 0.2)',
      }
    case 'mid':
      return {
        bg: 'rgba(217, 119, 6, 0.12)',
        text: '#FCD34D',
        border: 'rgba(217, 119, 6, 0.2)',
      }
    case 'low':
      return {
        bg: 'rgba(220, 38, 38, 0.12)',
        text: '#FCA5A5',
        border: 'rgba(220, 38, 38, 0.2)',
      }
  }
}

// ─── String helpers ───────────────────────────────────────────────────────────

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '…'
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

// ─── Array / stats helpers ────────────────────────────────────────────────────

export function average(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function mode<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined
  const freq = new Map<T, number>()
  for (const item of arr) freq.set(item, (freq.get(item) ?? 0) + 1)
  let best: T = arr[0]
  let bestCount = 0
  for (const [item, count] of freq) {
    if (count > bestCount) { best = item; bestCount = count }
  }
  return best
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// ─── Client-side list pagination ─────────────────────────────────────────────

export const SESSIONS_PAGE_SIZE = 20

// One correct implementation for the session screens: derive total pages,
// clamp the requested page into range (so a filter that shrinks the list can't
// strand the view past the end), and return that page's slice.
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number = SESSIONS_PAGE_SIZE,
): { totalPages: number; safePage: number; visible: T[] } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = clamp(Math.floor(page) || 1, 1, totalPages)
  const start = (safePage - 1) * pageSize
  return { totalPages, safePage, visible: items.slice(start, start + pageSize) }
}

// ─── Date window helpers ──────────────────────────────────────────────────────

export function startOfDayN(daysAgo: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(0, 0, 0, 0)
  return d
}

export function isWithinDays(date: Date | string, days: number): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  return d >= startOfDayN(days)
}

// ─── Role labels ─────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  DEVELOPER: 'Developer',
}

// Human label for a role. Falls back to "Developer" so an ADMIN is never
// mislabelled (the table previously special-cased only MANAGER).
export function roleLabel(role: string | undefined | null): string {
  return (role && ROLE_LABEL[role]) || 'Developer'
}

// ─── Redirect safety ─────────────────────────────────────────────────────────

// Returns `next` only if it is a same-origin path. Rejects protocol-relative
// (`//host`), backslash-tricked (`/\host`, which browsers normalise to `//host`),
// and absolute URLs — any of which would let `?next=` bounce the user off-site
// after login.
export function safeInternalPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/')) return null
  if (next.startsWith('//') || next.startsWith('/\\')) return null
  return next
}

// Generate an array of the last N day labels (e.g. ["Apr 18", "Apr 19" ...])
export function lastNDayLabels(n: number): string[] {
  const labels: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
  }
  return labels
}
