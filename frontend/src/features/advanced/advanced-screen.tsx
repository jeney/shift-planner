import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { fetchNewProject } from '@/api/project-api'
import type { Rules } from '@/api/types'
import { Field } from '@/components/form/field'
import { NumberInput } from '@/components/form/number-input'
import { Section } from '@/components/form/section'
import { SwitchField } from '@/components/form/switch-field'
import { TimeInput } from '@/components/form/time-input'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { toAppError } from '@/lib/errors'
import { useFormat } from '@/lib/format'
import { useProject, useUpdateProject } from '@/project/hooks'
import { DAY_TYPES } from '@/project/store-hours'

import { NumberSetting } from './settings-fields'

const PERIODS = [13, 16, 26, 52]
const TARGET_MODES: Rules['monthlyTargetMode'][] = [
  'weeks_per_month',
  'fixed_4_4',
  'actual_weekdays',
]
const WEIGHT_KEYS = [
  'wishOff',
  'wishWork',
  'hourBalance',
  'beyondTolerance',
  'dailyTarget',
  'shortGap',
  'contiguousDaysOff',
] as const

export function AdvancedScreen() {
  const { t } = useTranslation()
  const format = useFormat()
  const project = useProject()
  const update = useUpdateProject()
  const { rules, weights, guestDemand, solver } = project
  const h = t('units.h')

  const setRules = (recipe: (r: Rules) => void) => update((p) => recipe(p.rules))

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <ResetDefaults />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {/* Shifts */}
        <Section title={t('advanced.shiftsTitle')} description={t('advanced.shiftsDescription')}>
          <div className="grid gap-1.5">
            <Label>{t('rules.granularityMin.label')}</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              className="justify-start"
              aria-label={t('rules.granularityMin.label')}
              value={String(rules.granularityMin)}
              onValueChange={(v) =>
                v && setRules((r) => void (r.granularityMin = Number(v) as Rules['granularityMin']))
              }
            >
              {[15, 30, 60].map((m) => (
                <ToggleGroupItem key={m} value={String(m)} className="px-3">
                  {m} {t('units.min')}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">{t('rules.granularityMin.help')}</p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label id="min-shift-label">{t('rules.minShiftHours.label')}</Label>
              <span className="text-sm font-medium tabular-nums">
                {format.hours(rules.minShiftHours)}
              </span>
            </div>
            <Slider
              thumbLabel={t('rules.minShiftHours.label')}
              min={1}
              max={Math.max(1, rules.maxShiftHours)}
              step={0.5}
              value={[rules.minShiftHours]}
              onValueChange={([v]) => setRules((r) => void (r.minShiftHours = v))}
            />
            <p className="text-xs text-muted-foreground">{t('rules.minShiftHours.help')}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberSetting
              label={t('rules.maxShiftHours.label')}
              help={t('rules.maxShiftHours.help')}
              value={rules.maxShiftHours}
              min={rules.minShiftHours}
              max={24}
              suffix={h}
              onValueChange={(v) => v !== null && setRules((r) => void (r.maxShiftHours = v))}
            />
            <NumberSetting
              label={t('rules.maxHoursPerDay.label')}
              help={t('rules.maxHoursPerDay.help')}
              nullable
              placeholder={format.number(rules.maxShiftHours)}
              value={rules.maxHoursPerDay}
              min={0}
              max={24}
              suffix={h}
              onValueChange={(v) => setRules((r) => void (r.maxHoursPerDay = v))}
            />
            <NumberSetting
              label={t('rules.minRestHours.label')}
              help={t('rules.minRestHours.help')}
              value={rules.minRestHours}
              min={0}
              max={24}
              suffix={h}
              onValueChange={(v) => v !== null && setRules((r) => void (r.minRestHours = v))}
            />
          </div>
          <SwitchField
            label={t('rules.oneShiftPerDay.label')}
            help={t('rules.oneShiftPerDay.help')}
            checked={rules.oneShiftPerDay}
            onCheckedChange={(v) => setRules((r) => void (r.oneShiftPerDay = v))}
          />
        </Section>

        {/* Working time */}
        <Section
          title={t('advanced.workingTimeTitle')}
          description={t('advanced.workingTimeDescription')}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberSetting
              label={t('rules.maxConsecutiveDays.label')}
              help={t('rules.maxConsecutiveDays.help')}
              value={rules.maxConsecutiveDays}
              min={1}
              max={31}
              maxFractionDigits={0}
              onValueChange={(v) => v !== null && setRules((r) => void (r.maxConsecutiveDays = v))}
            />
            <NumberSetting
              label={t('rules.maxWeeklyHours.label')}
              help={t('rules.maxWeeklyHours.help')}
              value={rules.maxWeeklyHours}
              min={0}
              max={168}
              suffix={h}
              onValueChange={(v) => v !== null && setRules((r) => void (r.maxWeeklyHours = v))}
            />
            <NumberSetting
              label={t('rules.fullTimeThresholdHours.label')}
              help={t('rules.fullTimeThresholdHours.help')}
              value={rules.fullTimeThresholdHours}
              min={0}
              max={168}
              suffix={t('units.hPerWeek')}
              onValueChange={(v) =>
                v !== null && setRules((r) => void (r.fullTimeThresholdHours = v))
              }
            />
          </div>
          <SwitchField
            label={t('rules.fullTimeContractWarning.label')}
            help={t('rules.fullTimeContractWarning.help')}
            checked={rules.fullTimeContractWarning}
            onCheckedChange={(v) => setRules((r) => void (r.fullTimeContractWarning = v))}
          />
        </Section>

        {/* Monthly hours & balance */}
        <Section title={t('advanced.balanceTitle')} description={t('advanced.balanceDescription')}>
          <div className="grid gap-2">
            <Label>{t('rules.monthlyTargetMode.label')}</Label>
            <RadioGroup
              value={rules.monthlyTargetMode}
              onValueChange={(v) =>
                setRules((r) => void (r.monthlyTargetMode = v as Rules['monthlyTargetMode']))
              }
              className="grid gap-2"
            >
              {TARGET_MODES.map((mode) => (
                <label key={mode} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                  <RadioGroupItem value={mode} className="mt-0.5" />
                  <span className="grid gap-0.5">
                    <span className="font-medium">
                      {t(`rules.monthlyTargetMode.${mode}.label`)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(`rules.monthlyTargetMode.${mode}.help`)}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>
          <SwitchField
            label={t('rules.holidaysReduceTarget.label')}
            help={t('rules.holidaysReduceTarget.help')}
            checked={rules.holidaysReduceTarget}
            onCheckedChange={(v) => setRules((r) => void (r.holidaysReduceTarget = v))}
          />

          <div className="grid gap-1.5">
            <Label>{t('rules.balancingPeriodWeeks.label')}</Label>
            <div className="flex flex-wrap items-center gap-3">
              <ToggleGroup
                type="single"
                variant="outline"
                aria-label={t('rules.balancingPeriodWeeks.label')}
                value={
                  PERIODS.includes(rules.balancingPeriodWeeks)
                    ? String(rules.balancingPeriodWeeks)
                    : ''
                }
                onValueChange={(v) =>
                  v && setRules((r) => void (r.balancingPeriodWeeks = Number(v)))
                }
              >
                {PERIODS.map((w) => (
                  <ToggleGroupItem key={w} value={String(w)} className="px-3">
                    {w}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <NumberInput
                className="w-28"
                aria-label={t('advanced.customWeeks')}
                value={rules.balancingPeriodWeeks}
                min={1}
                max={104}
                maxFractionDigits={0}
                suffix={t('advanced.weeks')}
                onValueChange={(v) =>
                  v !== null && setRules((r) => void (r.balancingPeriodWeeks = v))
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">{t('rules.balancingPeriodWeeks.help')}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberSetting
              label={t('rules.monthlyToleranceHours.label')}
              help={t('rules.monthlyToleranceHours.help')}
              value={rules.monthlyToleranceHours}
              min={0}
              max={100}
              suffix={h}
              onValueChange={(v) =>
                v !== null && setRules((r) => void (r.monthlyToleranceHours = v))
              }
            />
            <NumberSetting
              label={t('rules.monthlyHardLimitHours.label')}
              help={t('rules.monthlyHardLimitHours.help')}
              nullable
              placeholder="—"
              value={rules.monthlyHardLimitHours}
              min={0}
              max={200}
              suffix={h}
              onValueChange={(v) => setRules((r) => void (r.monthlyHardLimitHours = v))}
            />
            <NumberSetting
              label={t('rules.teamAdjustmentHours.label')}
              help={t('rules.teamAdjustmentHours.help')}
              value={rules.teamAdjustmentHours}
              min={-1000}
              max={1000}
              suffix={h}
              onValueChange={(v) => setRules((r) => void (r.teamAdjustmentHours = v ?? 0))}
            />
          </div>
        </Section>

        {/* Bus / car rule */}
        <Section title={t('advanced.busTitle')} description={t('advanced.busDescription')}>
          <SwitchField
            label={t('rules.busRule.enabled.label')}
            help={t('rules.busRule.enabled.help')}
            checked={rules.busRule.enabled}
            onCheckedChange={(v) => setRules((r) => void (r.busRule.enabled = v))}
          />
          <CutoffGrid
            label={t('rules.busRule.earlyCutoff.label')}
            help={t('rules.busRule.earlyCutoff.help')}
            disabled={!rules.busRule.enabled}
            values={rules.busRule.earlyCutoff}
            onChange={(dayType, v) => setRules((r) => void (r.busRule.earlyCutoff[dayType] = v))}
          />
          <SwitchField
            label={t('rules.busRule.lateEnabled.label')}
            help={t('rules.busRule.lateEnabled.help')}
            checked={rules.busRule.lateEnabled}
            disabled={!rules.busRule.enabled}
            onCheckedChange={(v) => setRules((r) => void (r.busRule.lateEnabled = v))}
          />
          {rules.busRule.lateEnabled && (
            <CutoffGrid
              label={t('rules.busRule.lateCutoff.label')}
              help={t('rules.busRule.lateCutoff.help')}
              disabled={!rules.busRule.enabled}
              values={rules.busRule.lateCutoff}
              onChange={(dayType, v) => setRules((r) => void (r.busRule.lateCutoff[dayType] = v))}
            />
          )}
        </Section>

        {/* Breaks */}
        <Section title={t('advanced.breaksTitle')} description={t('advanced.breaksDescription')}>
          <SwitchField
            label={t('rules.breaks.enabled.label')}
            help={t('rules.breaks.enabled.help')}
            checked={rules.breaks.enabled}
            onCheckedChange={(v) => setRules((r) => void (r.breaks.enabled = v))}
          />
          {rules.breaks.enabled && (
            <>
              <SwitchField
                label={t('rules.breaks.paid.label')}
                help={t('rules.breaks.paid.help')}
                checked={rules.breaks.paid}
                onCheckedChange={(v) => setRules((r) => void (r.breaks.paid = v))}
              />
              <ul className="grid gap-2" aria-label={t('rules.breaks.rules')}>
                {rules.breaks.rules.map((rule, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <span>{t('rules.breaks.shiftLongerThan')}</span>
                    <NumberInput
                      className="w-24"
                      aria-label={t('rules.breaks.afterHours')}
                      value={rule.afterHours}
                      min={0.5}
                      max={24}
                      suffix={h}
                      onValueChange={(v) =>
                        v !== null && setRules((r) => void (r.breaks.rules[i].afterHours = v))
                      }
                    />
                    <span>→</span>
                    <NumberInput
                      className="w-24"
                      aria-label={t('rules.breaks.minutes')}
                      value={rule.minutes}
                      min={0}
                      max={180}
                      maxFractionDigits={0}
                      suffix={t('units.min')}
                      onValueChange={(v) =>
                        v !== null && setRules((r) => void (r.breaks.rules[i].minutes = v))
                      }
                    />
                    <span>{t('rules.breaks.break')}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('rules.breaks.remove')}
                      onClick={() => setRules((r) => void r.breaks.rules.splice(i, 1))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="justify-self-start"
                onClick={() =>
                  setRules((r) => void r.breaks.rules.push({ afterHours: 9, minutes: 15 }))
                }
              >
                <Plus aria-hidden className="size-4" />
                {t('rules.breaks.add')}
              </Button>
            </>
          )}
        </Section>

        {/* Objective weights */}
        <Section title={t('advanced.weightsTitle')} description={t('advanced.weightsDescription')}>
          <div className="grid gap-4 sm:grid-cols-2">
            {WEIGHT_KEYS.map((key) => (
              <NumberSetting
                key={key}
                label={t(`weights.${key}.label`)}
                help={t(`weights.${key}.help`)}
                value={weights[key]}
                min={0}
                max={1000}
                onValueChange={(v) => v !== null && update((p) => void (p.weights[key] = v))}
              />
            ))}
          </div>
        </Section>

        {/* Guest-based demand */}
        <Section
          title={t('advanced.guestsTitle')}
          description={t('advanced.guestsDescription')}
          actions={<Badge variant="outline">{t('advanced.comingSoon')}</Badge>}
        >
          <SwitchField
            label={t('guestDemand.enabled.label')}
            help={t('guestDemand.enabled.help')}
            checked={guestDemand.enabled}
            disabled
            onCheckedChange={(v) => update((p) => void (p.guestDemand.enabled = v))}
          />
          <div className="grid gap-2">
            <Label>{t('guestDemand.mode.label')}</Label>
            <RadioGroup
              value={guestDemand.mode}
              onValueChange={(v) =>
                update((p) => void (p.guestDemand.mode = v as 'linear' | 'steps'))
              }
              className="flex flex-wrap gap-4"
            >
              {(['linear', 'steps'] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value={mode} />
                  {t(`guestDemand.mode.${mode}`)}
                </label>
              ))}
            </RadioGroup>
          </div>
          <ul className="grid gap-2" aria-label={t('guestDemand.points')}>
            {guestDemand.points.map((point, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <NumberInput
                  className="w-32"
                  aria-label={t('guestDemand.guests')}
                  value={point.guests}
                  min={0}
                  maxFractionDigits={0}
                  suffix={t('guestDemand.guestsUnit')}
                  onValueChange={(v) =>
                    v !== null && update((p) => void (p.guestDemand.points[i].guests = v))
                  }
                />
                <span>→</span>
                <NumberInput
                  className="w-28"
                  aria-label={t('guestDemand.hours')}
                  value={point.hours}
                  min={0}
                  max={1000}
                  suffix={h}
                  onValueChange={(v) =>
                    v !== null && update((p) => void (p.guestDemand.points[i].hours = v))
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('guestDemand.remove')}
                  disabled={guestDemand.points.length <= 1}
                  onClick={() => update((p) => void p.guestDemand.points.splice(i, 1))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                update((p) => {
                  const last = p.guestDemand.points.at(-1)
                  p.guestDemand.points.push({
                    guests: (last?.guests ?? 750) + 250,
                    hours: (last?.hours ?? 15) + 5,
                  })
                })
              }
            >
              <Plus aria-hidden className="size-4" />
              {t('guestDemand.add')}
            </Button>
            <NumberSetting
              label={t('guestDemand.tolerance.label')}
              help={t('guestDemand.tolerance.help')}
              value={guestDemand.toleranceHours}
              min={0}
              max={100}
              suffix={h}
              onValueChange={(v) =>
                v !== null && update((p) => void (p.guestDemand.toleranceHours = v))
              }
            />
          </div>
        </Section>

        {/* Solver */}
        <Section title={t('advanced.solverTitle')} description={t('advanced.solverDescription')}>
          <NumberSetting
            label={t('solver.timeLimit.label')}
            help={t('solver.timeLimit.help')}
            value={solver.timeLimitSeconds}
            min={1}
            max={600}
            maxFractionDigits={0}
            suffix={t('units.s')}
            onValueChange={(v) => v !== null && update((p) => void (p.solver.timeLimitSeconds = v))}
          />
        </Section>
      </div>
    </div>
  )
}

type DayType = (typeof DAY_TYPES)[number]

function CutoffGrid({
  label,
  help,
  values,
  disabled,
  onChange,
}: {
  label: string
  help: string
  values: Record<DayType, string>
  disabled?: boolean
  onChange: (dayType: DayType, value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {DAY_TYPES.map((dayType) => (
          <Field key={dayType} label={t(`dayTypes.${dayType}`)}>
            <TimeInput
              value={values[dayType]}
              stepMinutes={15}
              aria-label={`${label}: ${t(`dayTypes.${dayType}`)}`}
              onValueChange={(v) => v && onChange(dayType, v)}
            />
          </Field>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{help}</p>
    </fieldset>
  )
}

/** Replace all rules, weights and settings with the backend's defaults. */
function ResetDefaults() {
  const { t } = useTranslation()
  const project = useProject()
  const update = useUpdateProject()
  const [busy, setBusy] = useState(false)

  const reset = async () => {
    setBusy(true)
    try {
      const defaults = await fetchNewProject(project.month)
      update((p) => {
        p.rules = defaults.rules
        p.weights = defaults.weights
        p.solver = defaults.solver
        p.guestDemand = { ...defaults.guestDemand, guestsByDate: p.guestDemand.guestsByDate }
      })
      toast.success(t('advanced.resetDone'))
    } catch (error) {
      const e = toAppError(error)
      toast.error(t(e.key, e.params))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={busy}>
          <RotateCcw aria-hidden className="size-4" />
          {t('advanced.reset')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('advanced.resetTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('advanced.resetDescription')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => void reset()}>{t('advanced.reset')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
