import Link from 'next/link'

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'Features',     href: '#features' },
      { label: 'How it works', href: '#how'      },
      { label: 'Pricing',      href: '#pricing'  },
      { label: 'Changelog',    href: '/docs'     },
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
  {
    heading: 'Company',
    links: [
      { label: 'About',   href: '#'      },
      { label: 'Contact', href: '#'      },
      { label: 'GitHub',  href: '#'      },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '#' },
      { label: 'Terms',   href: '#' },
      { label: 'License', href: '#' },
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
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
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
