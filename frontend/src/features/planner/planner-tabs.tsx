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

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const STEPS = [
  { id: 'store', icon: Store },
  { id: 'employees', icon: Users },
  { id: 'availability', icon: CalendarDays },
  { id: 'generate', icon: Sparkles },
  { id: 'plan', icon: Table2 },
  { id: 'export', icon: Download },
  { id: 'advanced', icon: SlidersHorizontal },
] as const satisfies readonly { id: string; icon: LucideIcon }[]

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

      {STEPS.map(({ id, icon: Icon }) => (
        <TabsContent key={id} value={id}>
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
        </TabsContent>
      ))}
    </Tabs>
  )
}
