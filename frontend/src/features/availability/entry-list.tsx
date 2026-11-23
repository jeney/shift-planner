import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { AvailabilityEntry } from '@/api/types'
import { Button } from '@/components/ui/button'
import { useFormat } from '@/lib/format'
import { useUpdateProject } from '@/project/hooks'

import { describeEntry } from './describe'
import { KindChip } from './kind-badge'
import { KINDS } from './model'
import { WeightToggle } from './weight-toggle'

const SHAPE_ORDER = { weekly: 0, range: 1, date: 2 }

function sortKey(e: AvailabilityEntry): string {
  const p = e.pattern
  const when = p.type === 'weekly' ? String(p.weekday) : p.type === 'date' ? p.date : p.startDate
  return `${SHAPE_ORDER[p.type]}-${when}-${KINDS.indexOf(e.kind)}`
}

export function EntryList({ entries }: { entries: AvailabilityEntry[] }) {
  const { t } = useTranslation()
  const format = useFormat()
  const update = useUpdateProject()

  const edit = (id: string, recipe: (e: AvailabilityEntry) => void) =>
    update((p) => {
      const entry = p.availability.find((e) => e.id === id)
      if (entry) recipe(entry)
    })

  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        {t('availability.emptyList')}
      </p>
    )
  }

  return (
    <ul className="grid gap-2" aria-label={t('availability.listLabel')}>
      {[...entries]
        .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
        .map((entry) => (
          <li key={entry.id} className="grid gap-2 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="grid gap-1.5">
                <KindChip kind={entry.kind} className="justify-self-start" />
                <span className="text-sm font-medium first-letter:uppercase">
                  {describeEntry(entry, t, format)}
                </span>
                {entry.note && <span className="text-xs text-muted-foreground">{entry.note}</span>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('availability.remove', { what: describeEntry(entry, t, format) })}
                onClick={() =>
                  update((p) => {
                    p.availability = p.availability.filter((e) => e.id !== entry.id)
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            {entry.kind !== 'unavailable' && (
              <WeightToggle
                value={entry.weight}
                onChange={(w) => edit(entry.id, (e) => void (e.weight = w))}
              />
            )}
          </li>
        ))}
    </ul>
  )
}
