import { useId, type ReactNode } from 'react'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface SwitchFieldProps {
  label: ReactNode
  help?: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function SwitchField({
  label,
  help,
  checked,
  onCheckedChange,
  disabled,
  className,
}: SwitchFieldProps) {
  const id = useId()
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="grid gap-1">
        <Label htmlFor={id} className="leading-snug">
          {label}
        </Label>
        {help && <p className="text-xs leading-relaxed text-muted-foreground">{help}</p>}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="mt-0.5"
      />
    </div>
  )
}
