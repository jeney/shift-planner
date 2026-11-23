import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { api } from '@/api/client'
import type { Project } from '@/api/types'
import { AppError, fromApiError, isApiError } from '@/lib/errors'
import { useDebounced } from '@/lib/use-debounced'

/** Live rule check of the current plan (the backend is the single source of truth). */
export function useValidate(project: Project) {
  const body = useMemo(() => JSON.stringify(project), [project])
  const debounced = useDebounced(body, 300)
  const query = useQuery({
    queryKey: ['validate', debounced],
    queryFn: async () => {
      const { data, error } = await api.POST('/api/validate', { body: JSON.parse(debounced) })
      if (data === undefined)
        throw isApiError(error) ? fromApiError(error) : new AppError('errors.unknown')
      return data
    },
    placeholderData: (previous) => previous,
    staleTime: Infinity,
    enabled: project.plan !== null,
  })
  return { ...query, checking: query.isFetching || body !== debounced }
}
