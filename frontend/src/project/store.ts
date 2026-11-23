import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import type { Project } from '@/api/types'

interface ProjectState {
  project: Project | null
  setProject: (project: Project | null) => void
  /** Mutate the current project in place (Immer draft). No-op without a project. */
  updateProject: (recipe: (draft: Project) => void) => void
}

export const useProjectStore = create<ProjectState>()(
  immer((set) => ({
    project: null,
    setProject: (project) => set({ project }),
    updateProject: (recipe) =>
      set((state) => {
        if (state.project) recipe(state.project)
      }),
  })),
)
