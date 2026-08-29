'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Activity,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { getAccessToken, clearAllTokens, decodeJwt } from '@/lib/auth'
import { initials } from '@/lib/utils'
import { Logo } from '@/components/shared'
import api from '@/lib/api'

// ─── Role pill ────────────────────────────────────────────────────────────────

function RolePill({ role }: { role?: string }) {
  if (!role) return null
  const isAdmin = role === 'ADMIN'
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
      style={{
        background: isAdmin ? 'rgba(217,119,6,0.12)'  : 'var(--accent-dim)',
        color:      isAdmin ? '#FCD34D'               : 'var(--accent)',
        border:     isAdmin ? '1px solid rgba(217,119,6,0.25)' : '1px solid rgba(37,99,235,0.2)',
      }}
    >
      {isAdmin ? 'Admin' : 'Manager'}
    </span>
  )
}

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV = [
  { href: '/dashboard',          icon: LayoutDashboard, label: 'Overview',  exact: true },
  { href: '/dashboard/projects', icon: FolderOpen,      label: 'Projects',  exact: false },
  { href: '/dashboard/team',     icon: Users,           label: 'Team',      exact: false },
  { href: '/dashboard/sessions', icon: Activity,        label: 'Sessions',  exact: false },
  { href: '/dashboard/settings', icon: Settings,        label: 'Settings',  exact: false },
]

// ─── Nav item ─────────────────────────────────────────────────────────────────

interface NavItemProps {
  href:  string
  icon:  React.ComponentType<{ size?: number }>
  label: string
  exact?: boolean
}

function NavItem({ href, icon: Icon, label, exact = false }: NavItemProps) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className="flex h-9 items-center gap-2.5 rounded-sm px-3 text-sm font-medium transition-colors duration-150"
      style={{
        background:   isActive ? 'var(--accent-dim)' : 'transparent',
        color:        isActive ? 'var(--text)'        : 'var(--text-muted)',
        borderLeft:   isActive ? '2px solid var(--accent)' : '2px solid transparent',
        paddingLeft:  isActive ? '10px' : '12px',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--surface-2)'
          e.currentTarget.style.color      = 'var(--text)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color      = 'var(--text-muted)'
        }
      }}
    >
      <Icon size={15} />
      {label}
    </Link>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface UserInfo {
  name:  string
  email: string
  role:  string
}

export function Sidebar() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  // Derive user info from the access token stored in sessionStorage
  useEffect(() => {
    const token = getAccessToken()
    if (!token) return
    const payload = decodeJwt(token)
    if (!payload) return
    // The JWT only has sub/orgId/role — fetch name from a cached source if available
    // For now we display what we have; Step 8 will populate name via /manager/org
    const stored = sessionStorage.getItem('ds_user')
    if (stored) {
      try { setUser(JSON.parse(stored) as UserInfo) } catch { /* ignore */ }
    } else {
      setUser({ name: 'Manager', email: '', role: payload.role })
    }
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    try {
      // The HttpOnly ds_refresh cookie is sent automatically; the server revokes + clears it.
      await api.post('/auth/logout')
    } catch { /* best-effort */ } finally {
      clearAllTokens()
      sessionStorage.removeItem('ds_user')
      router.push('/login')
    }
  }

  return (
    <aside
      className="flex h-screen w-[220px] shrink-0 flex-col border-r"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Logo + role pill */}
      <div className="flex h-14 items-center gap-2.5 border-b px-4" style={{ borderColor: 'var(--border)' }}>
        <Logo size={22} />
        <RolePill role={user?.role} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      {/* User + logout */}
      <div className="border-t px-3 py-4" style={{ borderColor: 'var(--border)' }}>
        {user && (
          <div className="mb-3 flex items-center gap-2.5 px-1">
            {/* Avatar */}
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
            >
              {initials(user.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium" style={{ color: 'var(--text)' }}>
                {user.name}
              </p>
              {user.email && (
                <p className="truncate text-[11px]" style={{ color: 'var(--text-faint)' }}>
                  {user.email}
                </p>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex h-9 w-full items-center gap-2.5 rounded-sm px-3 text-sm transition-colors duration-150 disabled:opacity-40"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface-2)'
            e.currentTarget.style.color      = 'var(--danger)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color      = 'var(--text-muted)'
          }}
        >
          <LogOut size={15} />
          {loggingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </aside>
  )
}
