import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SUPPORTED_LANGUAGES } from '@/i18n'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const current = i18n.resolvedLanguage ?? 'en'

  return (
    <Select value={current} onValueChange={(lng) => void i18n.changeLanguage(lng)}>
      <SelectTrigger size="sm" aria-label={t('header.language')} className="gap-1.5">
        <Languages aria-hidden className="size-4 opacity-70" />
        <SelectValue>
          <span className="sm:hidden">
            {SUPPORTED_LANGUAGES.find((l) => l.code === current)?.short}
          </span>
          <span className="hidden sm:inline">
            {SUPPORTED_LANGUAGES.find((l) => l.code === current)?.label}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
