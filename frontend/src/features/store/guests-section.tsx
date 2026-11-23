import { Eraser } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useMonthCalendar } from '@/api/queries'
import { NumberInput } from '@/components/form/number-input'
import { Section } from '@/components/form/section'
import { Button } from '@/components/ui/button'
import { guestHours } from '@/lib/guests'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useProject, useUpdateProject } from '@/project/hooks'

/** Expected guests per day → each day's staff-hours target (guest-based demand). */
export function GuestsSection({ className }: { className?: string }) {
  const { t } = useTranslation()
  const format = useFormat()
  const project = useProject()
  const update = useUpdateProject()
  const days = useMonthCalendar(project.month).data?.days ?? []
  const demand = project.guestDemand
  const filled = days.filter((d) => demand.guestsByDate[d.date] !== undefined).length

  return (
    <Section
      className={className}
      title={t('store.guestsTitle')}
      description={t('store.guestsDescription', {
        tolerance: format.number(demand.toleranceHours),
      })}
      actions={
        <Button
          variant="ghost"
          size="sm"
          disabled={filled === 0}
          onClick={() => update((p) => void (p.guestDemand.guestsByDate = {}))}
        >
          <Eraser aria-hidden className="size-4" />
          {t('store.guestsClear')}
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">
        {t('store.guestsFilled', { filled, total: days.length })}
      </p>
      <ul
        className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
        aria-label={t('store.guestsTitle')}
      >
        {days.map((day) => {
          const guests = demand.guestsByDate[day.date] ?? null
          const hours = guests === null ? null : guestHours(guests, demand)
          const shaded = day.weekday >= 5 || day.holiday !== null
          return (
            <li
              key={day.date}
              className={cn('grid gap-1 rounded-lg border p-2', shaded && 'bg-muted/50')}
            >
              <label
                htmlFor={`guests-${day.date}`}
                className="text-xs font-medium first-letter:uppercase"
              >
                {format.weekdayDate(day.date)}
              </label>
              <NumberInput
                id={`guests-${day.date}`}
                nullable
                value={guests}
                min={0}
                max={100000}
                maxFractionDigits={0}
                placeholder="—"
                onValueChange={(v) =>
                  update((p) => {
                    if (v === null) delete p.guestDemand.guestsByDate[day.date]
                    else p.guestDemand.guestsByDate[day.date] = v
                  })
                }
              />
              <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
                {hours === null ? ' ' : t('store.guestsHours', { hours: format.hours(hours) })}
              </span>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
