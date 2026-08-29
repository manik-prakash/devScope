'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { getAccessToken, clearAllTokens, decodeJwt } from '@/lib/auth'
import { initials } from '@/lib/utils'
import { Logo } from '@/components/shared'
import api from '@/lib/api'

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV = [
  { href: '/me',          label: 'My Stats', exact: true  },
  { href: '/me/sessions', label: 'Sessions', exact: false },
  { href: '/me/api-keys', label: 'API Keys', exact: false },
  { href: '/me/settings', label: 'Settings', exact: false },
]

// ─── Nav tab ──────────────────────────────────────────────────────────────────

interface NavTabProps {
  href:  string
  label: string
  exact: boolean
}

function NavTab({ href, label, exact }: NavTabProps) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className="rounded-full px-4 py-1 text-sm font-medium transition-colors duration-150"
      style={{
        background: isActive ? 'var(--accent-dim)' : 'transparent',
        color:      isActive ? 'var(--text)'        : 'var(--text-muted)',
        border:     isActive ? '1px solid rgba(37,99,235,0.25)' : '1px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.color = 'var(--text)'
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'
      }}
    >
      {label}
    </Link>
  )
}

// ─── Topnav ───────────────────────────────────────────────────────────────────

interface UserInfo {
  name:  string
  email: string
}

export function Topnav() {
  const router      = useRouter()
  const [user, setUser]           = useState<UserInfo | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('ds_user')
    if (stored) {
      try {
        setUser(JSON.parse(stored) as UserInfo)
        return
      } catch { /* ignore */ }
    }
    const token = getAccessToken()
    if (!token) return
    const payload = decodeJwt(token)
    if (payload) setUser({ name: 'Developer', email: '' })
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
    <header
      className="sticky top-0 z-30 border-b"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      <div className="mx-auto flex h-14 max-w-[960px] items-center justify-between px-4">
        {/* Logo */}
        <Link
          href="/me"
          className="transition-opacity duration-150 hover:opacity-80"
          style={{ color: 'var(--text)' }}
        >
          <Logo size={22} />
        </Link>

        {/* Center nav */}
        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <NavTab key={item.href} {...item} />
          ))}
        </nav>

        {/* Right: user + logout */}
        <div className="flex items-center gap-3">
          {user && (
            <>
              {/* Avatar + name */}
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                >
                  {initials(user.name)}
                </div>
                <span className="hidden text-sm sm:block" style={{ color: 'var(--text-muted)' }}>
                  {user.name}
                </span>
              </div>

              {/* Separator */}
              <div className="h-4 w-px" style={{ background: 'var(--border)' }} />
            </>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 text-sm transition-colors duration-150 disabled:opacity-40"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--danger)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-faint)'
            }}
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}
