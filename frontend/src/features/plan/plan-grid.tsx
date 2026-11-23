import { Pin } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type {
  AvailabilityEntry,
  CalendarDay,
  Employee,
  EmployeeStats,
  Shift,
  Violation,
} from '@/api/types'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { KindIcon } from '@/features/availability/kind-badge'
import { entriesOn, strongest } from '@/features/availability/model'
import { describeViolation } from '@/features/generate/describe-violation'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/utils'

import { editPlan } from './history'
import { cellKey, shiftHours, worstSeverity, type ViolationIndex } from './indexes'
import { ShiftEditor } from './shift-editor'

interface PlanGridProps {
  days: CalendarDay[]
  employees: Employee[]
  shifts: Map<string, Shift[]>
  availability: AvailabilityEntry[]
  violations: ViolationIndex
  stats: Map<string, EmployeeStats>
  focus: { row: number; col: number }
  onFocus: (focus: { row: number; col: number }) => void
}

export function PlanGrid({
  days,
  employees,
  shifts,
  availability,
  violations,
  stats,
  focus,
  onFocus,
}: PlanGridProps) {
  const { t } = useTranslation()
  const format = useFormat()
  const [editing, setEditing] = useState<string | null>(null)
  const cells = useRef(new Map<string, HTMLTableCellElement>())
  const short = format.weekdays('short')

  const describe = (list: Violation[] | undefined) =>
    (list ?? []).map((v) => describeViolation(v, t, format, employees))

  const move = (row: number, col: number) => {
    const r = Math.max(0, Math.min(employees.length - 1, row))
    const c = Math.max(0, Math.min(days.length - 1, col))
    onFocus({ row: r, col: c })
    cells.current.get(`${r}:${c}`)?.focus()
  }

  const onKeyDown = (event: KeyboardEvent, row: number, col: number, key: string) => {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      Home: [0, -col],
      End: [0, days.length - 1 - col],
    }
    const delta = moves[event.key]
    if (delta) {
      event.preventDefault()
      move(row + delta[0], col + delta[1])
    } else if (event.key === 'Enter' || event.key === 'F2' || event.key === ' ') {
      event.preventDefault()
      setEditing(key)
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      const ids = new Set((shifts.get(key) ?? []).map((s) => s.id))
      if (ids.size) {
        event.preventDefault()
        editPlan((plan) => {
          plan.shifts = plan.shifts.filter((s) => !ids.has(s.id))
        })
      }
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table
        role="grid"
        aria-label={t('plan.gridLabel')}
        className="w-max min-w-full border-separate border-spacing-0 text-xs"
      >
        <thead>
          <tr>
            <th className="sticky left-0 z-20 min-w-40 border-b bg-card px-3 py-2 text-left text-sm font-medium">
              {t('employees.name')}
            </th>
            {days.map((day) => {
              const dayViolations = violations.byDay.get(day.date)
              const severity = worstSeverity(dayViolations)
              return (
                <th
                  key={day.date}
                  scope="col"
                  className={cn(
                    'min-w-[5.25rem] border-b border-l px-1 py-1 text-center font-normal',
                    (day.weekday >= 5 || day.holiday) && 'bg-muted/70',
                  )}
                  title={day.holiday ? t(`calendar.holidays.${day.holiday}`) : undefined}
                >
                  <div className="text-muted-foreground capitalize">{short[day.weekday]}</div>
                  <div
                    className={cn(
                      'text-sm font-medium tabular-nums',
                      day.holiday && 'text-primary underline',
                    )}
                  >
                    {Number(day.date.slice(8))}
                  </div>
                  {severity && (
                    <span
                      className={cn(
                        'mx-auto mt-0.5 block h-1 w-6 rounded-full',
                        severity === 'error' ? 'bg-destructive' : 'bg-amber-500',
                      )}
                    />
                  )}
                </th>
              )
            })}
            <th className="sticky right-0 z-20 min-w-56 border-b border-l bg-card px-3 py-2 text-right text-sm font-medium">
              {t('plan.summary')}
            </th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee, row) => {
            const s = stats.get(employee.id)
            const monthIssues = violations.byEmployee.get(employee.id)
            return (
              <tr key={employee.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-b bg-card px-3 py-1 text-left text-sm font-normal"
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: employee.color }}
                    />
                    <span className="truncate">{employee.name}</span>
                  </span>
                </th>
                {days.map((day, col) => {
                  const key = cellKey(employee.id, day.date)
                  const cellShifts = shifts.get(key) ?? []
                  const issues = violations.byCell.get(key)
                  const severity = worstSeverity(issues)
                  const hint = strongest(entriesOn(availability, employee.id, day))
                  const messages = describe(issues)
                  const label = [
                    `${employee.name}, ${format.weekdayDate(day.date)}`,
                    cellShifts.length
                      ? cellShifts
                          .map(
                            (x) =>
                              `${x.start}–${x.end}${x.pinned ? ` (${t('plan.pinnedShort')})` : ''}`,
                          )
                          .join(', ')
                      : t('plan.noShift'),
                    hint ? t(`availability.kinds.${hint.kind}`) : null,
                    ...messages,
                  ]
                    .filter(Boolean)
                    .join('. ')
                  const focused = focus.row === row && focus.col === col
                  // ARIA grid pattern: the <td> itself is the focusable gridcell.
                  const gridCell = (
                    <td
                      role="gridcell"
                      aria-label={label}
                      aria-invalid={severity === 'error' || undefined}
                      tabIndex={focused ? 0 : -1}
                      ref={(el) => {
                        if (el) cells.current.set(`${row}:${col}`, el)
                        else cells.current.delete(`${row}:${col}`)
                      }}
                      onClick={() => {
                        onFocus({ row, col })
                        setEditing(key)
                      }}
                      onKeyDown={(e) => onKeyDown(e, row, col, key)}
                      className={cn(
                        'cursor-pointer border-b border-l p-0.5 outline-none',
                        'focus-visible:[&>div]:ring-2 focus-visible:[&>div]:ring-ring',
                        (day.weekday >= 5 || day.holiday) && 'bg-muted/40',
                      )}
                    >
                      <div
                        className={cn(
                          'relative flex h-11 w-full flex-col items-center justify-center rounded-md px-0.5 tabular-nums transition-colors hover:bg-accent',
                          cellShifts.length > 0 && 'bg-primary/5 font-medium',
                          severity === 'error' && 'bg-destructive/10 ring-2 ring-destructive',
                          severity === 'warning' && 'ring-1 ring-amber-500',
                        )}
                        style={
                          cellShifts.length
                            ? { boxShadow: `inset 3px 0 0 ${employee.color}` }
                            : undefined
                        }
                      >
                        {cellShifts.map((x) => (
                          <span key={x.id} className="leading-tight whitespace-nowrap">
                            {x.start}–{x.end}
                          </span>
                        ))}
                        {cellShifts.some((x) => x.pinned) && (
                          <Pin
                            aria-hidden
                            className="absolute top-0.5 right-0.5 size-2.5 text-muted-foreground"
                          />
                        )}
                        {!cellShifts.length && hint && (
                          <KindIcon kind={hint.kind} className="size-3 opacity-60" />
                        )}
                      </div>
                    </td>
                  )
                  return (
                    <Popover
                      key={day.date}
                      open={editing === key}
                      onOpenChange={(open) => !open && setEditing(null)}
                    >
                      {messages.length ? (
                        <Tooltip>
                          <PopoverAnchor asChild>
                            <TooltipTrigger asChild>{gridCell}</TooltipTrigger>
                          </PopoverAnchor>
                          <TooltipContent className="max-w-72">
                            <ul className="grid gap-1">
                              {messages.map((m, i) => (
                                <li key={i}>{m}</li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <PopoverAnchor asChild>{gridCell}</PopoverAnchor>
                      )}
                      <PopoverContent className="w-80" align="start">
                        {editing === key && (
                          <ShiftEditor
                            employeeId={employee.id}
                            date={day.date}
                            shift={cellShifts[0]}
                            title={`${employee.name} · ${format.weekdayDate(day.date)}`}
                            onDone={() => {
                              setEditing(null)
                              cells.current.get(`${row}:${col}`)?.focus()
                            }}
                          />
                        )}
                      </PopoverContent>
                    </Popover>
                  )
                })}
                <td
                  className={cn(
                    'sticky right-0 z-10 border-b border-l bg-card px-3 py-1 text-right text-xs tabular-nums',
                    monthIssues?.length && 'text-destructive',
                  )}
                  title={describe(monthIssues).join('\n') || undefined}
                >
                  {s ? (
                    <span className="grid grid-cols-[auto_auto] justify-end gap-x-2">
                      <span className="text-muted-foreground">{t('plan.plannedOf')}</span>
                      <span>
                        {format.number(s.plannedHours)} / {format.hours(s.targetHours)}
                      </span>
                      <span className="text-muted-foreground">{t('plan.balance')}</span>
                      <span className="font-medium">
                        {format.signedHours(s.deviationHours)} →{' '}
                        {format.signedHours(s.newBalanceHours)}
                      </span>
                    </span>
                  ) : (
                    '…'
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-sm font-medium">
              {t('plan.dayTotal')}
            </th>
            {days.map((day) => {
              const dayShifts = employees.flatMap((e) => shifts.get(cellKey(e.id, day.date)) ?? [])
              const hours = dayShifts.reduce((sum, x) => sum + shiftHours(x), 0)
              const dayViolations = violations.byDay.get(day.date)
              const severity = worstSeverity(dayViolations)
              const messages = describe(dayViolations)
              const content = (
                <div
                  className={cn(
                    'rounded-md px-1 py-1 text-center tabular-nums',
                    severity === 'error' && 'bg-destructive/10 font-medium text-destructive',
                    severity === 'warning' && 'bg-amber-500/10',
                  )}
                  tabIndex={messages.length ? 0 : undefined}
                  aria-label={
                    messages.length
                      ? `${format.weekdayDate(day.date)}: ${messages.join(' ')}`
                      : undefined
                  }
                >
                  <div>
                    {t('plan.people', { count: new Set(dayShifts.map((x) => x.employeeId)).size })}
                  </div>
                  <div className="text-muted-foreground">{format.hours(hours)}</div>
                </div>
              )
              return (
                <td key={day.date} className="border-l p-0.5">
                  {messages.length ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{content}</TooltipTrigger>
                      <TooltipContent className="max-w-72">
                        <ul className="grid gap-1">
                          {messages.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    content
                  )}
                </td>
              )
            })}
            <td className="sticky right-0 z-10 border-l bg-card" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
