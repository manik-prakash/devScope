import Link from 'next/link'
import { GitBranch } from 'lucide-react'
import { Logo } from '@/components/shared'

const GITHUB_URL = 'https://github.com/manik-prakash/devScope'

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'Features',     href: '#features' },
      { label: 'How it works', href: '#how'      },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Docs',       href: '/docs'                 },
      { label: 'CLI',        href: '/docs#cli-commands'    },
      { label: 'API',        href: '/docs#api'             },
      { label: 'Self-host',  href: '/docs#self-host'       },
    ],
  },
]

export function Footer() {
  return (
    <footer
      className="border-t"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-[1.3fr_1fr_1fr]">
          {/* Brand block */}
          <div>
            <Logo size={20} />
            <p className="mt-3 max-w-xs text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Analytics for how your team actually ships with AI agents.
            </p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-1.5 text-sm transition-colors duration-150"
              style={{ color: 'var(--text-muted)' }}
            >
              <GitBranch size={15} />
              GitHub
            </a>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3
                className="mb-3 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-faint)' }}
              >
                {col.heading}
              </h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm transition-colors duration-150"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-12 flex flex-col items-start justify-between gap-3 border-t pt-6 sm:flex-row sm:items-center"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
            © {new Date().getFullYear()} DevScope. All rights reserved.
          </span>
          <span className="font-mono text-xs" style={{ color: 'var(--text-faint)' }}>
            v0.1.0
          </span>
        </div>
      </div>
    </footer>
  )
}
