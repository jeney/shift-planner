import { useMutation } from '@tanstack/react-query'
import { create } from 'zustand'

import { api } from '@/api/client'
import type { SolveResponse } from '@/api/types'
import { AppError, fromApiError, isApiError } from '@/lib/errors'
import { replacePlan } from '@/features/plan/history'
import { useProjectStore } from '@/project/store'

interface SolveState {
  /** The last solver result for the current project (kept in memory only). */
  result: SolveResponse | null
  projectId: string | null
  setResult: (result: SolveResponse | null, projectId: string | null) => void
}

export const useSolveStore = create<SolveState>()((set) => ({
  result: null,
  projectId: null,
  setResult: (result, projectId) => set({ result, projectId }),
}))

/** Generate a plan for the current project and store it in the project. */
export function useSolve() {
  const setResult = useSolveStore((s) => s.setResult)
  return useMutation({
    mutationFn: async () => {
      const project = useProjectStore.getState().project
      if (!project) throw new AppError('errors.unknown')
      // Pinned (hand-edited) shifts are kept as they are; everything else is planned anew.
      const pinned = project.plan?.shifts.filter((s) => s.pinned) ?? []
      const { data, error } = await api.POST('/api/solve', {
        body: { ...project, plan: { shifts: pinned } },
      })
      if (data === undefined)
        throw isApiError(error) ? fromApiError(error) : new AppError('errors.unknown')
      return { data, projectId: project.id }
    },
    onSuccess: ({ data, projectId }) => {
      setResult(data, projectId)
      if (data.plan) replacePlan(data.plan)
    },
  })
}
