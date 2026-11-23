import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { monthNames, parseMonth, toMonthString } from '@/lib/month'

interface MonthPickerProps {
  value: string
  onChange: (value: string) => void
  id?: string
}

export function MonthPicker({ value, onChange, id }: MonthPickerProps) {
  const { t, i18n } = useTranslation()
  const { year, month } = parseMonth(value)
  const thisYear = new Date().getFullYear()
  const years = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2]
  if (!years.includes(year)) years.push(year)

  return (
    <div className="flex gap-2">
      <Select value={String(month)} onValueChange={(m) => onChange(toMonthString(year, Number(m)))}>
        <SelectTrigger id={id} aria-label={t('project.month')} className="flex-1 capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {monthNames(i18n.language).map((name, index) => (
            <SelectItem key={name} value={String(index + 1)} className="capitalize">
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(year)} onValueChange={(y) => onChange(toMonthString(Number(y), month))}>
        <SelectTrigger aria-label={t('project.year')} className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.sort().map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
