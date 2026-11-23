import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { StoreSettings } from '@/api/types'
import { NumberInput } from '@/components/form/number-input'
import { Section } from '@/components/form/section'
import { SwitchField } from '@/components/form/switch-field'
import { TimeInput } from '@/components/form/time-input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { newId } from '@/lib/ids'
import { useProject, useUpdateProject } from '@/project/hooks'
import { DAY_TYPES, isValidWindow } from '@/project/store-hours'

type DayType = (typeof DAY_TYPES)[number]
type Staffing = StoreSettings['staffing']['weekday']

export function StaffingSection({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { store } = useProject()
  const update = useUpdateProject()

  const setStaffing = (dayType: DayType, patch: Partial<Staffing>) =>
    update((p) => void Object.assign(p.store.staffing[dayType], patch))

  return (
    <Section
      className={className}
      title={t('store.staffingTitle')}
      description={t('store.staffingDescription')}
    >
      <SwitchField
        label={t('store.allowAlone')}
        help={t('store.allowAloneHelp')}
        checked={store.allowWorkingAlone}
        onCheckedChange={(v) => update((p) => void (p.store.allowWorkingAlone = v))}
      />

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('store.dayType')}</TableHead>
              <TableHead>{t('store.atOpening')}</TableHead>
              <TableHead>{t('store.atClosing')}</TableHead>
              <TableHead>{t('store.dailyMin')}</TableHead>
              <TableHead>{t('store.dailyMax')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DAY_TYPES.map((dayType) => {
              const s = store.staffing[dayType]
              const label = t(`dayTypes.${dayType}`)
              return (
                <TableRow key={dayType}>
                  <TableCell className="font-medium">{label}</TableCell>
                  <TableCell>
                    <NumberInput
                      className="w-20"
                      value={s.minAtOpening}
                      min={0}
                      max={50}
                      maxFractionDigits={0}
                      aria-label={`${label}: ${t('store.atOpening')}`}
                      onValueChange={(v) => setStaffing(dayType, { minAtOpening: v ?? 0 })}
                    />
                  </TableCell>
                  <TableCell>
                    <NumberInput
                      className="w-20"
                      value={s.minAtClosing}
                      min={0}
                      max={50}
                      maxFractionDigits={0}
                      aria-label={`${label}: ${t('store.atClosing')}`}
                      onValueChange={(v) => setStaffing(dayType, { minAtClosing: v ?? 0 })}
                    />
                  </TableCell>
                  <TableCell>
                    <NumberInput
                      className="w-24"
                      nullable
                      value={s.dailyHoursMin}
                      min={0}
                      max={168}
                      suffix={t('units.h')}
                      placeholder="—"
                      aria-label={`${label}: ${t('store.dailyMin')}`}
                      onValueChange={(v) => setStaffing(dayType, { dailyHoursMin: v })}
                    />
                  </TableCell>
                  <TableCell>
                    <NumberInput
                      className="w-24"
                      nullable
                      value={s.dailyHoursMax}
                      min={0}
                      max={168}
                      suffix={t('units.h')}
                      placeholder="—"
                      aria-label={`${label}: ${t('store.dailyMax')}`}
                      onValueChange={(v) => setStaffing(dayType, { dailyHoursMax: v })}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <p className="mt-2 text-xs text-muted-foreground">{t('store.dailyHelp')}</p>
      </div>

      <SwitchField
        label={t('store.dailyHard')}
        help={t('store.dailyHardHelp')}
        checked={store.dailyHoursHard}
        onCheckedChange={(v) => update((p) => void (p.store.dailyHoursHard = v))}
      />

      <div className="grid gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <h3 className="text-sm font-medium">{t('store.rangesTitle')}</h3>
            <p className="text-xs text-muted-foreground">{t('store.rangesDescription')}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              update(
                (p) =>
                  void p.store.timeRangeMinimums.push({
                    id: newId(),
                    dayTypes: ['saturday'],
                    start: '11:00',
                    end: '14:00',
                    minPeople: 2,
                  }),
              )
            }
          >
            <Plus aria-hidden className="size-4" />
            {t('store.addRange')}
          </Button>
        </div>
        {store.timeRangeMinimums.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {t('store.noRanges')}
          </p>
        ) : (
          <ul className="grid gap-2">
            {store.timeRangeMinimums.map((range, index) => {
              const valid = isValidWindow(range.start, range.end) && range.dayTypes.length > 0
              const edit = (patch: Partial<typeof range>) =>
                update((p) => void Object.assign(p.store.timeRangeMinimums[index], patch))
              return (
                <li
                  key={range.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                >
                  <ToggleGroup
                    type="multiple"
                    variant="outline"
                    size="sm"
                    value={range.dayTypes}
                    aria-label={t('store.dayType')}
                    onValueChange={(v) => edit({ dayTypes: v as DayType[] })}
                  >
                    {DAY_TYPES.map((d) => (
                      <ToggleGroupItem key={d} value={d}>
                        {t(`dayTypesShort.${d}`)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <TimeInput
                    value={range.start}
                    stepMinutes={15}
                    aria-label={t('store.from')}
                    onValueChange={(v) => v && edit({ start: v })}
                  />
                  <span aria-hidden className="text-muted-foreground">
                    –
                  </span>
                  <TimeInput
                    value={range.end}
                    stepMinutes={15}
                    aria-label={t('store.to')}
                    onValueChange={(v) => v && edit({ end: v })}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">≥</span>
                    <NumberInput
                      className="w-20"
                      value={range.minPeople}
                      min={1}
                      max={50}
                      maxFractionDigits={0}
                      aria-label={t('store.people')}
                      onValueChange={(v) => v && edit({ minPeople: v })}
                    />
                    <span className="text-sm text-muted-foreground">{t('store.peopleUnit')}</span>
                  </div>
                  {!valid && (
                    <span role="alert" className="text-xs text-destructive">
                      {t('store.rangeInvalid')}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto"
                    aria-label={t('store.removeRange')}
                    onClick={() =>
                      update((p) => {
                        p.store.timeRangeMinimums.splice(index, 1)
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Section>
  )
}
