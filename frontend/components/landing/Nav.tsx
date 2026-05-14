'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/shared'

// ─── Mega-menu data ───────────────────────────────────────────────────────────

interface MegaColumn {
  heading: string
  items:   { label: string; href: string; desc?: string }[]
}

const FEATURES_MENU: MegaColumn[] = [
  {
    heading: 'Capture',
    items: [
      { label: 'Session recording',  href: '#features', desc: 'Capture prompts and tool calls locally' },
      { label: 'Multi-agent',        href: '#features', desc: 'Claude, Codex, Cursor, Copilot' },
    ],
  },
  {
    heading: 'Evaluate',
    items: [
      { label: 'Quality scoring', href: '#features', desc: 'Per-session scores 0–100' },
      { label: 'Feedback',        href: '#features', desc: 'Strengths and improvements' },
    ],
  },
  {
    heading: 'Visualize',
    items: [
      { label: 'Manager dashboard',   href: '#features', desc: 'Team-wide rollups' },
      { label: 'Developer dashboard', href: '#features', desc: 'Your personal stats' },
    ],
  },
]

// ─── Mega panel ───────────────────────────────────────────────────────────────

function MegaPanel({ open }: { open: boolean }) {
  return (
    <div
      className="absolute left-0 right-0 top-full transition-all duration-150"
      style={{
        opacity:       open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        transform:     open ? 'translateY(0)' : 'translateY(-4px)',
      }}
    >
      <div
        className="border-b shadow-xl"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-8 py-10 sm:grid-cols-3">
          {FEATURES_MENU.map((col) => (
            <div key={col.heading}>
              <h3
                className="mb-3 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-faint)' }}
              >
                {col.heading}
              </h3>
              <ul className="space-y-3">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="block transition-colors duration-150"
                    >
                      <span className="block text-sm font-medium" style={{ color: 'var(--text)' }}>
                        {item.label}
                      </span>
                      {item.desc && (
                        <span className="mt-0.5 block text-xs" style={{ color: 'var(--text-muted)' }}>
                          {item.desc}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Nav link ─────────────────────────────────────────────────────────────────

interface NavLinkProps {
  href:     string
  children: React.ReactNode
}

function NavLink({ href, children }: NavLinkProps) {
  return (
    <Link
      href={href}
      className="text-sm transition-colors duration-150"
      style={{ color: 'var(--text-muted)' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
    >
      {children}
    </Link>
  )
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

export function Nav() {
  const [megaOpen, setMegaOpen] = useState(false)

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{
        background:  'rgba(12, 12, 12, 0.85)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <Link
          href="/"
          className="transition-opacity duration-150 hover:opacity-80"
          style={{ color: 'var(--text)' }}
        >
          <Logo size={22} />
        </Link>

        {/* Center links */}
        <nav className="hidden items-center gap-7 md:flex">
          <div
            className="relative"
            onMouseEnter={() => setMegaOpen(true)}
            onMouseLeave={() => setMegaOpen(false)}
          >
            <button
              className="flex items-center text-sm transition-colors duration-150"
              style={{ color: megaOpen ? 'var(--text)' : 'var(--text-muted)' }}
            >
              Features
            </button>
          </div>
          <NavLink href="/#how">    How it works </NavLink>
          <NavLink href="/#pricing">Pricing      </NavLink>
          <NavLink href="/docs">    Docs         </NavLink>
        </nav>

        {/* Right CTAs */}
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm transition-colors duration-150"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-full px-4 py-1.5 text-sm font-medium text-white transition-colors duration-150"
            style={{ background: 'var(--accent)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
          >
            Get started
          </Link>
        </div>
      </div>

      {/* Mega-menu — sits below the bar */}
      <div
        onMouseEnter={() => setMegaOpen(true)}
        onMouseLeave={() => setMegaOpen(false)}
      >
        <MegaPanel open={megaOpen} />
      </div>
    </header>
  )
}
