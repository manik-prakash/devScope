'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Search, Users, FolderOpen } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/shared'
import { DeveloperTable } from '@/components/manager/DeveloperTable'
import { useManagerUsers } from '@/lib/queries/users'
import { useManagerSessions } from '@/lib/queries/sessions'

export default function TeamPage() {
  const [search, setSearch] = useState('')

  const { data: users = [],    isLoading: usersLoading }   = useManagerUsers()
  const { data: sessData,      isLoading: sessionsLoading } = useManagerSessions(1, 200)
  const sessions = sessData?.sessions ?? []

  const isLoading = usersLoading || sessionsLoading

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        subtitle={isLoading ? undefined : `${users.length} member${users.length !== 1 ? 's' : ''}`}
        action={
          <Link
            href="/dashboard/projects"
            className="flex h-9 items-center gap-2 rounded border px-4 text-sm font-medium transition-colors duration-150"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <FolderOpen size={14} />
            Add engineers via a project
          </Link>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--text-faint)' }}
        />
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded border py-0 pl-8 pr-3 text-sm outline-none transition-colors duration-150"
          style={{
            height:      '36px',
            background:  'var(--surface)',
            borderColor: 'var(--border)',
            color:       'var(--text)',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--border)' }}
        />
      </div>

      {/* Table */}
      <div
        className="rounded border"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {isLoading ? (
          <div className="space-y-px p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded"
                style={{ background: 'var(--surface-2)' }}
              />
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            heading="No team members yet"
            subtext="Add developers to start tracking their sessions."
          />
        ) : (
          <DeveloperTable
            users={users}
            sessions={sessions}
            filter={search}
          />
        )}
      </div>

    </div>
  )
}
