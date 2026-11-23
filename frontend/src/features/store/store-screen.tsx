import { OpeningHoursSection } from './opening-hours-section'
import { SpecialDatesSection } from './special-dates-section'
import { StaffingSection } from './staffing-section'

export function StoreScreen() {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <OpeningHoursSection />
      <SpecialDatesSection />
      <StaffingSection className="xl:col-span-2" />
    </div>
  )
}
