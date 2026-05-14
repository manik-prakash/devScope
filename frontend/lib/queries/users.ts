import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { UsersResponse, User, UserRole } from '@/lib/types'

// ─── Manager — users list ─────────────────────────────────────────────────────

export const MANAGER_USERS_QUERY_KEY = ['manager', 'users'] as const

export function useManagerUsers(enabled: boolean = true) {
  return useQuery({
    queryKey: MANAGER_USERS_QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<UsersResponse>('/manager/users')
      return data.users
    },
    staleTime: 60_000,
    enabled,
  })
}

// ─── Admin — users list ───────────────────────────────────────────────────────

export const ADMIN_USERS_QUERY_KEY = ['admin', 'users'] as const

export function useAdminUsers(enabled: boolean = true) {
  return useQuery({
    queryKey: ADMIN_USERS_QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<UsersResponse>('/admin/users')
      return data.users
    },
    staleTime: 60_000,
    enabled,
  })
}

// ─── Convenience: pick the right endpoint based on the viewer's role ──────────
// Only one query is enabled at a time, so we don't double-fetch.

export function useOrgUsers(viewerRole: UserRole | undefined) {
  const isAdmin = viewerRole === 'ADMIN'
  const admin   = useAdminUsers(isAdmin)
  const manager = useManagerUsers(!isAdmin && viewerRole !== undefined)
  return isAdmin ? admin : manager
}

// ─── Manager — single user — STUB (GET /manager/users/:id not yet in backend) ─

export function useManagerUser(userId: string | null) {
  const { data: users } = useManagerUsers()
  return useQuery({
    queryKey: ['manager', 'user', userId],
    // TODO: replace with GET /manager/users/:userId when backend adds it
    queryFn: async (): Promise<User | null> => {
      await new Promise((r) => setTimeout(r, 0))
      return users?.find((u) => u.id === userId) ?? null
    },
    enabled: !!userId,
    staleTime: 60_000,
  })
}
