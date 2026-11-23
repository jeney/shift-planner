import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Loader2,
  PinOff,
  Redo2,
  Sparkles,
  Table2,
  Undo2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useMonthCalendar } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { describeViolation } from '@/features/generate/describe-violation'
import { useSolve } from '@/features/generate/use-solve'
import { toAppError } from '@/lib/errors'
import { useFormat } from '@/lib/format'
import { guestHours } from '@/lib/guests'
import { useProject } from '@/project/hooks'

import { editPlan, redo, replacePlan, undo, useCanUndoRedo } from './history'
import { indexViolations, shiftsByCell } from './indexes'
import { PlanGrid } from './plan-grid'
import { useValidate } from './use-validate'

export function PlanScreen() {
  const { t } = useTranslation()
  const format = useFormat()
  const project = useProject()
  const calendar = useMonthCalendar(project.month)
  const validate = useValidate(project)
  const solve = useSolve()
  const { canUndo, canRedo } = useCanUndoRedo()
  const [focus, setFocus] = useState({ row: 0, col: 0 })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null
      // Leave undo inside text fields to the browser.
      if (!(e.ctrlKey || e.metaKey) || target?.closest('input, textarea')) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const plan = project.plan
  const shifts = useMemo(() => shiftsByCell(plan?.shifts ?? []), [plan])
  const result = validate.data
  const violations = useMemo(() => indexViolations(result?.violations ?? []), [result])
  const stats = useMemo(
    () => new Map((result?.stats ?? []).map((s) => [s.employeeId, s])),
    [result],
  )
  const employees = project.employees.filter(
    (e) => e.active || plan?.shifts.some((s) => s.employeeId === e.id),
  )
  const guestTargets = useMemo(() => {
    const demand = project.guestDemand
    const targets = new Map<string, number>()
    if (!demand.enabled) return targets
    for (const [date, guests] of Object.entries(demand.guestsByDate)) {
      const hours = guestHours(guests, demand)
      if (hours !== null) targets.set(date, hours)
    }
    return targets
  }, [project.guestDemand])
  const pinnedCount = plan?.shifts.filter((s) => s.pinned).length ?? 0
  const errors = result?.violations.filter((v) => v.severity === 'error') ?? []
  const warnings = result?.violations.filter((v) => v.severity === 'warning') ?? []

  if (!plan) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
        <Table2 aria-hidden className="size-8 opacity-40" />
        <p className="font-medium text-foreground">{t('plan.emptyTitle')}</p>
        <p className="max-w-md text-sm">{t('plan.emptyBody')}</p>
        <Button variant="outline" onClick={() => replacePlan({ shifts: [] })}>
          {t('plan.planByHand')}
        </Button>
      </Card>
    )
  }

  return (
    <div className="grid gap-4">
      <Card className="flex flex-row flex-wrap items-center gap-2 px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          disabled={!canUndo}
          onClick={undo}
          aria-keyshortcuts="Control+Z"
        >
          <Undo2 aria-hidden className="size-4" />
          {t('plan.undo')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!canRedo}
          onClick={redo}
          aria-keyshortcuts="Control+Y"
        >
          <Redo2 aria-hidden className="size-4" />
          {t('plan.redo')}
        </Button>
        <div className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Button size="sm" disabled={solve.isPending} onClick={() => solve.mutate()}>
          {solve.isPending ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Sparkles aria-hidden className="size-4" />
          )}
          {pinnedCount ? t('plan.regenerateKeeping', { count: pinnedCount }) : t('plan.regenerate')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!pinnedCount}
          onClick={() =>
            editPlan((p) => {
              for (const s of p.shifts) s.pinned = false
            })
          }
        >
          <PinOff aria-hidden className="size-4" />
          {t('plan.unpinAll')}
        </Button>
        <span
          role="status"
          className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          {validate.checking ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" />
              {t('plan.checking')}
            </>
          ) : errors.length ? (
            <>
              <CircleAlert aria-hidden className="size-4 text-destructive" />
              {t('plan.errors', { count: errors.length })}
            </>
          ) : (
            <>
              <CheckCircle2 aria-hidden className="size-4 text-emerald-600" />
              {t('plan.allGood')}
              {warnings.length > 0 && ` · ${t('plan.warnings', { count: warnings.length })}`}
            </>
          )}
        </span>
      </Card>

      {solve.isError && (
        <p role="alert" className="text-sm text-destructive">
          {(() => {
            const e = toAppError(solve.error)
            return t(e.key, e.params)
          })()}
        </p>
      )}

      <p className="text-xs text-muted-foreground">{t('plan.keyboardHelp')}</p>

      <PlanGrid
        guestTargets={guestTargets}
        days={calendar.data?.days ?? []}
        employees={employees}
        shifts={shifts}
        availability={project.availability}
        violations={violations}
        stats={stats}
        focus={focus}
        onFocus={setFocus}
      />

      {(errors.length > 0 || warnings.length > 0) && (
        <Card className="grid gap-2 p-4">
          <h3 className="text-sm font-semibold">{t('generate.issuesTitle')}</h3>
          <ul className="grid gap-1.5" aria-label={t('plan.issuesLabel')}>
            {[...errors, ...warnings].map((v, i) => {
              const row = employees.findIndex((e) => e.id === v.employeeId)
              const col = (calendar.data?.days ?? []).findIndex((d) => d.date === v.date)
              const target = row >= 0 && col >= 0
              return (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {v.severity === 'error' ? (
                    <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
                  ) : (
                    <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  )}
                  {target ? (
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={() => {
                        setFocus({ row, col })
                        document
                          .querySelector<HTMLElement>(
                            `[role="grid"] tbody tr:nth-child(${row + 1}) td[role="gridcell"]:nth-of-type(${col + 1})`,
                          )
                          ?.focus()
                      }}
                    >
                      {describeViolation(v, t, format, project.employees)}
                    </button>
                  ) : (
                    <span>{describeViolation(v, t, format, project.employees)}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
