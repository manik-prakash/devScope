import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ManagerSessionsResponse, DeveloperSessionsResponse, Session } from '@/lib/types'

/**
 * One page is fetched and aggregated client-side for the dashboards (trend
 * charts, "latest N" stats, CSV export). This is the ceiling the backend
 * session-list endpoints allow; screens that use it must label their numbers as
 * "the most recent N sessions", not "all-time".
 */
export const AGGREGATE_LIMIT = 500

// ─── Manager ──────────────────────────────────────────────────────────────────

export function useManagerSessions(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['manager', 'sessions', page, limit],
    queryFn: async () => {
      const { data } = await api.get<ManagerSessionsResponse>('/manager/sessions', {
        params: { page, limit },
      })
      return data
    },
    staleTime: 30_000,
  })
}

export function useManagerSession(sessionId: string | null) {
  return useQuery({
    queryKey: ['manager', 'session', sessionId],
    queryFn: async () => {
      const { data } = await api.get<Session>(`/manager/sessions/${sessionId}`)
      return data
    },
    enabled: !!sessionId,
    staleTime: 60_000,
  })
}

// ─── Developer ────────────────────────────────────────────────────────────────

export function useDeveloperSessions(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['developer', 'sessions', page, limit],
    queryFn: async () => {
      const { data } = await api.get<DeveloperSessionsResponse>('/developer/sessions', {
        params: { page, limit },
      })
      return data
    },
    staleTime: 30_000,
  })
}

export function useDeveloperSession(sessionId: string | null) {
  return useQuery({
    queryKey: ['developer', 'session', sessionId],
    queryFn: async () => {
      const { data } = await api.get<Session>(`/developer/sessions/${sessionId}`)
      return data
    },
    enabled: !!sessionId,
    staleTime: 60_000,
  })
}
