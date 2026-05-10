'use client'

import { useState } from 'react'
import { Copy, Check, AlertTriangle } from 'lucide-react'
import type { NewDeveloperResult } from './AddDeveloperModal'

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for environments without clipboard API
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors duration-150"
      style={{
        color:      copied ? 'var(--success)' : 'var(--text-faint)',
        background: 'transparent',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      aria-label="Copy to clipboard"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

// ─── Credential row ───────────────────────────────────────────────────────────

function CredentialRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <div
        className="flex items-center gap-2 rounded border px-3 py-2"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
      >
        <span
          className={`flex-1 text-sm ${mono ? 'font-mono' : ''}`}
          style={{ color: 'var(--text)', wordBreak: 'break-all' }}
        >
          {value}
        </span>
        <CopyButton text={value} />
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface TempPasswordModalProps {
  result:  NewDeveloperResult
  onClose: () => void
}

export function TempPasswordModal({ result, onClose }: TempPasswordModalProps) {
  return (
    // No onClick on backdrop — intentionally non-dismissable
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <div
        className="w-full max-w-sm rounded border p-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        // No stopPropagation needed since backdrop has no handler
      >
        {/* Header — no X button */}
        <div className="mb-5">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Share these credentials with {result.name}
          </h2>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            They will be asked to set a new password on first login.
          </p>
        </div>

        {/* Credentials */}
        <div className="space-y-3">
          <CredentialRow label="Email"              value={result.email}        />
          <CredentialRow label="Temporary password" value={result.tempPassword} mono />
        </div>

        {/* Warning */}
        <div
          className="mt-4 flex items-start gap-2 rounded border px-3 py-2.5"
          style={{
            background:  'rgba(217,119,6,0.08)',
            borderColor: 'rgba(217,119,6,0.2)',
          }}
        >
          <AlertTriangle size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Copy these credentials now. You cannot view this password again after closing this dialog.
          </p>
        </div>

        {/* Single dismiss button */}
        <button
          onClick={onClose}
          className="mt-5 h-9 w-full rounded text-sm font-medium text-white transition-colors duration-150"
          style={{ background: 'var(--accent)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
        >
          I&apos;ve copied it
        </button>
      </div>
    </div>
  )
}
