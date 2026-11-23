import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { formatMonth } from '@/lib/month'
import { useProjectStore } from '@/project/store'

export function ProjectTitle() {
  const { i18n } = useTranslation()
  const project = useProjectStore((s) => s.project)
  if (!project) return null
  return (
    <div className="hidden min-w-0 items-center gap-2 md:flex">
      <span className="truncate text-sm font-medium">{project.store.name}</span>
      <Badge variant="secondary" className="capitalize">
        {formatMonth(project.month, i18n.language)}
      </Badge>
    </div>
  )
}
