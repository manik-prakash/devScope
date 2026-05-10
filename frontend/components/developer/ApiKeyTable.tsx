'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { formatRelativeTime, formatDate, truncate } from '@/lib/utils'
import { API_KEYS_QUERY_KEY } from '@/lib/queries/keys'
import api from '@/lib/api'
import type { ApiKey } from '@/lib/types'

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ revoked }: { revoked: boolean }) {
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-xs font-medium"
      style={
        revoked
          ? {
              background:  'var(--surface-2)',
              color:       'var(--text-faint)',
              borderColor: 'var(--border)',
            }
          : {
              background:  'rgba(22,163,74,0.1)',
              color:       '#86EFAC',
              borderColor: 'rgba(22,163,74,0.2)',
            }
      }
    >
      {revoked ? 'Revoked' : 'Active'}
    </span>
  )
}

// ─── Inline revoke button ─────────────────────────────────────────────────────

interface RevokeButtonProps {
  keyId:    string
  label:    string
  revoked:  boolean
  onRevoke: (id: string) => Promise<void>
}

function RevokeButton({ keyId, label, revoked, onRevoke }: RevokeButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [loading,    setLoading]    = useState(false)

  if (revoked) {
    return <span className="text-xs" style={{ color: 'var(--text-faint)' }}>—</span>
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Revoke &ldquo;{truncate(label, 16)}&rdquo;?
        </span>
        <button
          disabled={loading}
          onClick={async () => {
            setLoading(true)
            await onRevoke(keyId)
            setConfirming(false)
            setLoading(false)
          }}
          className="text-xs font-medium disabled:opacity-40"
          style={{ color: 'var(--danger)' }}
        >
          {loading ? 'Revoking…' : 'Confirm'}
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

// ─── Table ────────────────────────────────────────────────────────────────────

interface ApiKeyTableProps {
  keys: ApiKey[]
}

export function ApiKeyTable({ keys }: ApiKeyTableProps) {
  const queryClient = useQueryClient()

  async function handleRevoke(keyId: string) {
    await api.delete(`/developer/api-keys/${keyId}`)
    await queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY })
  }

  const COL = 'px-4 py-3 text-sm'

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Label / ID', 'Created', 'Last used', 'Status', ''].map((h) => (
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
          {keys.map((key) => (
            <tr key={key.id} style={{ borderBottom: '1px solid var(--border)' }}>
              {/* Label + ID prefix */}
              <td className={COL}>
                <p className="font-medium" style={{ color: 'var(--text)' }}>
                  {key.label}
                </p>
                <p className="font-mono text-xs" style={{ color: 'var(--text-faint)' }}>
                  {truncate(key.id, 16)}
                </p>
              </td>

              {/* Created */}
              <td className={COL} style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {formatDate(key.createdAt)}
              </td>

              {/* Last used */}
              <td className={COL} style={{ color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                {key.lastUsedAt ? formatRelativeTime(key.lastUsedAt) : '—'}
              </td>

              {/* Status */}
              <td className={COL}>
                <StatusBadge revoked={!!key.revokedAt} />
              </td>

              {/* Revoke */}
              <td className={`${COL} text-right`}>
                <RevokeButton
                  keyId={key.id}
                  label={key.label}
                  revoked={!!key.revokedAt}
                  onRevoke={handleRevoke}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
