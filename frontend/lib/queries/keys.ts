import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ApiKeysResponse } from '@/lib/types'

export const API_KEYS_QUERY_KEY = ['developer', 'api-keys'] as const

export function useApiKeys() {
  return useQuery({
    queryKey: API_KEYS_QUERY_KEY,
    queryFn:  async () => {
      const { data } = await api.get<ApiKeysResponse>('/developer/api-keys')
      return data.keys
    },
    staleTime: 30_000,
  })
}
