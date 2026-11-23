import {
  CalendarDays,
  Download,
  SlidersHorizontal,
  Sparkles,
  Store,
  Table2,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ComponentType } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StoreScreen } from '@/features/store/store-screen'

const STEPS = [
  { id: 'store', icon: Store, screen: StoreScreen },
  { id: 'employees', icon: Users, screen: null },
  { id: 'availability', icon: CalendarDays, screen: null },
  { id: 'generate', icon: Sparkles, screen: null },
  { id: 'plan', icon: Table2, screen: null },
  { id: 'export', icon: Download, screen: null },
  { id: 'advanced', icon: SlidersHorizontal, screen: null },
] as const satisfies readonly { id: string; icon: LucideIcon; screen: ComponentType | null }[]

export function PlannerTabs() {
  const { t } = useTranslation()

  return (
    <Tabs defaultValue="store" className="gap-6">
      <TabsList className="h-auto w-full flex-wrap justify-start">
        {STEPS.map(({ id, icon: Icon }, index) => (
          <TabsTrigger
            key={id}
            value={id}
            className={id === 'advanced' ? 'gap-2 lg:ml-auto lg:flex-none' : 'gap-2 lg:flex-none'}
          >
            <Icon aria-hidden className="size-4" />
            {id !== 'advanced' && (
              <span className="text-muted-foreground tabular-nums">{index + 1}.</span>
            )}
            {t(`steps.${id}`)}
          </TabsTrigger>
        ))}
      </TabsList>

      {STEPS.map(({ id, icon: Icon, screen: Screen }) => (
        <TabsContent key={id} value={id} className="grid gap-4">
          {Screen ? (
            <>
              <header className="grid gap-1">
                <h2 className="font-heading text-xl font-semibold tracking-tight">
                  {t(`steps.${id}`)}
                </h2>
                <p className="text-sm text-muted-foreground">{t(`stepDescriptions.${id}`)}</p>
              </header>
              <Screen />
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">{t(`steps.${id}`)}</CardTitle>
                <CardDescription>{t(`stepDescriptions.${id}`)}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
                  <Icon aria-hidden className="size-8 opacity-40" />
                  <p className="font-medium text-foreground">{t('empty.comingSoon')}</p>
                  <p className="text-sm">{t('empty.comingSoonBody')}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      ))}
    </Tabs>
  )
}
