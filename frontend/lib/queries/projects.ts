import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Organization, Project } from '@/lib/types'

// ─── Org ──────────────────────────────────────────────────────────────────────

export function useManagerOrg() {
  return useQuery({
    queryKey: ['manager', 'org'],
    queryFn: async () => {
      const { data } = await api.get<Organization>('/manager/org')
      return data
    },
    staleTime: 300_000,
  })
}

// ─── Projects — STUB (GET /manager/projects not yet in backend) ───────────────

const STUB_PROJECTS: Project[] = [
  {
    id:        'proj_stub_1',
    orgId:     'org_stub',
    name:      'Web Platform',
    slug:      'web-platform',
    createdAt: new Date(Date.now() - 30 * 86400_000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id:        'proj_stub_2',
    orgId:     'org_stub',
    name:      'Mobile App',
    slug:      'mobile-app',
    createdAt: new Date(Date.now() - 60 * 86400_000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export function useManagerProjects() {
  return useQuery({
    queryKey: ['manager', 'projects'],
    // TODO: replace with real API call when GET /manager/projects is added
    queryFn: async (): Promise<Project[]> => {
      await new Promise((r) => setTimeout(r, 0)) // keep async shape
      return STUB_PROJECTS
    },
    staleTime: 300_000,
  })
}

export function useManagerProject(slug: string | null) {
  return useQuery({
    queryKey: ['manager', 'project', slug],
    // TODO: replace with GET /manager/projects/:slug
    queryFn: async (): Promise<Project | null> => {
      await new Promise((r) => setTimeout(r, 0))
      return STUB_PROJECTS.find((p) => p.slug === slug) ?? null
    },
    enabled: !!slug,
    staleTime: 300_000,
  })
}
