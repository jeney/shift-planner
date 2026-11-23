import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import type { AvailabilityEntry, CalendarDay, Employee } from '@/api/types'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/utils'

import { describeEntry } from './describe'
import { KindIcon } from './kind-badge'
import { entriesOn, KIND_STYLE, strongest, windowOf, type Kind } from './model'
import { useDragSelect } from './use-drag-select'
import { useQuickAdd } from './use-quick-add'

interface TeamOverviewProps {
  days: CalendarDay[]
  employees: Employee[]
  entries: AvailabilityEntry[]
  mode: Kind
  onSelectEmployee: (id: string) => void
}

/** Everyone × every day. Same click/drag editing as the person calendar. */
export function TeamOverview({
  days,
  employees,
  entries,
  mode,
  onSelectEmployee,
}: TeamOverviewProps) {
  const { t } = useTranslation()
  const format = useFormat()
  const { toggleDate, addRange } = useQuickAdd()
  const onCommit = useCallback(
    (d: { employeeId: string; from: string; to: string }) =>
      addRange(d.employeeId, d.from, d.to, mode),
    [addRange, mode],
  )
  const drag = useDragSelect(onCommit)
  const short = format.weekdays('short')

  return (
    <div className="overflow-x-auto rounded-lg border select-none">
      <table className="w-full border-collapse text-sm" aria-label={t('availability.teamLabel')}>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-40 border-b bg-card px-3 py-2 text-left font-medium">
              {t('employees.name')}
            </th>
            {days.map((day) => (
              <th
                key={day.date}
                scope="col"
                className={cn(
                  'min-w-9 border-b border-l px-0.5 py-1 text-center text-xs font-normal',
                  (day.weekday >= 5 || day.holiday) && 'bg-muted/60',
                )}
                title={day.holiday ? t(`calendar.holidays.${day.holiday}`) : undefined}
              >
                <div className="text-muted-foreground">{short[day.weekday].slice(0, 2)}</div>
                <div
                  className={cn(
                    'font-medium tabular-nums',
                    day.holiday && 'text-primary underline',
                  )}
                >
                  {Number(day.date.slice(8))}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <th
                scope="row"
                className="sticky left-0 z-10 border-b bg-card px-3 py-1 text-left font-normal"
              >
                <button
                  type="button"
                  className="flex items-center gap-2 hover:underline"
                  onClick={() => onSelectEmployee(employee.id)}
                >
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: employee.color }}
                  />
                  <span className="truncate">{employee.name}</span>
                </button>
              </th>
              {days.map((day) => {
                const here = entriesOn(entries, employee.id, day)
                const top = strongest(here)
                const label = [
                  `${employee.name}, ${format.weekdayDate(day.date)}`,
                  ...here.map(
                    (e) => `${t(`availability.kinds.${e.kind}`)}: ${describeEntry(e, t, format)}`,
                  ),
                ].join('. ')
                return (
                  <td
                    key={day.date}
                    className={cn(
                      'border-b border-l p-0.5',
                      (day.weekday >= 5 || day.holiday) && 'bg-muted/60',
                    )}
                  >
                    <button
                      type="button"
                      aria-label={label}
                      title={label}
                      className={cn(
                        'flex h-8 w-full items-center justify-center rounded border border-transparent',
                        'hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        top && KIND_STYLE[top.kind].cell,
                        drag.isSelected(employee.id, day.date) && 'ring-2 ring-primary',
                      )}
                      {...drag.cellProps(employee.id, day.date)}
                      onClick={(event) => {
                        if (event.detail === 0) toggleDate(employee.id, day.date, mode)
                      }}
                    >
                      {top && (
                        <KindIcon
                          kind={top.kind}
                          className={cn(windowOf(top.pattern) && 'size-3 opacity-70')}
                        />
                      )}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
