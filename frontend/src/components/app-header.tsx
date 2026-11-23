import { CalendarClock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ApiStatus } from '@/components/api-status'
import { LanguageSwitcher } from '@/components/language-switcher'
import { ThemeToggle } from '@/components/theme-toggle'
import { ProjectMenu } from '@/features/project/project-menu'
import { ProjectTitle } from '@/features/project/project-title'

export function AppHeader() {
  const { t } = useTranslation()

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-4 sm:px-6">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <CalendarClock aria-hidden className="size-4" />
        </div>
        <span className="font-heading text-base font-semibold tracking-tight">{t('app.name')}</span>
        <div className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
        <ProjectMenu />
        <ProjectTitle />
        <div className="ml-auto flex items-center gap-2">
          <ApiStatus />
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
