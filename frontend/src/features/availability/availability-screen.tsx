import { CalendarRange, Plus, Rows3, User, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useMonthCalendar } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { useProject } from '@/project/hooks'

import { EntryDialog } from './entry-dialog'
import { EntryList } from './entry-list'
import { KindIcon } from './kind-badge'
import { KIND_STYLE, KINDS, type Kind } from './model'
import { MonthCalendar } from './month-calendar'
import { TeamOverview } from './team-overview'

export function AvailabilityScreen() {
  const { t } = useTranslation()
  const project = useProject()
  const calendar = useMonthCalendar(project.month)
  const employees = project.employees.filter((e) => e.active)
  const [view, setView] = useState<'person' | 'team'>('person')
  const [mode, setMode] = useState<Kind>('unavailable')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const selected = employees.find((e) => e.id === selectedId) ?? employees[0]
  const days = calendar.data?.days ?? []

  if (employees.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
        <Users aria-hidden className="size-8 opacity-40" />
        <p className="font-medium text-foreground">{t('availability.noEmployeesTitle')}</p>
        <p className="max-w-sm text-sm">{t('availability.noEmployeesBody')}</p>
      </Card>
    )
  }

  return (
    <div className="grid gap-4">
      <Card className="flex flex-row flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <ToggleGroup
          type="single"
          variant="outline"
          value={view}
          aria-label={t('availability.view')}
          onValueChange={(v) => v && setView(v as 'person' | 'team')}
        >
          <ToggleGroupItem value="person" className="gap-1.5 px-3">
            <User aria-hidden className="size-4" />
            {t('availability.personView')}
          </ToggleGroupItem>
          <ToggleGroupItem value="team" className="gap-1.5 px-3">
            <Rows3 aria-hidden className="size-4" />
            {t('availability.teamView')}
          </ToggleGroupItem>
        </ToggleGroup>

        {view === 'person' && selected && (
          <Select value={selected.id} onValueChange={setSelectedId}>
            <SelectTrigger aria-label={t('availability.person')} className="min-w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: e.color }}
                  />
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <span className="text-sm text-muted-foreground">{t('availability.clickAdds')}</span>
          <ToggleGroup
            type="single"
            variant="outline"
            value={mode}
            aria-label={t('availability.mode')}
            onValueChange={(v) => v && setMode(v as Kind)}
          >
            {KINDS.map((kind) => (
              <ToggleGroupItem
                key={kind}
                value={kind}
                className={cn('gap-1.5 px-3', mode === kind && KIND_STYLE[kind].chip)}
              >
                <KindIcon kind={kind} className={cn(mode === kind && 'text-current')} />
                {t(`availability.modes.${kind}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </Card>

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <CalendarRange aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          {t('availability.hint')}{' '}
          <strong className="font-medium text-foreground">{t('availability.hardExplained')}</strong>{' '}
          {t('availability.wishExplained')}
        </span>
      </p>

      {view === 'team' ? (
        <TeamOverview
          days={days}
          employees={employees}
          entries={project.availability}
          mode={mode}
          onSelectEmployee={(id) => {
            setSelectedId(id)
            setView('person')
          }}
        />
      ) : (
        selected && (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
            <Card className="p-4">
              <MonthCalendar
                days={days}
                employeeId={selected.id}
                entries={project.availability}
                mode={mode}
              />
            </Card>
            <Card className="grid gap-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {t('availability.rulesFor', { name: selected.name })}
                </h3>
                <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
                  <Plus aria-hidden className="size-4" />
                  {t('availability.add')}
                </Button>
              </div>
              <EntryList
                entries={project.availability.filter((e) => e.employeeId === selected.id)}
              />
            </Card>
            <EntryDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              employeeId={selected.id}
              initialKind={mode}
              firstDate={days[0]?.date ?? `${project.month}-01`}
              lastDate={days.at(-1)?.date ?? `${project.month}-28`}
            />
          </div>
        )
      )}
    </div>
  )
}
