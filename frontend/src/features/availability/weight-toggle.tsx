import { useTranslation } from 'react-i18next'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const WEIGHTS = { low: 0.5, normal: 1, high: 2 } as const

/** How much a wish matters: low / normal / high, stored as a weight multiplier. */
export function WeightToggle({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const { t } = useTranslation()
  const current = Object.entries(WEIGHTS).find(([, w]) => w === value)?.[0] ?? ''
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={current}
      aria-label={t('availability.importance')}
      onValueChange={(v) => v && onChange(WEIGHTS[v as keyof typeof WEIGHTS])}
      className="justify-start"
    >
      {(Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).map((key) => (
        <ToggleGroupItem key={key} value={key}>
          {t(`availability.weights.${key}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
