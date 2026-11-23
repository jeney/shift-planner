import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import type { Plan } from '@/api/types'
import { useProjectStore } from '@/project/store'

const LIMIT = 100
const EMPTY: Plan = { shifts: [] }

interface HistoryState {
  projectId: string | null
  past: Plan[]
  future: Plan[]
}

/** Undo/redo for the plan. Plans are immutable snapshots (Immer), so we keep references. */
export const useHistory = create<HistoryState>()(() => ({ projectId: null, past: [], future: [] }))

function current() {
  const project = useProjectStore.getState().project
  return { project, plan: project?.plan ?? EMPTY }
}

function record(before: Plan) {
  const { project } = current()
  const state = useHistory.getState()
  const past = state.projectId === project?.id ? state.past : []
  useHistory.setState({
    projectId: project?.id ?? null,
    past: [...past, before].slice(-LIMIT),
    future: [],
  })
}

/** Change the plan as one undoable step. */
export function editPlan(recipe: (plan: Plan) => void) {
  const { project, plan } = current()
  if (!project) return
  useProjectStore.getState().updateProject((p) => {
    p.plan ??= { shifts: [] }
    recipe(p.plan)
  })
  record(plan)
}

/** Replace the plan (e.g. with a generated one) as one undoable step. */
export function replacePlan(next: Plan | null) {
  const { project, plan } = current()
  if (!project) return
  useProjectStore.getState().updateProject((p) => {
    p.plan = next
  })
  record(plan)
}

function step(from: 'past' | 'future') {
  const { project, plan } = current()
  const state = useHistory.getState()
  if (!project || state.projectId !== project.id) return
  const stack = state[from]
  const target = stack.at(-1)
  if (!target) return
  useProjectStore.getState().updateProject((p) => {
    p.plan = target
  })
  useHistory.setState(
    from === 'past'
      ? { past: stack.slice(0, -1), future: [...state.future, plan] }
      : { future: stack.slice(0, -1), past: [...state.past, plan] },
  )
}

export const undo = () => step('past')
export const redo = () => step('future')

export function useCanUndoRedo() {
  const projectId = useProjectStore((s) => s.project?.id)
  return useHistory(
    useShallow((s) => ({
      canUndo: s.projectId === projectId && s.past.length > 0,
      canRedo: s.projectId === projectId && s.future.length > 0,
    })),
  )
}
