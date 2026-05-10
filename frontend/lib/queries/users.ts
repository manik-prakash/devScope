import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { UsersResponse, User } from '@/lib/types'

// ─── Manager — users list ─────────────────────────────────────────────────────

export function useManagerUsers() {
  return useQuery({
    queryKey: ['manager', 'users'],
    queryFn: async () => {
      const { data } = await api.get<UsersResponse>('/manager/users')
      return data.users
    },
    staleTime: 60_000,
  })
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
