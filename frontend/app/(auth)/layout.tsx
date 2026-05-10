import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-dot-grid px-4"
      style={{ background: 'var(--bg)' }}
    >
      {children}
    </main>
  )
}
