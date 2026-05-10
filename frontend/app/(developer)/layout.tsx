import type { ReactNode } from 'react'
import { DevProviders } from './providers'
import { Topnav } from '@/components/developer/Topnav'

export default function DeveloperLayout({ children }: { children: ReactNode }) {
  return (
    <DevProviders>
      <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
        <Topnav />
        <main className="mx-auto max-w-[960px] px-4 py-8">
          {children}
        </main>
      </div>
    </DevProviders>
  )
}
