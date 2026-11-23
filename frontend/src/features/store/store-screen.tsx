import { useProject } from '@/project/hooks'

import { GuestsSection } from './guests-section'
import { OpeningHoursSection } from './opening-hours-section'
import { SpecialDatesSection } from './special-dates-section'
import { StaffingSection } from './staffing-section'

export function StoreScreen() {
  const { guestDemand } = useProject()
  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <OpeningHoursSection />
      <SpecialDatesSection />
      <StaffingSection className="xl:col-span-2" />
      {guestDemand.enabled && <GuestsSection className="xl:col-span-2" />}
    </div>
  )
}
