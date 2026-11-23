import { Pin, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Shift } from '@/api/types'
import { SwitchField } from '@/components/form/switch-field'
import { TimeInput } from '@/components/form/time-input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { newId } from '@/lib/ids'

import { editPlan } from './history'

interface ShiftEditorProps {
  employeeId: string
  date: string
  shift: Shift | undefined
  title: string
  onDone: () => void
}

/** Add, change or remove one shift. Hand edits are pinned so re-generating keeps them. */
export function ShiftEditor({ employeeId, date, shift, title, onDone }: ShiftEditorProps) {
  const { t } = useTranslation()
  const [start, setStart] = useState<string | null>(shift?.start ?? '09:00')
  const [end, setEnd] = useState<string | null>(shift?.end ?? '17:00')
  // Saving a hand edit pins it (re-generating keeps it); the switch lets you opt out.
  const [pinned, setPinned] = useState(true)
  const valid = start !== null && end !== null && start < end

  const save = () => {
    if (!valid) return
    editPlan((plan) => {
      const existing = shift && plan.shifts.find((s) => s.id === shift.id)
      if (existing) Object.assign(existing, { start, end, pinned })
      else plan.shifts.push({ id: newId(), employeeId, date, start, end, pinned })
    })
    onDone()
  }

  const remove = () => {
    if (shift) {
      editPlan((plan) => {
        plan.shifts = plan.shifts.filter((s) => s.id !== shift.id)
      })
    }
    onDone()
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <p className="text-sm font-medium">{title}</p>
      <div className="flex items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="shift-start">{t('plan.start')}</Label>
          <TimeInput id="shift-start" value={start} nullable onValueChange={setStart} autoFocus />
        </div>
        <span aria-hidden className="pb-2 text-muted-foreground">
          –
        </span>
        <div className="grid gap-1.5">
          <Label htmlFor="shift-end">{t('plan.end')}</Label>
          <TimeInput id="shift-end" value={end} nullable onValueChange={setEnd} />
        </div>
      </div>
      {!valid && (
        <p role="alert" className="text-xs text-destructive">
          {t('plan.invalidTimes')}
        </p>
      )}
      <SwitchField
        label={
          <span className="flex items-center gap-1.5">
            <Pin aria-hidden className="size-3.5" />
            {t('plan.pinned')}
          </span>
        }
        help={t('plan.pinnedHelp')}
        checked={pinned}
        onCheckedChange={setPinned}
      />
      <div className="flex items-center justify-between gap-2">
        {shift ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={remove}
          >
            <Trash2 aria-hidden className="size-4" />
            {t('plan.remove')}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onDone}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={!valid}>
            {shift ? t('plan.save') : t('plan.add')}
          </Button>
        </div>
      </div>
    </form>
  )
}
