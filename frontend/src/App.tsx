import { AppHeader } from '@/components/app-header'
import { PlannerTabs } from '@/features/planner/planner-tabs'
import { WelcomeScreen } from '@/features/project/welcome-screen'
import { useProjectStore } from '@/project/store'

export default function App() {
  const hasProject = useProjectStore((s) => s.project !== null)

  return (
    <div className="min-h-svh bg-muted/30">
      <AppHeader />
      <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
        {hasProject ? <PlannerTabs /> : <WelcomeScreen />}
      </main>
    </div>
  )
}
