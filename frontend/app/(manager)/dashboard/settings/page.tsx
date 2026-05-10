'use client'

import { useState } from 'react'
import { Users, Key, AlertTriangle, Trash2 } from 'lucide-react'
import { AddDeveloperModal, type NewDeveloperResult } from '@/components/manager/AddDeveloperModal'
import { TempPasswordModal } from '@/components/manager/TempPasswordModal'
import { useManagerUsers } from '@/lib/queries/users'
import { useManagerSessions } from '@/lib/queries/sessions'
import { useManagerOrg } from '@/lib/queries/projects'
import { formatRelativeTime, initials } from '@/lib/utils'

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'members' | 'api-keys' | 'danger'

// ─── Role badge (inline, small) ───────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const isManager = role === 'MANAGER'
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{
        background:  isManager ? 'rgba(37,99,235,0.1)'  : 'var(--surface-2)',
        color:       isManager ? '#93C5FD'               : 'var(--text-muted)',
        borderColor: isManager ? 'rgba(37,99,235,0.2)'  : 'var(--border)',
      }}
    >
      {isManager ? 'Manager' : 'Developer'}
    </span>
  )
}

// ─── Revoke button with inline confirm ───────────────────────────────────────

interface RevokeButtonProps {
  userId: string
  name:   string
  onRevoke: (userId: string) => void
}

function RevokeButton({ userId, name, onRevoke }: RevokeButtonProps) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Remove {name}?
        </span>
        <button
          onClick={() => { onRevoke(userId); setConfirming(false) }}
          className="text-xs font-medium"
          style={{ color: 'var(--danger)' }}
        >
          Confirm
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs"
          style={{ color: 'var(--text-faint)' }}
        >
          Cancel
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-xs transition-colors duration-150"
      style={{ color: 'var(--text-faint)' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)' }}
    >
      <Trash2 size={12} />
      Revoke
    </button>
  )
}

// ─── Members tab ──────────────────────────────────────────────────────────────

interface MembersTabProps {
  onAddDeveloper: () => void
}

function MembersTab({ onAddDeveloper }: MembersTabProps) {
  const { data: users = [],  isLoading: usersLoading }    = useManagerUsers()
  const { data: sessData }                                 = useManagerSessions(1, 200)
  const sessions = sessData?.sessions ?? []

  function handleRevoke(userId: string) {
    // TODO: DELETE /manager/users/:userId when backend adds endpoint
    console.log('[STUB] Revoke user:', userId)
  }

  // Compute last active per user from sessions
  function lastActive(userId: string): string | null {
    const mine = sessions.filter((s) => s.userId === userId)
    if (!mine.length) return null
    return mine.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0].createdAt
  }

  const COL = 'px-4 py-3 text-sm'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Members</h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            {users.length} member{users.length !== 1 ? 's' : ''} in your organisation
          </p>
        </div>
        <button
          onClick={onAddDeveloper}
          className="h-9 rounded px-4 text-sm font-medium text-white transition-colors duration-150"
          style={{ background: 'var(--accent)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
        >
          Add developer
        </button>
      </div>

      <div
        className="rounded border"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {usersLoading ? (
          <div className="space-y-px p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded"
                style={{ background: 'var(--surface-2)' }}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Member', 'Role', 'Last active', ''].map((h) => (
                    <th
                      key={h}
                      className="px-4 pb-2 pt-0 text-left text-xs font-medium"
                      style={{ color: 'var(--text-faint)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const la = lastActive(user.id)
                  return (
                    <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className={COL}>
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                          >
                            {initials(user.name)}
                          </span>
                          <div>
                            <p className="font-medium" style={{ color: 'var(--text)' }}>{user.name}</p>
                            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className={COL}>
                        <RoleBadge role={user.role} />
                      </td>
                      <td className={COL} style={{ color: 'var(--text-faint)' }}>
                        {la ? formatRelativeTime(la) : '—'}
                      </td>
                      <td className={`${COL} text-right`}>
                        <RevokeButton
                          userId={user.id}
                          name={user.name}
                          onRevoke={handleRevoke}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── API keys tab ─────────────────────────────────────────────────────────────

function ApiKeysTab() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>API Keys</h2>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          Developers manage their own API keys from their personal settings.
        </p>
      </div>
      <div
        className="rounded border px-6 py-10 text-center"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <Key size={32} strokeWidth={1.5} className="mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Personal API keys
        </p>
        <p className="mt-1 max-w-xs mx-auto text-xs" style={{ color: 'var(--text-muted)' }}>
          Each developer generates and manages their own API keys from{' '}
          <span className="font-mono">Settings → API Keys</span> in their dashboard.
        </p>
      </div>
    </div>
  )
}

// ─── Danger zone tab ──────────────────────────────────────────────────────────

function DangerTab() {
  const { data: org } = useManagerOrg()
  const [inputValue, setInputValue]   = useState('')
  const [confirmed, setConfirmed]     = useState(false)

  const slugToMatch = org?.slug ?? ''
  const isMatch     = inputValue === slugToMatch

  function handleDelete() {
    if (!isMatch) return
    // TODO: DELETE /manager/org when backend adds endpoint
    console.log('[STUB] Delete org:', org?.id)
    setConfirmed(true)
  }

  if (confirmed) {
    return (
      <div className="rounded border px-6 py-10 text-center" style={{ borderColor: 'var(--border)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Organisation deletion has been requested. (Stub — no actual deletion occurred.)
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Danger zone</h2>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          Irreversible actions. Proceed with extreme caution.
        </p>
      </div>

      <div
        className="rounded border p-5"
        style={{ borderColor: 'rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.04)' }}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={16}
            className="mt-0.5 shrink-0"
            style={{ color: 'var(--danger)' }}
          />
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                Delete organisation
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                This will permanently delete your organisation, all projects, all sessions, and all
                member accounts. This action cannot be undone.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                Type{' '}
                <span className="font-mono" style={{ color: 'var(--text)' }}>
                  {slugToMatch || 'your-org-slug'}
                </span>{' '}
                to confirm
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={slugToMatch || 'org-slug'}
                className="w-full rounded border px-3 text-sm font-mono outline-none transition-colors duration-150"
                style={{
                  height:      '36px',
                  background:  'var(--surface-2)',
                  borderColor: 'var(--border)',
                  color:       'var(--text)',
                  maxWidth:    '280px',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--danger)' }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
            </div>

            <button
              onClick={handleDelete}
              disabled={!isMatch}
              className="h-9 rounded px-4 text-sm font-medium text-white transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-30"
              style={{ background: 'var(--danger)' }}
              onMouseEnter={(e) => {
                if (isMatch) e.currentTarget.style.background = '#B91C1C'
              }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--danger)' }}
            >
              Delete organisation
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'members',  label: 'Members',    icon: Users        },
  { id: 'api-keys', label: 'API Keys',   icon: Key          },
  { id: 'danger',   label: 'Danger zone', icon: AlertTriangle },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab]           = useState<Tab>('members')
  const [showAddModal, setShowAddModal]     = useState(false)
  const [tempResult, setTempResult]         = useState<NewDeveloperResult | null>(null)

  function handleCreated(result: NewDeveloperResult) {
    setShowAddModal(false)
    setTempResult(result)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 font-semibold" style={{ fontSize: '24px', color: 'var(--text)' }}>
          Settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Manage your organisation
        </p>
      </div>

      <div className="flex gap-8">
        {/* Left nav */}
        <nav className="w-44 shrink-0 space-y-0.5">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id
            const isDanger = id === 'danger'
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="flex h-9 w-full items-center gap-2.5 rounded-sm px-3 text-sm font-medium transition-colors duration-150"
                style={{
                  background:  isActive ? 'var(--surface-2)' : 'transparent',
                  color:       isActive
                    ? isDanger ? 'var(--danger)' : 'var(--text)'
                    : isDanger ? 'var(--danger)' : 'var(--text-muted)',
                  opacity:     isDanger && !isActive ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--surface-2)'
                    e.currentTarget.style.color      = isDanger ? 'var(--danger)' : 'var(--text)'
                    e.currentTarget.style.opacity    = '1'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color      = isDanger ? 'var(--danger)' : 'var(--text-muted)'
                    e.currentTarget.style.opacity    = isDanger ? '0.7' : '1'
                  }
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            )
          })}
        </nav>

        {/* Right content */}
        <div className="min-w-0 flex-1">
          {activeTab === 'members'  && <MembersTab onAddDeveloper={() => setShowAddModal(true)} />}
          {activeTab === 'api-keys' && <ApiKeysTab />}
          {activeTab === 'danger'   && <DangerTab />}
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddDeveloperModal
          onClose={() => setShowAddModal(false)}
          onCreated={handleCreated}
        />
      )}

      {tempResult && (
        <TempPasswordModal
          result={tempResult}
          onClose={() => setTempResult(null)}
        />
      )}
    </div>
  )
}
