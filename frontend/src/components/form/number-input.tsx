import { useState, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type InputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'>

interface NumberInputProps extends InputProps {
  value: number | null
  onValueChange: (value: number | null) => void
  min?: number
  max?: number
  /** Allow an empty field, reported as `null`. */
  nullable?: boolean
  /** Shown after the field, e.g. "h" or "min". */
  suffix?: string
  maxFractionDigits?: number
}

function parse(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, '').replace(',', '.').replace('−', '-')
  if (normalized === '' || normalized === '-') return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : Number.NaN
}

/**
 * Locale-friendly number field: accepts "2,5" and "2.5", only commits valid values in range,
 * and restores the last valid value on blur.
 */
export function NumberInput({
  value,
  onValueChange,
  min,
  max,
  nullable = false,
  suffix,
  maxFractionDigits = 2,
  className,
  onBlur,
  ...props
}: NumberInputProps) {
  const { i18n } = useTranslation()
  const format = (v: number | null) =>
    v === null
      ? ''
      : new Intl.NumberFormat(i18n.language, {
          maximumFractionDigits: maxFractionDigits,
          useGrouping: false,
        }).format(v)

  // While focused, the user's raw text; otherwise the formatted value.
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? format(value)

  const parsed = parse(text)
  const invalid =
    (parsed === null && !nullable) ||
    (parsed !== null &&
      (Number.isNaN(parsed) ||
        (min !== undefined && parsed < min) ||
        (max !== undefined && parsed > max)))

  return (
    <div className={cn('relative', className)}>
      <Input
        {...props}
        inputMode="decimal"
        autoComplete="off"
        value={text}
        aria-invalid={invalid || undefined}
        className={cn('tabular-nums', suffix && 'pr-10')}
        onFocus={() => setDraft(format(value))}
        onChange={(event) => {
          setDraft(event.target.value)
          const next = parse(event.target.value)
          const ok =
            (next === null && nullable) ||
            (next !== null &&
              !Number.isNaN(next) &&
              (min === undefined || next >= min) &&
              (max === undefined || next <= max))
          if (ok && next !== value) onValueChange(next)
        }}
        onBlur={(event) => {
          setDraft(null)
          onBlur?.(event)
        }}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  )
}
