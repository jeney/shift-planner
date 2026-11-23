import { FilePlus2, FolderOpen, FolderKanban, Save, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { nextMonth } from '@/lib/month'
import { useProjectStore } from '@/project/store'

import { ConfirmReplace } from './confirm-replace'
import { ProjectFileInput } from './file-input'
import { NewProjectDialog } from './new-project-dialog'
import { useProjectActions } from './use-project-actions'

type Pending = 'new' | 'demo' | 'open' | null

export function ProjectMenu() {
  const { t } = useTranslation()
  const actions = useProjectActions()
  const month = useProjectStore((s) => s.project?.month)
  const fileInput = useRef<HTMLInputElement>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [confirm, setConfirm] = useState<Pending>(null)

  // Replacing an existing project always asks first.
  const guarded = (action: Exclude<Pending, null>) => {
    if (actions.hasProject) setConfirm(action)
    else proceed(action)
  }
  const proceed = (action: Exclude<Pending, null>) => {
    if (action === 'new') setNewOpen(true)
    if (action === 'demo') void actions.loadDemo(month ?? nextMonth())
    if (action === 'open') fileInput.current?.click()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <FolderKanban aria-hidden className="size-4" />
            {t('project.menu')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onSelect={() => guarded('new')}>
            <FilePlus2 aria-hidden /> {t('project.new')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => guarded('open')}>
            <FolderOpen aria-hidden /> {t('project.open')}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!actions.hasProject} onSelect={actions.save}>
            <Save aria-hidden /> {t('project.save')}
            <DropdownMenuShortcut>.json</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => guarded('demo')}>
            <Sparkles aria-hidden /> {t('project.demo')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectFileInput ref={fileInput} onFile={(file) => void actions.openFile(file)} />
      <NewProjectDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreate={actions.createNew}
        busy={actions.busy === 'new'}
      />
      <ConfirmReplace
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        onConfirm={() => {
          const action = confirm
          setConfirm(null)
          if (action) proceed(action)
        }}
      />
    </>
  )
}
