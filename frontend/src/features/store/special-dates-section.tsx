import { CalendarPlus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useMonthCalendar } from '@/api/queries'
import type { CalendarDay, StoreSettings } from '@/api/types'
import { Section } from '@/components/form/section'
import { TimeInput } from '@/components/form/time-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { minutesToTime, timeToMinutes, useFormat } from '@/lib/format'
import { useProject, useUpdateProject } from '@/project/hooks'
import { isValidWindow, regularHours } from '@/project/store-hours'

type SpecialDate = StoreSettings['specialDates'][number]

interface Row {
  day: CalendarDay
  special: SpecialDate | undefined
}

export function SpecialDatesSection() {
  const { t } = useTranslation()
  const format = useFormat()
  const project = useProject()
  const update = useUpdateProject()
  const calendar = useMonthCalendar(project.month)
  const [newDate, setNewDate] = useState('')

  const days = calendar.data?.days ?? []
  const specials = new Map(project.store.specialDates.map((s) => [s.date, s]))
  const rows: Row[] = days
    .filter((day) => day.holiday || day.notable || specials.has(day.date))
    .map((day) => ({ day, special: specials.get(day.date) }))

  /** Create the special date on first use, defaulting to closing an hour early. */
  const patch = (day: CalendarDay, change: Partial<SpecialDate>) =>
    update((p) => {
      let entry = p.store.specialDates.find((s) => s.date === day.date)
      if (!entry) {
        const normal = regularHours(p.store, day)
        entry = {
          date: day.date,
          enabled: false,
          closed: false,
          opens: normal.opens,
          closes: minutesToTime(
            Math.max(timeToMinutes(normal.opens) + 60, timeToMinutes(normal.closes) - 60),
          ),
          note: '',
        }
        p.store.specialDates.push(entry)
      }
      Object.assign(entry, change)
    })

  const remove = (date: string) =>
    update((p) => {
      p.store.specialDates = p.store.specialDates.filter((s) => s.date !== date)
    })

  const addDate = () => {
    const day = days.find((d) => d.date === newDate)
    if (!day) return
    patch(day, { enabled: true })
    setNewDate('')
  }

  return (
    <Section title={t('store.specialTitle')} description={t('store.specialDescription')}>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {t('store.noSpecialDates')}
        </p>
      ) : (
        <ul className="grid gap-2">
          {rows.map(({ day, special }) => {
            const enabled = special?.enabled ?? false
            const custom = !day.holiday && !day.notable
            const label = day.holiday
              ? t(`calendar.holidays.${day.holiday}`)
              : day.notable
                ? t(`calendar.notable.${day.notable}`)
                : t('store.customDate')
            const valid = !special || special.closed || isValidWindow(special.opens, special.closes)
            return (
              <li key={day.date} className="grid gap-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-block w-24 text-sm font-medium tabular-nums first-letter:uppercase">
                    {format.weekdayDate(day.date)}
                  </span>
                  <span className="text-sm">{label}</span>
                  {day.holiday && <Badge variant="secondary">{t('store.publicHoliday')}</Badge>}
                  {day.notable && <Badge variant="outline">{t('store.notableDay')}</Badge>}
                  <div className="ml-auto flex items-center gap-2">
                    <Label
                      htmlFor={`special-${day.date}`}
                      className="text-xs text-muted-foreground"
                    >
                      {t('store.specialHours')}
                    </Label>
                    <Switch
                      id={`special-${day.date}`}
                      checked={enabled}
                      onCheckedChange={(on) => patch(day, { enabled: on })}
                    />
                    {custom && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('store.removeDate')}
                        onClick={() => remove(day.date)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {enabled && special && (
                  <div className="flex flex-wrap items-center gap-3 pl-0 sm:pl-26">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={special.closed}
                        onCheckedChange={(c) => patch(day, { closed: c === true })}
                      />
                      {t('store.closedAllDay')}
                    </label>
                    {!special.closed && (
                      <>
                        <TimeInput
                          value={special.opens}
                          stepMinutes={15}
                          aria-label={t('store.opensOn', { day: label })}
                          aria-invalid={!valid || undefined}
                          onValueChange={(v) => v && patch(day, { opens: v })}
                        />
                        <span aria-hidden className="text-muted-foreground">
                          –
                        </span>
                        <TimeInput
                          value={special.closes}
                          stepMinutes={15}
                          aria-label={t('store.closesOn', { day: label })}
                          aria-invalid={!valid || undefined}
                          onValueChange={(v) => v && patch(day, { closes: v })}
                        />
                        {!valid && (
                          <span role="alert" className="text-xs text-destructive">
                            {t('store.closesBeforeOpens')}
                          </span>
                        )}
                      </>
                    )}
                    <Input
                      value={special.note}
                      maxLength={200}
                      placeholder={t('store.notePlaceholder')}
                      aria-label={t('store.note')}
                      className="min-w-40 flex-1"
                      onChange={(e) => patch(day, { note: e.target.value })}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="special-new">{t('store.addDateLabel')}</Label>
          <Input
            id="special-new"
            type="date"
            className="w-44"
            min={days[0]?.date}
            max={days.at(-1)?.date}
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
        </div>
        <Button variant="outline" disabled={!newDate} onClick={addDate}>
          <CalendarPlus aria-hidden className="size-4" />
          {t('store.addDate')}
        </Button>
      </div>
    </Section>
  )
}
