import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api } from '@/api/client'
import { fetchDemoProject, fetchNewProject } from '@/api/project-api'
import type { Project } from '@/api/types'
import { toAppError } from '@/lib/errors'
import { formatMonth } from '@/lib/month'
import { downloadProject, loadProjectFile } from '@/project/file'
import { nextMonthProject } from '@/project/next-month'
import { useProjectStore } from '@/project/store'

export type ProjectAction = 'new' | 'demo' | 'open' | 'next'

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
    startNextMonth: () =>
      run(
        'next',
        async () => {
          if (!project) throw new Error('no project')
          // Resulting balances come from the backend's validator (the single source of truth).
          let stats = new Map()
          if (project.plan?.shifts.length) {
            const { data, error } = await api.POST('/api/validate', { body: project })
            if (!data) throw error ?? new Error('validate failed')
            stats = new Map(data.stats.map((s) => [s.employeeId, s]))
          }
          return nextMonthProject(project, stats)
        },
        t('project.nextMonthDone'),
      ),
    save: () => {
      if (!project) return
      const fileName = downloadProject(project)
      toast.success(t('project.saved', { file: fileName }))
    },
  }
}
