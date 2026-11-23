import type { ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type InputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'>

interface TimeInputProps extends InputProps {
  value: string | null
  onValueChange: (value: string | null) => void
  /** Allow clearing the field, reported as `null`. */
  nullable?: boolean
  stepMinutes?: number
}

/** Native 24-hour time field ("HH:MM"). */
export function TimeInput({
  value,
  onValueChange,
  nullable = false,
  stepMinutes = 5,
  className,
  ...props
}: TimeInputProps) {
  return (
    <Input
      {...props}
      type="time"
      step={stepMinutes * 60}
      value={value ?? ''}
      className={cn('w-[7.5rem] tabular-nums', className)}
      onChange={(event) => {
        const next = event.target.value.slice(0, 5)
        if (next) onValueChange(next)
        else if (nullable) onValueChange(null)
      }}
    />
  )
}
