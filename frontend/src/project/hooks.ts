import type { Project } from '@/api/types'

import { useProjectStore } from './store'

/** The current project. Only use inside screens that render when a project is loaded. */
export function useProject(): Project {
  const project = useProjectStore((s) => s.project)
  if (!project) throw new Error('useProject() used without a loaded project')
  return project
}

export function useUpdateProject() {
  return useProjectStore((s) => s.updateProject)
}
