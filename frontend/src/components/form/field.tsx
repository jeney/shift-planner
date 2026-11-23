import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FieldProps {
  label: ReactNode
  htmlFor?: string
  help?: ReactNode
  error?: ReactNode
  className?: string
  children: ReactNode
}

/** Label + control + optional help text and error message. */
export function Field({ label, htmlFor, help, error, className, children }: FieldProps) {
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        help && <p className="text-xs leading-relaxed text-muted-foreground">{help}</p>
      )}
    </div>
  )
}
