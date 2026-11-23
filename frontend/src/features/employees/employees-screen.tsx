import { Car, Pencil, Plus, UserRound, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useFormat } from '@/lib/format'
import { newId } from '@/lib/ids'
import { useProject, useUpdateProject } from '@/project/hooks'

import { nextColor } from './colors'
import { EmployeeSheet } from './employee-sheet'
import { useTargets } from './use-targets'

export function EmployeesScreen() {
  const { t } = useTranslation()
  const format = useFormat()
  const project = useProject()
  const update = useUpdateProject()
  const { targets } = useTargets()
  const [editing, setEditing] = useState<string | null>(null)

  const addEmployee = () => {
    const id = newId()
    update((p) => {
      p.employees.push({
        id,
        name: t('employees.newName', { n: p.employees.length + 1 }),
        color: nextColor(p.employees.map((e) => e.color)),
        active: true,
        contractHoursPerWeek: 20,
        hasCar: false,
        needsRideEarly: false,
        needsRideLate: false,
        allowedDriverIds: null,
        overrides: {
          minShiftHours: null,
          maxShiftHours: null,
          maxHoursPerDay: null,
          minRestHours: null,
          maxConsecutiveDays: null,
          maxWeeklyHours: null,
        },
        balance: {
          carryInHours: 0,
          periodWeek: 1,
          lastShiftEndedAt: null,
          consecutiveDaysAtStart: 0,
        },
      })
    })
    setEditing(id)
  }

  const employees = project.employees
  const active = employees.filter((e) => e.active)
  const totalWeekly = active.reduce((sum, e) => sum + e.contractHoursPerWeek, 0)
  const totalTarget = active.reduce((sum, e) => sum + (targets.get(e.id) ?? 0), 0)
  const periodWeeks = project.rules.balancingPeriodWeeks

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {t('employees.summary', { count: active.length })}
        </p>
        <Button onClick={addEmployee}>
          <Plus aria-hidden className="size-4" />
          {t('employees.add')}
        </Button>
      </div>

      {employees.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <Users aria-hidden className="size-8 opacity-40" />
          <p className="font-medium text-foreground">{t('employees.emptyTitle')}</p>
          <p className="max-w-sm text-sm">{t('employees.emptyBody')}</p>
          <Button variant="outline" onClick={addEmployee}>
            <Plus aria-hidden className="size-4" />
            {t('employees.add')}
          </Button>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{t('employees.name')}</TableHead>
                <TableHead className="text-right">{t('employees.hoursPerWeek')}</TableHead>
                <TableHead className="text-right">{t('employees.monthlyTarget')}</TableHead>
                <TableHead>{t('employees.transport')}</TableHead>
                <TableHead className="text-right">{t('employees.carryIn')}</TableHead>
                <TableHead className="text-right">{t('employees.periodWeekShort')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => {
                const target = targets.get(employee.id)
                const carry = employee.balance.carryInHours
                return (
                  <TableRow
                    key={employee.id}
                    className="cursor-pointer"
                    onClick={() => setEditing(employee.id)}
                  >
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          aria-hidden
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: employee.color }}
                        />
                        <span className="font-medium">
                          {employee.name || t('employees.unnamed')}
                        </span>
                        {!employee.active && (
                          <Badge variant="outline">{t('employees.inactive')}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {format.hours(employee.contractHoursPerWeek)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {target === undefined ? '…' : format.hours(target)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {employee.hasCar && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex" aria-label={t('employees.hasCar')}>
                                <Car aria-hidden className="size-4" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{t('employees.hasCar')}</TooltipContent>
                          </Tooltip>
                        )}
                        {(employee.needsRideEarly || employee.needsRideLate) && (
                          <Badge variant="secondary" className="gap-1">
                            <UserRound aria-hidden className="size-3" />
                            {t('employees.needsRide')}
                          </Badge>
                        )}
                        {!employee.hasCar &&
                          !employee.needsRideEarly &&
                          !employee.needsRideLate && (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                      </div>
                    </TableCell>
                    <TableCell
                      className={
                        carry > 0
                          ? 'text-right text-amber-700 tabular-nums dark:text-amber-400'
                          : carry < 0
                            ? 'text-right text-sky-700 tabular-nums dark:text-sky-400'
                            : 'text-right text-muted-foreground tabular-nums'
                      }
                    >
                      {format.signedHours(carry)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {t('employees.weekOf', {
                        week: employee.balance.periodWeek,
                        weeks: periodWeeks,
                      })}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('employees.edit', { name: employee.name })}
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditing(employee.id)
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-4 font-medium">{t('employees.total')}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {format.hours(totalWeekly)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {format.hours(totalTarget)}
                </TableCell>
                <TableCell colSpan={4} />
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
      )}

      <EmployeeSheet employeeId={editing} onClose={() => setEditing(null)} />
    </div>
  )
}
