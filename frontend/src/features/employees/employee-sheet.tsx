import { ChevronDown, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Employee } from '@/api/types'
import { Field } from '@/components/form/field'
import { NumberInput } from '@/components/form/number-input'
import { SwitchField } from '@/components/form/switch-field'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useProject, useUpdateProject } from '@/project/hooks'

import { EMPLOYEE_COLORS } from './colors'
import { useTargets } from './use-targets'

const PRESETS = [40, 20, 10]

interface EmployeeSheetProps {
  employeeId: string | null
  onClose: () => void
}

export function EmployeeSheet({ employeeId, onClose }: EmployeeSheetProps) {
  const { t } = useTranslation()
  const project = useProject()
  const employee = project.employees.find((e) => e.id === employeeId)

  return (
    <Sheet open={!!employee} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        {employee && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-3 rounded-full"
                  style={{ backgroundColor: employee.color }}
                />
                {employee.name || t('employees.unnamed')}
              </SheetTitle>
              <SheetDescription>{t('employees.sheetDescription')}</SheetDescription>
            </SheetHeader>
            <EmployeeForm employee={employee} onDeleted={onClose} />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function EmployeeForm({ employee, onDeleted }: { employee: Employee; onDeleted: () => void }) {
  const { t } = useTranslation()
  const format = useFormat()
  const project = useProject()
  const update = useUpdateProject()
  const { targets, factor, weekdays } = useTargets()
  const [limitsOpen, setLimitsOpen] = useState(
    Object.values(employee.overrides).some((v) => v !== null),
  )

  const edit = (recipe: (e: Employee) => void) =>
    update((p) => {
      const target = p.employees.find((e) => e.id === employee.id)
      if (target) recipe(target)
    })

  const drivers = project.employees.filter((e) => e.hasCar && e.id !== employee.id)
  const rules = project.rules
  const target = targets.get(employee.id)

  const factorLabel =
    rules.monthlyTargetMode === 'weeks_per_month'
      ? '52/12'
      : rules.monthlyTargetMode === 'fixed_4_4'
        ? format.number(4.4)
        : t('employees.weekdaysFactor', { count: weekdays ?? 0 })

  const remove = () =>
    update((p) => {
      p.employees = p.employees.filter((e) => e.id !== employee.id)
      p.availability = p.availability.filter((a) => a.employeeId !== employee.id)
      if (p.plan) p.plan.shifts = p.plan.shifts.filter((s) => s.employeeId !== employee.id)
      for (const other of p.employees) {
        if (other.allowedDriverIds) {
          other.allowedDriverIds = other.allowedDriverIds.filter((id) => id !== employee.id)
        }
      }
    })

  return (
    <div className="grid gap-6 p-4">
      {/* Basics */}
      <div className="grid gap-4">
        <Field label={t('employees.name')} htmlFor="employee-name">
          <Input
            id="employee-name"
            value={employee.name}
            maxLength={80}
            aria-invalid={!employee.name.trim() || undefined}
            onChange={(e) => edit((x) => void (x.name = e.target.value))}
          />
        </Field>
        <div className="grid gap-1.5">
          <Label>{t('employees.color')}</Label>
          <div role="radiogroup" aria-label={t('employees.color')} className="flex flex-wrap gap-2">
            {EMPLOYEE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={employee.color === color}
                aria-label={color}
                className={cn(
                  'size-7 rounded-full ring-offset-background transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                  employee.color === color && 'ring-2 ring-foreground ring-offset-2',
                )}
                style={{ backgroundColor: color }}
                onClick={() => edit((x) => void (x.color = color))}
              />
            ))}
          </div>
        </div>
        <SwitchField
          label={t('employees.active')}
          help={t('employees.activeHelp')}
          checked={employee.active}
          onCheckedChange={(v) => edit((x) => void (x.active = v))}
        />
      </div>

      <Separator />

      {/* Contract */}
      <div className="grid gap-3">
        <h3 className="text-sm font-semibold">{t('employees.contract')}</h3>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('employees.hoursPerWeek')} htmlFor="employee-hours" className="w-36">
            <NumberInput
              id="employee-hours"
              value={employee.contractHoursPerWeek}
              min={0}
              max={60}
              suffix={t('units.hPerWeek')}
              onValueChange={(v) => edit((x) => void (x.contractHoursPerWeek = v ?? 0))}
            />
          </Field>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-label={t('employees.presets')}
            value={
              PRESETS.includes(employee.contractHoursPerWeek)
                ? String(employee.contractHoursPerWeek)
                : ''
            }
            onValueChange={(v) => v && edit((x) => void (x.contractHoursPerWeek = Number(v)))}
          >
            {PRESETS.map((h) => (
              <ToggleGroupItem key={h} value={String(h)} className="px-3">
                {format.hours(h)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        {target !== undefined && factor !== null && (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-sm" data-testid="target-calculation">
            {t('employees.targetCalculation', {
              weekly: format.hours(employee.contractHoursPerWeek),
              factor: factorLabel,
              target: format.hours(target),
            })}
            {rules.teamAdjustmentHours !== 0 && (
              <span className="text-muted-foreground">
                {' '}
                {t('employees.includesTeamAdjustment')}
              </span>
            )}
          </p>
        )}
      </div>

      <Separator />

      {/* Transport */}
      <div className="grid gap-4">
        <h3 className="text-sm font-semibold">{t('employees.transport')}</h3>
        <SwitchField
          label={t('employees.hasCar')}
          help={t('employees.hasCarHelp')}
          checked={employee.hasCar}
          onCheckedChange={(v) => edit((x) => void (x.hasCar = v))}
        />
        <SwitchField
          label={t('employees.needsRideEarly')}
          help={t('employees.needsRideEarlyHelp')}
          checked={employee.needsRideEarly}
          onCheckedChange={(v) => edit((x) => void (x.needsRideEarly = v))}
        />
        <SwitchField
          label={t('employees.needsRideLate')}
          help={
            rules.busRule.lateEnabled
              ? t('employees.needsRideLateHelp')
              : t('employees.needsRideLateOff')
          }
          checked={employee.needsRideLate}
          onCheckedChange={(v) => edit((x) => void (x.needsRideLate = v))}
        />
        {(employee.needsRideEarly || employee.needsRideLate) && (
          <div className="grid gap-2 rounded-lg border p-3">
            <Label>{t('employees.whoCanDrive')}</Label>
            <RadioGroup
              value={employee.allowedDriverIds === null ? 'any' : 'some'}
              onValueChange={(v) =>
                edit((x) => {
                  x.allowedDriverIds = v === 'any' ? null : drivers.map((d) => d.id)
                })
              }
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="any" />
                {t('employees.anyDriver')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="some" />
                {t('employees.someDrivers')}
              </label>
            </RadioGroup>
            {employee.allowedDriverIds !== null && (
              <ul className="grid gap-1.5 pl-6">
                {drivers.length === 0 && (
                  <li className="text-sm text-muted-foreground">{t('employees.noDrivers')}</li>
                )}
                {drivers.map((driver) => (
                  <li key={driver.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={employee.allowedDriverIds?.includes(driver.id) ?? false}
                        onCheckedChange={(checked) =>
                          edit((x) => {
                            const ids = new Set(x.allowedDriverIds ?? [])
                            if (checked === true) ids.add(driver.id)
                            else ids.delete(driver.id)
                            x.allowedDriverIds = [...ids]
                          })
                        }
                      />
                      {driver.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Balance */}
      <div className="grid gap-4">
        <div className="grid gap-1">
          <h3 className="text-sm font-semibold">{t('employees.balance')}</h3>
          <p className="text-xs text-muted-foreground">{t('employees.balanceHelp')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('employees.carryIn')}
            htmlFor="carry-in"
            help={t('employees.carryInHelp')}
          >
            <NumberInput
              id="carry-in"
              value={employee.balance.carryInHours}
              min={-500}
              max={500}
              suffix={t('units.h')}
              onValueChange={(v) => edit((x) => void (x.balance.carryInHours = v ?? 0))}
            />
          </Field>
          <Field
            label={t('employees.periodWeek')}
            htmlFor="period-week"
            help={t('employees.periodWeekHelp', { weeks: rules.balancingPeriodWeeks })}
          >
            <NumberInput
              id="period-week"
              value={employee.balance.periodWeek}
              min={1}
              max={rules.balancingPeriodWeeks}
              maxFractionDigits={0}
              suffix={t('employees.ofWeeks', { weeks: rules.balancingPeriodWeeks })}
              onValueChange={(v) => edit((x) => void (x.balance.periodWeek = v ?? 1))}
            />
          </Field>
          <Field
            label={t('employees.lastShiftEnded')}
            htmlFor="last-shift"
            help={t('employees.lastShiftEndedHelp')}
          >
            <Input
              id="last-shift"
              type="datetime-local"
              value={employee.balance.lastShiftEndedAt?.slice(0, 16) ?? ''}
              onChange={(e) =>
                edit(
                  (x) =>
                    void (x.balance.lastShiftEndedAt = e.target.value
                      ? `${e.target.value}:00`
                      : null),
                )
              }
            />
          </Field>
          <Field
            label={t('employees.daysInARow')}
            htmlFor="days-in-a-row"
            help={t('employees.daysInARowHelp')}
          >
            <NumberInput
              id="days-in-a-row"
              value={employee.balance.consecutiveDaysAtStart}
              min={0}
              max={31}
              maxFractionDigits={0}
              onValueChange={(v) => edit((x) => void (x.balance.consecutiveDaysAtStart = v ?? 0))}
            />
          </Field>
        </div>
      </div>

      <Separator />

      {/* Personal limits */}
      <Collapsible open={limitsOpen} onOpenChange={setLimitsOpen} className="grid gap-4">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto justify-between gap-4 px-0 py-1 whitespace-normal hover:bg-transparent"
          >
            <span className="grid text-left">
              <span className="text-sm font-semibold">{t('employees.limits')}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {t('employees.limitsHelp')}
              </span>
            </span>
            <ChevronDown
              aria-hidden
              className={cn('size-4 transition-transform', limitsOpen && 'rotate-180')}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ['minShiftHours', rules.minShiftHours, 24, t('units.h')],
              ['maxShiftHours', rules.maxShiftHours, 24, t('units.h')],
              ['maxHoursPerDay', rules.maxHoursPerDay ?? rules.maxShiftHours, 24, t('units.h')],
              ['minRestHours', rules.minRestHours, 24, t('units.h')],
              ['maxConsecutiveDays', rules.maxConsecutiveDays, 31, undefined],
              ['maxWeeklyHours', rules.maxWeeklyHours, 168, t('units.h')],
            ] as const
          ).map(([key, globalValue, max, suffix]) => (
            <Field
              key={key}
              label={t(`rules.${key}.label`)}
              htmlFor={`override-${key}`}
              help={t('employees.globalValue', { value: format.number(globalValue) })}
            >
              <NumberInput
                id={`override-${key}`}
                nullable
                value={employee.overrides[key]}
                min={key === 'maxConsecutiveDays' ? 1 : 0}
                max={max}
                maxFractionDigits={key === 'maxConsecutiveDays' ? 0 : 2}
                suffix={suffix}
                placeholder={format.number(globalValue)}
                onValueChange={(v) => edit((x) => void (x.overrides[key] = v))}
              />
            </Field>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="justify-self-start text-destructive">
            <Trash2 aria-hidden className="size-4" />
            {t('employees.delete')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('employees.deleteTitle', { name: employee.name || t('employees.unnamed') })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('employees.deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDeleted()
                remove()
              }}
            >
              {t('employees.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
