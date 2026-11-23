import { useTranslation } from 'react-i18next'

import type { StoreSettings } from '@/api/types'
import { Field } from '@/components/form/field'
import { NumberInput } from '@/components/form/number-input'
import { Section } from '@/components/form/section'
import { TimeInput } from '@/components/form/time-input'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useFormat } from '@/lib/format'
import { useProject, useUpdateProject } from '@/project/hooks'
import { isValidWindow, staffedRange, WEEKDAY_KEYS, type WeekdayKey } from '@/project/store-hours'

type DayHours = StoreSettings['publicHolidayHours']
type RowKey = WeekdayKey | 'holiday'

export function OpeningHoursSection() {
  const { t } = useTranslation()
  const format = useFormat()
  const { store } = useProject()
  const update = useUpdateProject()
  const weekdayNames = format.weekdays('long')

  const rows: { key: RowKey; label: string; hours: DayHours }[] = [
    ...WEEKDAY_KEYS.map((key, i) => ({
      key,
      label: weekdayNames[i],
      hours: store.openingHours[key],
    })),
    { key: 'holiday', label: t('store.publicHolidays'), hours: store.publicHolidayHours },
  ]

  const setHours = (key: RowKey, patch: Partial<DayHours>) =>
    update((p) => {
      const target = key === 'holiday' ? p.store.publicHolidayHours : p.store.openingHours[key]
      Object.assign(target, patch)
    })

  return (
    <Section title={t('store.hoursTitle')} description={t('store.hoursDescription')}>
      <Field label={t('store.name')} htmlFor="store-name">
        <Input
          id="store-name"
          value={store.name}
          maxLength={100}
          onChange={(e) => update((p) => void (p.store.name = e.target.value))}
        />
      </Field>

      <div role="table" aria-label={t('store.hoursTitle')} className="grid gap-1">
        {rows.map(({ key, label, hours }) => {
          const valid = hours.closed || isValidWindow(hours.opens, hours.closes)
          const staffed = staffedRange(store, hours)
          return (
            <div
              role="row"
              key={key}
              className="grid grid-cols-[minmax(7rem,1fr)_auto_minmax(0,2.4fr)] items-center gap-3 border-b py-2 last:border-b-0"
            >
              <span
                role="rowheader"
                className="inline-block text-sm font-medium first-letter:uppercase"
              >
                {label}
              </span>
              <span role="cell">
                <Switch
                  checked={!hours.closed}
                  aria-label={t('store.openOn', { day: label })}
                  onCheckedChange={(open) => setHours(key, { closed: !open })}
                />
              </span>
              <span role="cell" className="flex flex-wrap items-center gap-2">
                {hours.closed ? (
                  <span className="text-sm text-muted-foreground">{t('store.closed')}</span>
                ) : (
                  <>
                    <TimeInput
                      value={hours.opens}
                      stepMinutes={15}
                      aria-label={t('store.opensOn', { day: label })}
                      aria-invalid={!valid || undefined}
                      onValueChange={(v) => v && setHours(key, { opens: v })}
                    />
                    <span aria-hidden className="text-muted-foreground">
                      –
                    </span>
                    <TimeInput
                      value={hours.closes}
                      stepMinutes={15}
                      aria-label={t('store.closesOn', { day: label })}
                      aria-invalid={!valid || undefined}
                      onValueChange={(v) => v && setHours(key, { closes: v })}
                    />
                    {valid ? (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {t('store.staffedRange', staffed)}
                      </span>
                    ) : (
                      <span role="alert" className="text-xs text-destructive">
                        {t('store.closesBeforeOpens')}
                      </span>
                    )}
                  </>
                )}
              </span>
            </div>
          )
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('store.before')} htmlFor="staff-before" help={t('store.beforeHelp')}>
          <NumberInput
            id="staff-before"
            value={store.staffBeforeOpeningMin}
            min={0}
            max={240}
            maxFractionDigits={0}
            suffix={t('units.min')}
            onValueChange={(v) => update((p) => void (p.store.staffBeforeOpeningMin = v ?? 0))}
          />
        </Field>
        <Field label={t('store.after')} htmlFor="staff-after" help={t('store.afterHelp')}>
          <NumberInput
            id="staff-after"
            value={store.staffAfterClosingMin}
            min={0}
            max={240}
            maxFractionDigits={0}
            suffix={t('units.min')}
            onValueChange={(v) => update((p) => void (p.store.staffAfterClosingMin = v ?? 0))}
          />
        </Field>
      </div>
    </Section>
  )
}
