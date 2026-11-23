import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import type { AvailabilityEntry, CalendarDay } from '@/api/types'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/utils'

import { describeEntry } from './describe'
import { KindIcon } from './kind-badge'
import { entriesOn, KIND_STYLE, strongest, windowOf, type Kind } from './model'
import { useDragSelect } from './use-drag-select'
import { useQuickAdd } from './use-quick-add'

interface MonthCalendarProps {
  days: CalendarDay[]
  employeeId: string
  entries: AvailabilityEntry[]
  mode: Kind
}

/** One person's month. Click a day to toggle the current mode; drag across days for a range. */
export function MonthCalendar({ days, employeeId, entries, mode }: MonthCalendarProps) {
  const { t } = useTranslation()
  const format = useFormat()
  const { toggleDate, addRange } = useQuickAdd()
  const onCommit = useCallback(
    (d: { employeeId: string; from: string; to: string }) =>
      addRange(d.employeeId, d.from, d.to, mode),
    [addRange, mode],
  )
  const drag = useDragSelect(onCommit)
  const leading = days[0]?.weekday ?? 0

  return (
    <div className="grid gap-2 select-none">
      <div className="grid grid-cols-7 gap-1.5" aria-hidden>
        {format.weekdays('short').map((name) => (
          <div key={name} className="text-center text-xs font-medium text-muted-foreground">
            {name}
          </div>
        ))}
      </div>
      <div
        role="grid"
        aria-label={t('availability.calendarLabel')}
        className="grid grid-cols-7 gap-1.5"
      >
        {Array.from({ length: leading }, (_, i) => (
          <div key={`blank-${i}`} aria-hidden />
        ))}
        {days.map((day) => {
          const here = entriesOn(entries, employeeId, day)
          const top = strongest(here)
          const kinds = [...new Set(here.map((e) => e.kind))]
          const weekend = day.weekday >= 5 || day.holiday !== null
          const label = [
            format.weekdayDate(day.date),
            day.holiday ? t(`calendar.holidays.${day.holiday}`) : null,
            ...here.map(
              (e) => `${t(`availability.kinds.${e.kind}`)}: ${describeEntry(e, t, format)}`,
            ),
          ]
            .filter(Boolean)
            .join('. ')
          return (
            <button
              key={day.date}
              type="button"
              role="gridcell"
              aria-label={label}
              className={cn(
                'relative flex aspect-[5/4] min-h-14 flex-col items-start justify-between rounded-lg border p-1.5 text-left transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                weekend ? 'bg-muted/60' : 'bg-card',
                top && KIND_STYLE[top.kind].cell,
                top && windowOf(top.pattern) && 'border-2',
                drag.isSelected(employeeId, day.date) && 'ring-2 ring-primary',
                'hover:border-foreground/40',
              )}
              {...drag.cellProps(employeeId, day.date)}
              onClick={(event) => {
                // Pointer clicks are handled by the drag hook; this is for Enter/Space.
                if (event.detail === 0) toggleDate(employeeId, day.date, mode)
              }}
            >
              <span className="flex w-full items-center justify-between">
                <span className="text-sm font-medium tabular-nums">
                  {Number(day.date.slice(8))}
                </span>
                {day.holiday && (
                  <span
                    className="size-1.5 rounded-full bg-primary/70"
                    title={t(`calendar.holidays.${day.holiday}`)}
                  />
                )}
              </span>
              <span className="flex flex-wrap items-center gap-1">
                {kinds.map((kind) => (
                  <KindIcon key={kind} kind={kind} />
                ))}
                {top && windowOf(top.pattern) && (
                  <span
                    className={cn(
                      'text-[0.65rem] leading-none tabular-nums',
                      KIND_STYLE[top.kind].text,
                    )}
                  >
                    {windowOf(top.pattern)!.start ?? ''}–{windowOf(top.pattern)!.end ?? ''}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
