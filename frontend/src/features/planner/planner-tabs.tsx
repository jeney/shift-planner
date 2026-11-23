import {
  CalendarDays,
  Download,
  Loader2,
  SlidersHorizontal,
  Sparkles,
  Store,
  Table2,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { lazy, Suspense, type ComponentType } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Each step is its own chunk, loaded when first opened.
const AdvancedScreen = lazy(() =>
  import('@/features/advanced/advanced-screen').then((m) => ({ default: m.AdvancedScreen })),
)
const AvailabilityScreen = lazy(() =>
  import('@/features/availability/availability-screen').then((m) => ({
    default: m.AvailabilityScreen,
  })),
)
const EmployeesScreen = lazy(() =>
  import('@/features/employees/employees-screen').then((m) => ({ default: m.EmployeesScreen })),
)
const ExportScreen = lazy(() =>
  import('@/features/export/export-screen').then((m) => ({ default: m.ExportScreen })),
)
const GenerateScreen = lazy(() =>
  import('@/features/generate/generate-screen').then((m) => ({ default: m.GenerateScreen })),
)
const PlanScreen = lazy(() =>
  import('@/features/plan/plan-screen').then((m) => ({ default: m.PlanScreen })),
)
const StoreScreen = lazy(() =>
  import('@/features/store/store-screen').then((m) => ({ default: m.StoreScreen })),
)

const STEPS = [
  { id: 'store', icon: Store, screen: StoreScreen },
  { id: 'employees', icon: Users, screen: EmployeesScreen },
  { id: 'availability', icon: CalendarDays, screen: AvailabilityScreen },
  { id: 'generate', icon: Sparkles, screen: GenerateScreen },
  { id: 'plan', icon: Table2, screen: PlanScreen },
  { id: 'export', icon: Download, screen: ExportScreen },
  { id: 'advanced', icon: SlidersHorizontal, screen: AdvancedScreen },
] as const satisfies readonly { id: string; icon: LucideIcon; screen: ComponentType | null }[]

export function PlannerTabs() {
  const { t } = useTranslation()

  return (
    <Tabs defaultValue="store" className="gap-6">
      <TabsList className="w-full [scrollbar-width:thin] justify-start overflow-x-auto overflow-y-hidden">
        {STEPS.map(({ id, icon: Icon }, index) => (
          <TabsTrigger
            key={id}
            value={id}
            className={id === 'advanced' ? 'flex-none gap-2 lg:ml-auto' : 'flex-none gap-2'}
          >
            <Icon aria-hidden className="size-4" />
            {id !== 'advanced' && <span className="tabular-nums">{index + 1}.</span>}
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
              <Suspense
                fallback={
                  <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                    {t('common.loading')}
                  </div>
                }
              >
                <Screen />
              </Suspense>
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
