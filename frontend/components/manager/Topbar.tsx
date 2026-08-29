'use client'

import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getAccessToken, getStoredUser, decodeJwt } from '@/lib/auth'
import { initials } from '@/lib/utils'

// ─── Derive page title from pathname ──────────────────────────────────────────

function getPageTitle(pathname: string): string {
  if (pathname === '/dashboard')          return 'Overview'
  if (pathname === '/dashboard/projects') return 'Projects'
  if (pathname.startsWith('/dashboard/projects/')) {
    const slug = pathname.replace('/dashboard/projects/', '').split('/')[0]
    return `Projects / ${slug}`
  }
  if (pathname === '/dashboard/team')     return 'Team'
  if (pathname.startsWith('/dashboard/team/')) return 'Team'
  if (pathname === '/dashboard/sessions') return 'Sessions'
  if (pathname === '/dashboard/settings') return 'Settings'
  return 'Dashboard'
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

export function Topbar() {
  const pathname = usePathname()
  const title    = getPageTitle(pathname)
  const [userInitials, setUserInitials] = useState('M')

  useEffect(() => {
    const u = getStoredUser()
    if (u) { setUserInitials(initials(u.name)); return }
    // Fallback: decode from token
    const token = getAccessToken()
    if (!token) return
    const payload = decodeJwt(token)
    if (payload) setUserInitials(payload.role === 'MANAGER' ? 'M' : 'D')
  }, [])

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between border-b px-8"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Page title */}
      <h2 className="text-sm font-medium" style={{ color: 'var(--text)' }}>
        {title}
      </h2>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded transition-colors duration-150"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface-2)'
            e.currentTarget.style.color      = 'var(--text)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color      = 'var(--text-muted)'
          }}
          aria-label="Notifications"
        >
          <Bell size={16} />
        </button>

        {/* Avatar */}
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
        >
          {userInitials}
        </div>
      </div>
    </header>
  )
}
