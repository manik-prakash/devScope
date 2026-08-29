'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { StatCard, EmptyState } from '@/components/shared'
import { ScoreTrendChart, ScoreRadarChart } from '@/components/charts'
import { InsightCard } from '@/components/developer/InsightCard'
import { useDevDashboard, type ProjectTab } from '@/lib/queries/me'
import { formatScore } from '@/lib/utils'
import { getAccessToken, getStoredUser, decodeJwt } from '@/lib/auth'

// ─── Project tab switcher ─────────────────────────────────────────────────────

interface ProjectTabsProps {
  projects:  ProjectTab[]
  active:    string | null
  onChange:  (id: string | null) => void
}

function ProjectTabs({ projects, active, onChange }: ProjectTabsProps) {
  if (projects.length <= 1) return null

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange(null)}
        className="rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150"
        style={
          active === null
            ? { background: 'var(--accent-dim)', borderColor: 'rgba(37,99,235,0.25)', color: 'var(--accent)' }
            : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }
        }
      >
        All projects
      </button>
      {projects.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className="rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150"
          style={
            active === p.id
              ? { background: 'var(--accent-dim)', borderColor: 'rgba(37,99,235,0.25)', color: 'var(--accent)' }
              : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }
          }
        >
          {p.name}
        </button>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyStatsPage() {
  const [activeProject, setActiveProject] = useState<string | null>(null)
  const [userName, setUserName]           = useState<string>('there')

  // Resolve display name from sessionStorage or JWT
  useEffect(() => {
    const u = getStoredUser()
    if (u?.name) { setUserName(u.name); return }
    // Fall back to first name from token sub if name is an email-like string
    const token = getAccessToken()
    if (!token) return
    const payload = decodeJwt(token)
    if (payload?.sub) {
      // sub is a cuid, not a name — keep fallback
    }
  }, [])

  const { isLoading, isError, truncated, projects, stats, trendData, radarData, insights } =
    useDevDashboard(activeProject)

  // Set default project tab once loaded
  useEffect(() => {
    if (!activeProject && projects.length === 1) {
      setActiveProject(projects[0].id)
    }
  }, [projects, activeProject])

  const firstName = userName.split(' ')[0]

  if (isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        heading="Couldn’t load your dashboard"
        subtext="Something went wrong reaching the server. Refresh to try again."
      />
    )
  }

  return (
    <div className="space-y-8">
      {/* ── Greeting ── */}
      <div>
        <h1
          className="font-semibold leading-tight"
          style={{ fontSize: '40px', color: 'var(--text)', letterSpacing: '-0.02em' }}
        >
          Hey {firstName}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Here&apos;s how your AI sessions are looking.
        </p>
        {truncated && (
          <p className="mt-1 text-xs" style={{ color: 'var(--text-faint)' }}>
            Based on your most recent sessions — older history isn’t loaded here.
          </p>
        )}
      </div>

      {/* ── Project tab switcher ── */}
      <ProjectTabs
        projects={projects}
        active={activeProject}
        onChange={setActiveProject}
      />

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Sessions this week"
          value={stats.sessionsThisWeek}
          isLoading={isLoading}
        />
        <StatCard
          label="Avg score this week"
          value={
            stats.avgScoreThisWeek !== null
              ? Math.round(stats.avgScoreThisWeek)
              : '–'
          }
          isLoading={isLoading}
        />
        <StatCard
          label="Best score this month"
          value={formatScore(stats.bestThisMonth)}
          isLoading={isLoading}
        />
        <StatCard
          label="Total agent time"
          value={stats.totalTime}
          mono={false}
          isLoading={isLoading}
        />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div
          className="rounded border p-5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <p className="mb-4 text-sm font-medium" style={{ color: 'var(--text)' }}>
            Score trend
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-faint)' }}>
              last 14 days
            </span>
          </p>
          <ScoreTrendChart data={trendData} height={200} isLoading={isLoading} />
        </div>

        <div
          className="rounded border p-5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <p className="mb-1 text-sm font-medium" style={{ color: 'var(--text)' }}>
            Skill breakdown
          </p>
          <p className="mb-2 text-xs" style={{ color: 'var(--text-faint)' }}>
            This week vs last week
          </p>
          <ScoreRadarChart data={radarData} height={220} isLoading={isLoading} />
        </div>
      </div>

      {/* ── Insight cards ── */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
          Insights
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded border"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                />
              ))
            : insights.map((insight, i) => (
                <InsightCard key={i} insight={insight} />
              ))}
        </div>
      </div>
    </div>
  )
}
