import { useTranslation } from 'react-i18next'

import { useHealth } from '@/api/queries'
import { cn } from '@/lib/utils'

export function ApiStatus() {
  const { t } = useTranslation()
  const { isPending, isError } = useHealth()

  const state = isPending ? 'checking' : isError ? 'offline' : 'online'

  return (
    <span
      role="status"
      data-state={state}
      className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex"
    >
      <span
        aria-hidden
        className={cn(
          'size-2 rounded-full',
          state === 'online' && 'bg-emerald-500',
          state === 'offline' && 'bg-destructive',
          state === 'checking' && 'animate-pulse bg-muted-foreground',
        )}
      />
      {t(`api.${state}`)}
    </span>
  )
}
