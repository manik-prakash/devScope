'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Users, Key, AlertTriangle, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { InviteUserModal } from '@/components/manager/InviteUserModal'
import { TempPasswordModal } from '@/components/manager/TempPasswordModal'
import {
  useManagerUsers,
  useAdminUsers,
  ADMIN_USERS_QUERY_KEY,
  MANAGER_USERS_QUERY_KEY,
} from '@/lib/queries/users'
import { useManagerSessions } from '@/lib/queries/sessions'
import { useManagerOrg } from '@/lib/queries/projects'
import { getAccessToken, decodeJwt } from '@/lib/auth'
import { formatRelativeTime, initials } from '@/lib/utils'
import type { InvitedUserResult, User, UserRole } from '@/lib/types'

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'members' | 'api-keys' | 'danger'

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  const styles: Record<UserRole, { bg: string; fg: string; bd: string; label: string }> = {
    ADMIN: {
      bg:    'rgba(217,119,6,0.12)',
      fg:    '#FCD34D',
      bd:    'rgba(217,119,6,0.25)',
      label: 'Admin',
    },
    MANAGER: {
      bg:    'rgba(37,99,235,0.1)',
      fg:    '#93C5FD',
      bd:    'rgba(37,99,235,0.2)',
      label: 'Manager',
    },
    DEVELOPER: {
      bg:    'var(--surface-2)',
      fg:    'var(--text-muted)',
      bd:    'var(--border)',
      label: 'Developer',
    },
  }
  const s = styles[role]
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ background: s.bg, color: s.fg, borderColor: s.bd }}
    >
      {s.label}
    </span>
  )
}

// ─── Revoke button (inline confirm) ──────────────────────────────────────────

interface RevokeButtonProps {
  userId:   string
  name:     string
  onRevoke: (userId: string) => void
}

function RevokeButton({ userId, name, onRevoke }: RevokeButtonProps) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <span className="flex items-center justify-end gap-2">
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
  viewerRole:    UserRole | null
  viewerUserId:  string | null
  onInviteOpen:  () => void
}

function MembersTab({ viewerRole, viewerUserId, onInviteOpen }: MembersTabProps) {
  const queryClient = useQueryClient()
  const isAdmin     = viewerRole === 'ADMIN'

  // Admin pulls the canonical org-wide list from /admin/users (includes mustChangePass).
  // Managers fall back to /manager/users.
  const adminQuery   = useAdminUsers(isAdmin)
  const managerQuery = useManagerUsers(!isAdmin && viewerRole !== null)
  const users        = (isAdmin ? adminQuery.data : managerQuery.data) ?? []
  const usersLoading = isAdmin ? adminQuery.isLoading : managerQuery.isLoading

  const { data: sessData } = useManagerSessions(1, 200)
  const sessions = sessData?.sessions ?? []

  async function handleRevoke(userId: string) {
    try {
      await api.delete(`/admin/users/${userId}`)
      await queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: MANAGER_USERS_QUERY_KEY })
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to remove user'
      // Surface via alert for now — Settings has no toast system yet
      window.alert(msg)
    }
  }

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
        {isAdmin && (
          <button
            onClick={onInviteOpen}
            className="h-9 rounded px-4 text-sm font-medium text-white transition-colors duration-150"
            style={{ background: 'var(--accent)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
          >
            Add manager
          </button>
        )}
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
                  {['Member', 'Role', 'Status', 'Last active', ''].map((h) => (
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
                {users.map((user: User) => {
                  const la         = lastActive(user.id)
                  const isSelf     = user.id === viewerUserId
                  const isOtherAdmin = user.role === 'ADMIN' && !isSelf
                  const canRevoke  = isAdmin && !isSelf && !isOtherAdmin
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
                            <p className="font-medium" style={{ color: 'var(--text)' }}>
                              {user.name}{isSelf && <span style={{ color: 'var(--text-faint)' }}> (you)</span>}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className={COL}>
                        <RoleBadge role={user.role} />
                      </td>
                      <td className={COL}>
                        {user.mustChangePass ? (
                          <span
                            className="rounded-full border px-2 py-0.5 text-xs"
                            style={{
                              background:  'rgba(217,119,6,0.08)',
                              color:       '#FCD34D',
                              borderColor: 'rgba(217,119,6,0.2)',
                            }}
                          >
                            Pending first login
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Active</span>
                        )}
                      </td>
                      <td className={COL} style={{ color: 'var(--text-faint)' }}>
                        {la ? formatRelativeTime(la) : '—'}
                      </td>
                      <td className={`${COL} text-right`}>
                        {canRevoke && (
                          <RevokeButton
                            userId={user.id}
                            name={user.name}
                            onRevoke={handleRevoke}
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isAdmin && (
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          Only admins can add or remove organisation members. Engineers are added via a project — go
          to Projects → [your project] → Add engineer.
        </p>
      )}
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
    // TODO: DELETE /admin/org when backend adds endpoint
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
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab]   = useState<Tab>('members')
  const [showInvite, setShowInvite] = useState(false)
  const [tempResult, setTempResult] = useState<InvitedUserResult | null>(null)

  // Decode the current user's role from the access token. The Sidebar uses the
  // same pattern; both run client-side after hydration.
  const [viewerRole, setViewerRole]     = useState<UserRole | null>(null)
  const [viewerUserId, setViewerUserId] = useState<string | null>(null)
  useEffect(() => {
    const token = getAccessToken()
    if (!token) return
    const payload = decodeJwt(token)
    if (!payload) return
    setViewerRole(payload.role)
    setViewerUserId(payload.sub)
  }, [])

  async function handleInvited(result: InvitedUserResult) {
    setShowInvite(false)
    // Admin invites always create a new user, so tempPassword is always set.
    if (result.tempPassword) setTempResult(result)
    await queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY })
    await queryClient.invalidateQueries({ queryKey: MANAGER_USERS_QUERY_KEY })
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
          {activeTab === 'members'  && (
            <MembersTab
              viewerRole={viewerRole}
              viewerUserId={viewerUserId}
              onInviteOpen={() => setShowInvite(true)}
            />
          )}
          {activeTab === 'api-keys' && <ApiKeysTab />}
          {activeTab === 'danger'   && <DangerTab />}
        </div>
      </div>

      {/* Modals */}
      {showInvite && (
        <InviteUserModal
          title="Add manager"
          submitLabel="Send invite"
          endpoint="/admin/users"
          extraBody={{ role: 'MANAGER' }}
          onClose={() => setShowInvite(false)}
          onSuccess={handleInvited}
        />
      )}

      {tempResult && tempResult.tempPassword && (
        <TempPasswordModal
          result={{ ...tempResult, tempPassword: tempResult.tempPassword }}
          onClose={() => setTempResult(null)}
        />
      )}
    </div>
  )
}
