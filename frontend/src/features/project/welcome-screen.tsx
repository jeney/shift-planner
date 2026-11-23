import { FilePlus2, FolderOpen, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MonthPicker } from '@/components/month-picker'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { nextMonth } from '@/lib/month'

import { ProjectFileInput } from './file-input'
import { useProjectActions } from './use-project-actions'

export function WelcomeScreen() {
  const { t } = useTranslation()
  const actions = useProjectActions()
  const [month, setMonth] = useState(nextMonth)
  const fileInput = useRef<HTMLInputElement>(null)

  const spinner = <Loader2 aria-hidden className="size-4 animate-spin" />

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-10 py-6 sm:py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('welcome.title')}
        </h1>
        <p className="max-w-xl text-balance text-muted-foreground">{t('welcome.subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <FilePlus2 aria-hidden className="mb-2 size-6 text-primary" />
            <CardTitle>{t('welcome.newTitle')}</CardTitle>
            <CardDescription>{t('welcome.newDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthPicker value={month} onChange={setMonth} />
          </CardContent>
          <CardFooter className="mt-auto">
            <Button
              className="w-full"
              disabled={actions.busy !== null}
              onClick={() => void actions.createNew(month)}
            >
              {actions.busy === 'new' && spinner}
              {t('project.create')}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <Sparkles aria-hidden className="mb-2 size-6 text-primary" />
            <CardTitle>{t('welcome.demoTitle')}</CardTitle>
            <CardDescription>{t('welcome.demoDescription')}</CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto">
            <Button
              variant="secondary"
              className="w-full"
              disabled={actions.busy !== null}
              onClick={() => void actions.loadDemo(month)}
            >
              {actions.busy === 'demo' && spinner}
              {t('project.demo')}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <FolderOpen aria-hidden className="mb-2 size-6 text-primary" />
            <CardTitle>{t('welcome.openTitle')}</CardTitle>
            <CardDescription>{t('welcome.openDescription')}</CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto">
            <Button
              variant="outline"
              className="w-full"
              disabled={actions.busy !== null}
              onClick={() => fileInput.current?.click()}
            >
              {actions.busy === 'open' && spinner}
              {t('welcome.chooseFile')}
            </Button>
            <ProjectFileInput ref={fileInput} onFile={(file) => void actions.openFile(file)} />
          </CardFooter>
        </Card>
      </div>

      <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <ShieldCheck aria-hidden className="size-4 shrink-0" />
        {t('welcome.privacy')}
      </p>
    </section>
  )
}
