import { useQuery } from '@tanstack/react-query'

import { api } from './client'
import { fetchMonthCalendar } from './project-api'

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/health')
      if (error || !data) throw new Error('API unavailable')
      return data
    },
    refetchInterval: 30_000,
    retry: 1,
  })
}

export function useMonthCalendar(month: string) {
  return useQuery({
    queryKey: ['calendar', month],
    queryFn: () => fetchMonthCalendar(month),
    staleTime: Infinity,
  })
}
