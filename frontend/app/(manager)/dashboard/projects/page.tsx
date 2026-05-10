'use client'

import { useState, useMemo } from 'react'
import { FolderOpen, X, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PageHeader, EmptyState } from '@/components/shared'
import { ProjectCard } from '@/components/manager/ProjectCard'
import { useManagerProjects } from '@/lib/queries/projects'
import { useManagerSessions } from '@/lib/queries/sessions'
import { isWithinDays, average } from '@/lib/utils'
import api from '@/lib/api'
import type { Project } from '@/lib/types'

// ─── New project form ─────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
})
type FormData = z.infer<typeof schema>

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
}

function Field({ label, hint, error, id, ...props }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: 'var(--text)' }}>
        {label}
      </label>
      <input
        id={id}
        className="w-full rounded border px-3 text-sm outline-none transition-colors duration-150"
        style={{
          height:      '36px',
          background:  'var(--surface-2)',
          color:       'var(--text)',
          borderColor: error ? 'var(--danger)' : 'var(--border)',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--accent)' }}
        onBlur={(e)  => { e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--border)' }}
        {...props}
      />
      {hint && !error && (
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{hint}</p>
      )}
      {error && (
        <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
      )}
    </div>
  )
}

// ─── New project modal ────────────────────────────────────────────────────────

interface NewProjectModalProps {
  onClose:   () => void
  onCreated: (project: Project) => void
}

function NewProjectModal({ onClose, onCreated }: NewProjectModalProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      const { data: project } = await api.post<Project>('/manager/projects', data)
      onCreated(project)
      onClose()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to create project'
      setServerError(msg)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded border p-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            New project
          </h2>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded transition-colors duration-150"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)' }}
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field
            id="name"
            label="Project name"
            placeholder="Web Platform"
            error={errors.name?.message}
            {...register('name')}
          />
          <Field
            id="slug"
            label="Slug"
            placeholder="web-platform"
            hint="Used in URLs — lowercase, letters, numbers, hyphens only"
            error={errors.slug?.message}
            {...register('slug')}
          />

          {serverError && (
            <p
              className="rounded border px-3 py-2 text-xs"
              style={{
                color:       'var(--danger)',
                borderColor: 'rgba(220,38,38,0.2)',
                background:  'rgba(220,38,38,0.08)',
              }}
            >
              {serverError}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 flex-1 rounded border text-sm font-medium transition-colors duration-150"
              style={{
                borderColor: 'var(--border)',
                color:       'var(--text-muted)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background   = 'var(--surface-2)'
                e.currentTarget.style.borderColor  = 'var(--border-hover)'
                e.currentTarget.style.color        = 'var(--text)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background  = 'transparent'
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color       = 'var(--text-muted)'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded text-sm font-medium text-white transition-colors duration-150 disabled:opacity-40"
              style={{ background: 'var(--accent)' }}
              onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.background = 'var(--accent-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
            >
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              Create project
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [showModal, setShowModal] = useState(false)

  const { data: projects = [], isLoading: projLoading } = useManagerProjects()
  const { data: sessData }                               = useManagerSessions(1, 100)
  const allSessions                                      = sessData?.sessions ?? []

  // Per-project computed stats
  const projectStats = useMemo(() => {
    const map: Record<string, { weekSessions: number; scores: number[] }> = {}
    for (const p of projects) {
      map[p.id] = { weekSessions: 0, scores: [] }
    }
    for (const s of allSessions) {
      if (!map[s.projectId]) continue
      if (isWithinDays(s.startedAt, 7)) map[s.projectId].weekSessions++
      if (s.score !== null && s.score !== undefined) map[s.projectId].scores.push(s.score)
    }
    return map
  }, [projects, allSessions])

  if (projLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Projects" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} project${projects.length !== 1 ? 's' : ''}`}
        action={
          <button
            onClick={() => setShowModal(true)}
            className="h-9 rounded px-4 text-sm font-medium text-white transition-colors duration-150"
            style={{ background: 'var(--accent)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
          >
            New project
          </button>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          heading="No projects yet"
          subtext="Create your first project to start tracking sessions."
          ctaLabel="New project"
          ctaAction={() => setShowModal(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {projects.map((project) => {
            const s   = projectStats[project.id] ?? { weekSessions: 0, scores: [] }
            const avg = s.scores.length ? average(s.scores) : null
            return (
              <ProjectCard
                key={project.id}
                project={project}
                weekSessions={s.weekSessions}
                avgScore={avg}
              />
            )
          })}
        </div>
      )}

      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreated={() => {/* TODO: invalidate projects query */}}
        />
      )}
    </div>
  )
}
