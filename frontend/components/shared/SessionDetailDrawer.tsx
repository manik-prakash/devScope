'use client'

import { useEffect, useRef, useState } from 'react'
import { X, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react'
import { ScoreBadge } from './ScoreBadge'
import { AgentBadge } from './AgentBadge'
import { useManagerSession, useDeveloperSession } from '@/lib/queries/sessions'
import { formatDuration, formatDateTime, clamp, truncate } from '@/lib/utils'
import type { Session, SessionStats } from '@/lib/types'

// ─── Sub-score derivation ─────────────────────────────────────────────────────

interface SubScores {
  promptQuality:       number   // 0-100
  iterationEfficiency: number   // 0-100
  toolUtilization:     number   // 0-100
}

function computeSubScores(stats: SessionStats | undefined): SubScores {
  if (!stats) return { promptQuality: 0, iterationEfficiency: 0, toolUtilization: 0 }

  const avg   = stats.avgPromptLength ?? 0
  const iters = stats.totalIterations ?? 0
  const tools = stats.totalToolCalls  ?? 0
  const proms = Math.max(1, stats.totalPrompts ?? 1)

  // Longer, more detailed prompts → higher quality (500 chars ≈ 100)
  const promptQuality = clamp(avg / 5, 0, 100)

  // Fewer iterations per prompt → clearer prompts (1 iter/prompt ≈ 85, 6+ ≈ 0)
  const iterationEfficiency = clamp(100 - (iters / proms) * 15, 0, 100)

  // More tool calls per prompt → actively using the agent (5 calls/prompt ≈ 100)
  const toolUtilization = clamp((tools / proms) * 20, 0, 100)

  return { promptQuality, iterationEfficiency, toolUtilization }
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ label, value }: { label: string; value: number }) {
  const pct = clamp(Math.round(value), 0, 100)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="font-mono text-xs font-medium" style={{ color: 'var(--text)' }}>
          {pct}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full"
        style={{ background: 'var(--surface-2)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'var(--accent)' }}
        />
      </div>
    </div>
  )
}

// ─── Stat cell ────────────────────────────────────────────────────────────────

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="mb-0.5 font-mono text-base font-semibold" style={{ color: 'var(--text)' }}>
        {value}
      </p>
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{label}</p>
    </div>
  )
}

// ─── Metadata row ─────────────────────────────────────────────────────────────

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
        {label}
      </p>
      <div className="text-sm" style={{ color: 'var(--text)' }}>{children}</div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DrawerSkeleton() {
  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6">
      {[80, 48, 120, 96, 64].map((h, i) => (
        <div
          key={i}
          className="animate-pulse rounded"
          style={{ height: `${h}px`, background: 'var(--surface-2)' }}
        />
      ))}
    </div>
  )
}

// ─── Session content ──────────────────────────────────────────────────────────

function SessionContent({ session }: { session: Session }) {
  const stats     = session.stats as SessionStats | undefined
  const feedback  = session.feedback
  const subScores = computeSubScores(stats)
  const isScored  = session.evaluationStatus === 'SCORED'
  const fileTypes = stats?.fileTypesTouched ?? []

  return (
    <div className="flex-1 space-y-0 overflow-y-auto">

      {/* ── Metadata ── */}
      <section className="border-b p-6" style={{ borderColor: 'var(--border)' }}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <MetaRow label="Agent">
            <AgentBadge agent={session.agent} />
          </MetaRow>
          <MetaRow label="Duration">
            <span className="font-mono">{formatDuration(session.durationMs)}</span>
          </MetaRow>
          <MetaRow label="Started">
            {formatDateTime(session.startedAt)}
          </MetaRow>
          {session.user && (
            <MetaRow label="Developer">
              {session.user.name}
            </MetaRow>
          )}
          {session.project && (
            <MetaRow label="Project">
              {session.project.name}
            </MetaRow>
          )}
          <MetaRow label="Signature">
            {session.signatureValid ? (
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--success)' }}>
                <CheckCircle2 size={12} /> Verified
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--warning)' }}>
                <AlertCircle size={12} /> Unverified
              </span>
            )}
          </MetaRow>
        </div>
      </section>

      {/* ── Score breakdown ── */}
      <section className="border-b p-6" style={{ borderColor: 'var(--border)' }}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
            Score breakdown
          </p>
          <div className="flex items-center gap-2">
            {session.evaluationStatus === 'PENDING' && (
              <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                <Loader2 size={10} className="animate-spin" /> Evaluating…
              </span>
            )}
            {session.evaluationStatus === 'SKIPPED' && (
              <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                Skipped (unverified)
              </span>
            )}
            <ScoreBadge score={session.score} size="md" />
          </div>
        </div>

        <div className="space-y-3">
          <ProgressBar label="Prompt Quality"        value={subScores.promptQuality}       />
          <ProgressBar label="Iteration Efficiency"  value={subScores.iterationEfficiency}  />
          <ProgressBar label="Tool Utilization"      value={subScores.toolUtilization}      />
        </div>
      </section>

      {/* ── AI feedback ── */}
      {isScored && feedback && (
        <section className="border-b p-6" style={{ borderColor: 'var(--border)' }}>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
            AI feedback
          </p>

          {/* Summary */}
          <blockquote
            className="mb-4 border-l-2 pl-3 text-sm leading-relaxed"
            style={{ borderColor: 'var(--border-hover)', color: 'var(--text-muted)' }}
          >
            {feedback.summary}
          </blockquote>

          {/* Strengths */}
          {feedback.strengths?.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-[11px] font-medium" style={{ color: 'var(--success)' }}>
                Strengths
              </p>
              <ul className="space-y-1">
                {feedback.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }}>✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvements */}
          {feedback.improvements?.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium" style={{ color: 'var(--warning)' }}>
                Areas to improve
              </p>
              <ul className="space-y-1">
                {feedback.improvements.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }}>→</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ── Stats grid ── */}
      {stats && (
        <section className="border-b p-6" style={{ borderColor: 'var(--border)' }}>
          <p className="mb-4 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
            Session stats
          </p>
          <div className="grid grid-cols-3 gap-4">
            <StatCell label="Prompts"      value={stats.totalPrompts       ?? 0} />
            <StatCell label="Iterations"   value={stats.totalIterations    ?? 0} />
            <StatCell label="Tool calls"   value={stats.totalToolCalls     ?? 0} />
            <StatCell label="Files changed" value={stats.filesChangedCount  ?? 0} />
            <StatCell label="Shell cmds"   value={stats.shellCommandsCount ?? 0} />
            <StatCell
              label="Avg prompt"
              value={stats.avgPromptLength ? `${Math.round(stats.avgPromptLength)}c` : '—'}
            />
          </div>
        </section>
      )}

      {/* ── File types ── */}
      {fileTypes.length > 0 && (
        <section className="border-b p-6" style={{ borderColor: 'var(--border)' }}>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
            File types touched
          </p>
          <div className="flex flex-wrap gap-1.5">
            {fileTypes.map((ft) => (
              <span
                key={ft}
                className="rounded-full border px-2.5 py-0.5 font-mono text-xs"
                style={{
                  background:  'var(--surface-2)',
                  borderColor: 'var(--border)',
                  color:       'var(--text-muted)',
                }}
              >
                .{ft}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <section className="p-6">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <p className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>
            CLI {session.cliVersion}
          </p>
          <p className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>
            {session.agent} {session.agentVersion}
          </p>
        </div>
      </section>
    </div>
  )
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

export interface SessionDetailDrawerProps {
  sessionId:  string | null
  viewerRole: 'manager' | 'developer'
  onClose:    () => void
}

export function SessionDetailDrawer({
  sessionId,
  viewerRole,
  onClose,
}: SessionDetailDrawerProps) {
  const [open, setOpen] = useState(false)

  // Trigger CSS transition on mount by deferring `open` one frame
  useEffect(() => {
    if (sessionId) {
      const id = requestAnimationFrame(() => setOpen(true))
      return () => cancelAnimationFrame(id)
    } else {
      setOpen(false)
    }
  }, [sessionId])

  // Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (sessionId) document.addEventListener('keydown', onKeyDown)
    return ()   => document.removeEventListener('keydown', onKeyDown)
  }, [sessionId, onClose])

  const { data: managerSession,   isLoading: mLoading, isError: mError } = useManagerSession(
    viewerRole === 'manager' ? sessionId : null,
  )
  const { data: developerSession, isLoading: dLoading, isError: dError } = useDeveloperSession(
    viewerRole === 'developer' ? sessionId : null,
  )

  const session   = viewerRole === 'manager' ? managerSession   : developerSession
  const isLoading = viewerRole === 'manager' ? mLoading         : dLoading
  const isError   = viewerRole === 'manager' ? mError           : dError

  if (!sessionId) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-150"
        style={{
          background: 'rgba(0,0,0,0.6)',
          opacity:    open ? 1 : 0,
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full flex-col border-l transition-transform duration-150"
        style={{
          width:       '480px',
          background:  'var(--surface)',
          borderColor: 'var(--border)',
          transform:   open ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-6 py-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="font-mono text-xs" style={{ color: 'var(--text-faint)' }}>
            {truncate(sessionId, 32)}
          </span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded transition-colors duration-150"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-2)'
              e.currentTarget.style.color      = 'var(--text)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color      = 'var(--text-faint)'
            }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        {isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <AlertCircle size={28} style={{ color: 'var(--text-faint)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Couldn’t load this session
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Something went wrong reaching the server. Close and try again.
            </p>
          </div>
        ) : isLoading || !session ? (
          <DrawerSkeleton />
        ) : (
          <SessionContent session={session} />
        )}
      </div>
    </>
  )
}
