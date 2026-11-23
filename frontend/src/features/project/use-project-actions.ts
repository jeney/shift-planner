import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { fetchDemoProject, fetchNewProject } from '@/api/project-api'
import type { Project } from '@/api/types'
import { toAppError } from '@/lib/errors'
import { formatMonth } from '@/lib/month'
import { downloadProject, loadProjectFile } from '@/project/file'
import { useProjectStore } from '@/project/store'

export type ProjectAction = 'new' | 'demo' | 'open'

export function useProjectActions() {
  const { t, i18n } = useTranslation()
  const project = useProjectStore((s) => s.project)
  const setProject = useProjectStore((s) => s.setProject)
  const [busy, setBusy] = useState<ProjectAction | null>(null)

  async function run(action: ProjectAction, load: () => Promise<Project>, success: string) {
    setBusy(action)
    try {
      const loaded = await load()
      setProject(loaded)
      toast.success(success)
      return true
    } catch (error) {
      const appError = toAppError(error)
      toast.error(t(appError.key, appError.params), {
        description: appError.details.slice(0, 5).join('\n') || undefined,
      })
      return false
    } finally {
      setBusy(null)
    }
  }

  return {
    busy,
    hasProject: project !== null,
    createNew: (month: string) =>
      run(
        'new',
        () => fetchNewProject(month),
        t('project.created', {
          month: formatMonth(month, i18n.language),
        }),
      ),
    loadDemo: (month: string) =>
      run('demo', () => fetchDemoProject(month), t('project.demoLoaded')),
    openFile: (file: File) => run('open', () => loadProjectFile(file), t('project.opened')),
    save: () => {
      if (!project) return
      const fileName = downloadProject(project)
      toast.success(t('project.saved', { file: fileName }))
    },
  }
}
