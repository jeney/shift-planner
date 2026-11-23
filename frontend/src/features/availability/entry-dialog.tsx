import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AvailabilityEntry } from '@/api/types'
import { Field } from '@/components/form/field'
import { SwitchField } from '@/components/form/switch-field'
import { TimeInput } from '@/components/form/time-input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useFormat } from '@/lib/format'
import { newId } from '@/lib/ids'
import { useUpdateProject } from '@/project/hooks'

import { KindChip } from './kind-badge'
import { KINDS, type Kind } from './model'
import { WeightToggle } from './weight-toggle'

type Shape = AvailabilityEntry['pattern']['type']

interface EntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeId: string
  initialKind: Kind
  firstDate: string
  lastDate: string
}

export function EntryDialog(props: EntryDialogProps) {
  // Remount the form each time the dialog opens so it starts fresh.
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {props.open && <EntryForm {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function EntryForm({
  onOpenChange,
  employeeId,
  initialKind,
  firstDate,
  lastDate,
}: EntryDialogProps) {
  const { t } = useTranslation()
  const format = useFormat()
  const update = useUpdateProject()
  const [kind, setKind] = useState<Kind>(initialKind)
  const [shape, setShape] = useState<Shape>('weekly')
  const [weekday, setWeekday] = useState(0)
  const [date, setDate] = useState(firstDate)
  const [startDate, setStartDate] = useState(firstDate)
  const [endDate, setEndDate] = useState(firstDate)
  const [partOfDay, setPartOfDay] = useState(false)
  const [start, setStart] = useState<string | null>('16:00')
  const [end, setEnd] = useState<string | null>(null)
  const [weight, setWeight] = useState(1)
  const [note, setNote] = useState('')

  const windowValid = !partOfDay || ((start || end) && (!start || !end || start < end))
  const valid =
    windowValid &&
    (shape === 'weekly' ||
      (shape === 'date' && date) ||
      (shape === 'range' && startDate && endDate && startDate <= endDate))

  const save = () => {
    const window = partOfDay ? { start, end } : { start: null, end: null }
    const pattern: AvailabilityEntry['pattern'] =
      shape === 'weekly'
        ? { type: 'weekly', weekday, ...window }
        : shape === 'date'
          ? { type: 'date', date, ...window }
          : { type: 'range', startDate, endDate }
    update((p) => {
      p.availability.push({ id: newId(), employeeId, kind, pattern, weight, note: note.trim() })
    })
    onOpenChange(false)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('availability.addTitle')}</DialogTitle>
        <DialogDescription>{t('availability.addDescription')}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <RadioGroup value={kind} onValueChange={(v) => setKind(v as Kind)} className="grid gap-2">
          {KINDS.map((k) => (
            <label key={k} className="flex items-center gap-3">
              <RadioGroupItem value={k} aria-label={t(`availability.kinds.${k}`)} />
              <KindChip kind={k} />
            </label>
          ))}
        </RadioGroup>

        <div className="grid gap-1.5">
          <Label>{t('availability.when')}</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            value={shape}
            onValueChange={(v) => v && setShape(v as Shape)}
            className="justify-start"
          >
            <ToggleGroupItem value="weekly">{t('availability.shapes.weekly')}</ToggleGroupItem>
            <ToggleGroupItem value="date">{t('availability.shapes.date')}</ToggleGroupItem>
            <ToggleGroupItem value="range">{t('availability.shapes.range')}</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {shape === 'weekly' && (
          <Field label={t('availability.weekday')}>
            <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
              <SelectTrigger aria-label={t('availability.weekday')} className="w-48 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {format.weekdays('long').map((name, i) => (
                  <SelectItem key={name} value={String(i)} className="capitalize">
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {shape === 'date' && (
          <Field label={t('availability.date')} htmlFor="entry-date">
            <Input
              id="entry-date"
              type="date"
              className="w-44"
              min={firstDate}
              max={lastDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        )}
        {shape === 'range' && (
          <div className="flex flex-wrap gap-4">
            <Field label={t('availability.firstDay')} htmlFor="entry-start">
              <Input
                id="entry-start"
                type="date"
                className="w-44"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field label={t('availability.lastDay')} htmlFor="entry-end">
              <Input
                id="entry-end"
                type="date"
                className="w-44"
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          </div>
        )}

        {shape !== 'range' && (
          <div className="grid gap-3">
            <SwitchField
              label={t('availability.partOfDay')}
              help={t('availability.partOfDayHelp')}
              checked={partOfDay}
              onCheckedChange={setPartOfDay}
            />
            {partOfDay && (
              <div className="flex flex-wrap items-end gap-3">
                <Field label={t('availability.fromTime')}>
                  <TimeInput
                    nullable
                    value={start}
                    aria-label={t('availability.fromTime')}
                    onValueChange={setStart}
                  />
                </Field>
                <Field label={t('availability.untilTime')}>
                  <TimeInput
                    nullable
                    value={end}
                    aria-label={t('availability.untilTime')}
                    onValueChange={setEnd}
                  />
                </Field>
                {!windowValid && (
                  <p role="alert" className="text-xs text-destructive">
                    {t('availability.windowInvalid')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {kind !== 'unavailable' && (
          <div className="grid gap-1.5">
            <Label>{t('availability.importance')}</Label>
            <WeightToggle value={weight} onChange={setWeight} />
          </div>
        )}

        <Field label={t('store.note')} htmlFor="entry-note">
          <Input
            id="entry-note"
            value={note}
            maxLength={200}
            placeholder={t('availability.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t('common.cancel')}
        </Button>
        <Button disabled={!valid} onClick={save}>
          {t('availability.save')}
        </Button>
      </DialogFooter>
    </>
  )
}
