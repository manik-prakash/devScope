import type { ReactNode } from 'react'
import { Providers } from './providers'
import { Sidebar } from '@/components/manager/Sidebar'
import { Topbar } from '@/components/manager/Topbar'

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
        {/* Fixed sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto px-8 py-8">
            {children}
          </main>
        </div>
      </div>
    </Providers>
  )
}
