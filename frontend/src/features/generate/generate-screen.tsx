import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clock,
  Heart,
  Loader2,
  Pin,
  Sparkles,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Diagnostic, SolveResponse } from '@/api/types'
import { Section } from '@/components/form/section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toAppError } from '@/lib/errors'
import { useFormat } from '@/lib/format'
import { formatMonth } from '@/lib/month'
import { cn } from '@/lib/utils'
import { useProject } from '@/project/hooks'

import { describeDiagnostic } from './describe-diagnostic'
import { describeViolation } from './describe-violation'
import { useDiagnose } from './use-diagnose'
import { useSolve, useSolveStore } from './use-solve'

export function GenerateScreen() {
  const { t, i18n } = useTranslation()
  const project = useProject()
  const solve = useSolve()
  const stored = useSolveStore()
  const result = stored.projectId === project.id ? stored.result : null
  const active = project.employees.filter((e) => e.active)
  const wishes = project.availability.filter((a) => a.kind !== 'unavailable').length
  const limit = project.solver.timeLimitSeconds
  const pinned = project.plan?.shifts.filter((s) => s.pinned).length ?? 0

  return (
    <div className="grid gap-6">
      <Card className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
        <div className="grid gap-2">
          <h3 className="font-heading text-lg font-semibold first-letter:uppercase">
            {t('generate.title', { month: formatMonth(project.month, i18n.language) })}
          </h3>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <Users aria-hidden className="size-4" />
              {t('generate.people', { count: active.length })}
            </li>
            <li className="flex items-center gap-1.5">
              <Heart aria-hidden className="size-4" />
              {t('generate.wishes', { count: wishes })}
            </li>
            <li className="flex items-center gap-1.5">
              <Clock aria-hidden className="size-4" />
              {t('generate.timeLimit', { seconds: limit })}
            </li>
            {pinned > 0 && (
              <li className="flex items-center gap-1.5">
                <Pin aria-hidden className="size-4" />
                {t('generate.pinnedKept', { count: pinned })}
              </li>
            )}
          </ul>
        </div>
        <Button
          size="lg"
          disabled={solve.isPending || active.length === 0}
          onClick={() => solve.mutate()}
          className="gap-2"
        >
          {solve.isPending ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Sparkles aria-hidden className="size-4" />
          )}
          {project.plan ? t('generate.regenerate') : t('generate.generate')}
        </Button>
      </Card>

      {!result && !solve.isPending && <Precheck />}

      {solve.isPending && <Progress seconds={limit} />}

      {solve.isError && !solve.isPending && (
        <Notice tone="error" title={t('generate.failed')}>
          {(() => {
            const e = toAppError(solve.error)
            return t(e.key, e.params)
          })()}
        </Notice>
      )}

      {result && !solve.isPending && <Result result={result} />}
    </div>
  )
}

function Progress({ seconds }: { seconds: number }) {
  const { t } = useTranslation()
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const started = Date.now()
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 250)
    return () => clearInterval(timer)
  }, [])
  const share = Math.min(1, elapsed / seconds)
  return (
    <Card className="grid gap-3 p-6" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{t('generate.searching')}</span>
        <span className="text-muted-foreground tabular-nums">
          {t('generate.elapsed', { elapsed: Math.floor(elapsed), seconds })}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${Math.max(3, share * 100)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t('generate.searchingHelp')}</p>
    </Card>
  )
}

function Notice({
  tone,
  title,
  children,
}: {
  tone: 'success' | 'warning' | 'error'
  title: string
  children?: React.ReactNode
}) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' ? AlertTriangle : CircleAlert
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex gap-3 rounded-lg border p-4 text-sm',
        tone === 'success' && 'border-emerald-500/40 bg-emerald-500/10',
        tone === 'warning' && 'border-amber-500/40 bg-amber-500/10',
        tone === 'error' && 'border-destructive/40 bg-destructive/10',
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          'mt-0.5 size-4 shrink-0',
          tone === 'success' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'warning' && 'text-amber-600 dark:text-amber-400',
          tone === 'error' && 'text-destructive',
        )}
      />
      <div className="grid gap-1">
        <p className="font-medium">{title}</p>
        {children && <div className="text-foreground">{children}</div>}
      </div>
    </div>
  )
}

function Result({ result }: { result: SolveResponse }) {
  const { t } = useTranslation()
  const format = useFormat()
  const project = useProject()
  const employees = project.employees
  const errors = result.violations.filter((v) => v.severity === 'error')
  const warnings = result.violations.filter((v) => v.severity === 'warning')
  const timedOut = result.diagnostics.some((d) => d.code === 'solver.timeout')
  const honoured = result.stats.reduce((n, s) => n + s.wishesHonoured, 0)
  const wishTotal = result.stats.reduce((n, s) => n + s.wishesTotal, 0)
  const seconds = format.number(result.solveTimeMs / 1000)

  return (
    <div className="grid gap-6">
      {result.plan && result.status === 'best_effort' ? (
        <Notice tone="error" title={t('generate.status.best_effort')}>
          {t('generate.bestEffortSummary', {
            count: errors.length,
            shifts: result.plan.shifts.length,
            seconds,
          })}
        </Notice>
      ) : result.plan ? (
        <Notice
          tone={errors.length ? 'error' : 'success'}
          title={
            result.status === 'optimal'
              ? t('generate.status.optimal')
              : t('generate.status.feasible')
          }
        >
          {t('generate.summary', {
            shifts: result.plan.shifts.length,
            honoured,
            wishes: wishTotal,
            seconds,
          })}
        </Notice>
      ) : (
        <Notice
          tone="error"
          title={timedOut ? t('generate.status.timeout') : t('generate.status.infeasible')}
        >
          {timedOut
            ? t('generate.timeoutHelp', { seconds: project.solver.timeLimitSeconds })
            : t('generate.infeasibleHelp')}
        </Notice>
      )}

      {result.diagnostics.some((d) => d.code !== 'solver.timeout') && (
        <DiagnosticList
          title={t('generate.diagnosticsTitle')}
          diagnostics={result.diagnostics.filter((d) => d.code !== 'solver.timeout')}
        />
      )}

      {(errors.length > 0 || warnings.length > 0) && (
        <Section
          title={t('generate.issuesTitle')}
          description={t('generate.issuesDescription')}
          actions={<Badge variant="secondary">{errors.length + warnings.length}</Badge>}
        >
          <ul className="grid gap-2" aria-label={t('generate.issuesTitle')}>
            {[...errors, ...warnings].slice(0, 50).map((v, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {v.severity === 'error' ? (
                  <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
                ) : (
                  <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
                )}
                <span>{describeViolation(v, t, format, employees)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.stats.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <Table aria-label={t('generate.hoursTitle')}>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{t('employees.name')}</TableHead>
                <TableHead className="text-right">{t('generate.columns.shifts')}</TableHead>
                <TableHead className="text-right">{t('generate.columns.planned')}</TableHead>
                <TableHead className="text-right">{t('generate.columns.target')}</TableHead>
                <TableHead className="text-right">{t('generate.columns.deviation')}</TableHead>
                <TableHead className="text-right">{t('generate.columns.carryIn')}</TableHead>
                <TableHead className="text-right">{t('generate.columns.newBalance')}</TableHead>
                <TableHead className="pr-4 text-right">{t('generate.columns.wishes')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.stats.map((s) => {
                const e = employees.find((x) => x.id === s.employeeId)
                return (
                  <TableRow key={s.employeeId}>
                    <TableCell className="pl-4">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: e?.color }}
                        />
                        {e?.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s.shifts}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {format.hours(s.plannedHours)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {format.hours(s.targetHours)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {format.signedHours(s.deviationHours)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {format.signedHours(s.carryInHours)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {format.signedHours(s.newBalanceHours)}
                    </TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">
                      {s.wishesTotal ? `${s.wishesHonoured}/${s.wishesTotal}` : '—'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

function Precheck() {
  const { t } = useTranslation()
  const project = useProject()
  const diagnose = useDiagnose(project)
  if (diagnose.isError) return null
  if (!diagnose.data) {
    return <p className="text-sm text-muted-foreground">{t('generate.precheckRunning')}</p>
  }
  if (diagnose.data.length === 0) {
    return <Notice tone="success" title={t('generate.precheckOk')} />
  }
  const impossible = diagnose.data.some((d) => d.severity === 'error')
  return (
    <DiagnosticList
      title={t('generate.precheckTitle')}
      description={impossible ? t('generate.precheckErrors') : undefined}
      diagnostics={diagnose.data}
    />
  )
}

function DiagnosticList({
  title,
  description,
  diagnostics,
}: {
  title: string
  description?: string
  diagnostics: Diagnostic[]
}) {
  const { t } = useTranslation()
  const format = useFormat()
  const project = useProject()
  const sorted = [...diagnostics].sort(
    (a, b) => Number(b.severity === 'error') - Number(a.severity === 'error'),
  )
  return (
    <Section title={title} description={description}>
      <ul className="grid gap-2" aria-label={title}>
        {sorted.slice(0, 40).map((d, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            {d.severity === 'error' ? (
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
            ) : (
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
            )}
            <span>{describeDiagnostic(d, t, format, project.employees)}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
