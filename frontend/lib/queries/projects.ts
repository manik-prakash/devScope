import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Organization, Project, ProjectDetail } from '@/lib/types'

// ─── Org ──────────────────────────────────────────────────────────────────────

export const MANAGER_ORG_QUERY_KEY = ['manager', 'org'] as const

export function useManagerOrg() {
  return useQuery({
    queryKey: MANAGER_ORG_QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<Organization>('/manager/org')
      return data
    },
    staleTime: 300_000,
  })
}

// ─── Projects list ────────────────────────────────────────────────────────────

interface ProjectsResponse {
  projects: Project[]
}

export const MANAGER_PROJECTS_QUERY_KEY = ['manager', 'projects'] as const

export function useManagerProjects() {
  return useQuery({
    queryKey: MANAGER_PROJECTS_QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<ProjectsResponse>('/manager/projects')
      return data.projects
    },
    staleTime: 60_000,
  })
}

// ─── Single project (detail with members) ─────────────────────────────────────

export const managerProjectQueryKey = (slug: string | null) =>
  ['manager', 'project', slug] as const

export function useManagerProject(slug: string | null) {
  return useQuery({
    queryKey: managerProjectQueryKey(slug),
    queryFn: async (): Promise<ProjectDetail | null> => {
      if (!slug) return null
      const { data } = await api.get<ProjectDetail>(`/manager/projects/${slug}`)
      return data
    },
    enabled: !!slug,
    staleTime: 60_000,
  })
}
