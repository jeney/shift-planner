import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MonthPicker } from '@/components/month-picker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { nextMonth } from '@/lib/month'

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (month: string) => Promise<boolean>
  busy: boolean
}

export function NewProjectDialog({ open, onOpenChange, onCreate, busy }: NewProjectDialogProps) {
  const { t } = useTranslation()
  const [month, setMonth] = useState(nextMonth)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('project.newTitle')}</DialogTitle>
          <DialogDescription>{t('project.newDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="new-project-month">{t('project.month')}</Label>
          <MonthPicker id="new-project-month" value={month} onChange={setMonth} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              if (await onCreate(month)) onOpenChange(false)
            }}
          >
            {t('project.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
