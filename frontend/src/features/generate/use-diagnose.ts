import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { api } from '@/api/client'
import type { Project } from '@/api/types'
import { AppError, fromApiError, isApiError } from '@/lib/errors'
import { useDebounced } from '@/lib/use-debounced'

/** Pre-check diagnostics for the project's inputs (the plan is ignored), refreshed on edits. */
export function useDiagnose(project: Project) {
  const inputs = useMemo(() => JSON.stringify({ ...project, plan: null }), [project])
  const debounced = useDebounced(inputs, 400)
  return useQuery({
    queryKey: ['diagnose', debounced],
    queryFn: async () => {
      const { data, error } = await api.POST('/api/diagnose', { body: JSON.parse(debounced) })
      if (data === undefined)
        throw isApiError(error) ? fromApiError(error) : new AppError('errors.unknown')
      return data.diagnostics
    },
    placeholderData: (previous) => previous,
    staleTime: Infinity,
  })
}
