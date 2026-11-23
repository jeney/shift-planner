import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { KIND_STYLE, type Kind } from './model'

export function KindIcon({ kind, className }: { kind: Kind; className?: string }) {
  const Icon = KIND_STYLE[kind].icon
  return <Icon aria-hidden className={cn('size-3.5', KIND_STYLE[kind].text, className)} />
}

/** "Unavailable · Hard" / "Prefers a day off · Wish" chip. */
export function KindChip({ kind, className }: { kind: Kind; className?: string }) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
        KIND_STYLE[kind].chip,
        className,
      )}
    >
      <KindIcon kind={kind} className="text-current" />
      {t(`availability.kinds.${kind}`)}
      <span className="opacity-70">
        · {t(KIND_STYLE[kind].hard ? 'availability.hard' : 'availability.wish')}
      </span>
    </span>
  )
}
