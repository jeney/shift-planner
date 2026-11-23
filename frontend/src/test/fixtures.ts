import type { Employee, Project } from '@/api/types'

const day = (opens: string, closes: string) => ({ closed: false, opens, closes })
const staffing = () => ({
  minAtOpening: 1,
  minAtClosing: 1,
  dailyHoursMin: null,
  dailyHoursMax: null,
})

/** A complete project with backend defaults. Typed, so schema changes break it at compile time. */
export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 3,
    id: 'project-1',
    name: 'Test plan',
    month: '2027-02',
    store: {
      name: 'Test Store',
      openingHours: {
        monday: day('07:00', '20:00'),
        tuesday: day('07:00', '18:00'),
        wednesday: day('07:00', '18:00'),
        thursday: day('07:00', '18:00'),
        friday: day('07:00', '20:00'),
        saturday: day('07:00', '18:00'),
        sunday: day('07:00', '18:00'),
      },
      publicHolidayHours: day('07:00', '18:00'),
      specialDates: [],
      staffBeforeOpeningMin: 60,
      staffAfterClosingMin: 30,
      allowWorkingAlone: false,
      staffing: {
        weekday: staffing(),
        saturday: staffing(),
        sunday: staffing(),
        holiday: staffing(),
      },
      dailyHoursHard: false,
      timeRangeMinimums: [],
    },
    employees: [],
    availability: [],
    rules: {
      granularityMin: 30,
      minShiftHours: 3,
      maxShiftHours: 8,
      maxHoursPerDay: null,
      oneShiftPerDay: true,
      minRestHours: 11,
      maxConsecutiveDays: 6,
      maxWeeklyHours: 48,
      fullTimeThresholdHours: 37,
      fullTimeContractWarning: true,
      monthlyToleranceHours: 2,
      monthlyHardLimitHours: null,
      balancingPeriodWeeks: 16,
      monthlyTargetMode: 'weeks_per_month',
      holidaysReduceTarget: false,
      teamAdjustmentHours: 0,
      breaks: { enabled: false, paid: false, rules: [{ afterHours: 6, minutes: 30 }] },
      busRule: {
        enabled: true,
        earlyCutoff: { weekday: '06:30', saturday: '07:30', sunday: '08:30', holiday: '08:30' },
        lateEnabled: false,
        lateCutoff: { weekday: '20:00', saturday: '20:00', sunday: '20:00', holiday: '20:00' },
      },
    },
    weights: {
      wishOff: 10,
      wishWork: 4,
      hourBalance: 5,
      beyondTolerance: 50,
      dailyTarget: 3,
      shortGap: 0.5,
      contiguousDaysOff: 0.5,
    },
    guestDemand: {
      enabled: false,
      mode: 'linear',
      points: [
        { guests: 1000, hours: 20 },
        { guests: 1250, hours: 25 },
        { guests: 1500, hours: 30 },
      ],
      toleranceHours: 2,
      guestsByDate: {},
    },
    solver: { timeLimitSeconds: 20 },
    plan: null,
    ...overrides,
  }
}

export function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'employee-1',
    name: 'Test Person',
    color: '#2563eb',
    active: true,
    contractHoursPerWeek: 20,
    hasCar: false,
    needsRideEarly: false,
    needsRideLate: false,
    allowedDriverIds: null,
    overrides: {
      minShiftHours: null,
      maxShiftHours: null,
      maxHoursPerDay: null,
      minRestHours: null,
      maxConsecutiveDays: null,
      maxWeeklyHours: null,
    },
    balance: {
      carryInHours: 0,
      periodWeek: 1,
      lastShiftEndedAt: null,
      consecutiveDaysAtStart: 0,
    },
    ...overrides,
  }
}

type CalendarDay = import('@/api/types').CalendarDay
type MonthCalendar = import('@/api/types').MonthCalendar

/** A month calendar like the backend's, with the given holidays and notable days. */
export function makeCalendar(
  month: string,
  extras: {
    holidays?: Record<string, NonNullable<CalendarDay['holiday']>>
    notable?: Record<string, NonNullable<CalendarDay['notable']>>
  } = {},
): MonthCalendar {
  const [year, mon] = month.split('-').map(Number)
  const length = new Date(year, mon, 0).getDate()
  const days: CalendarDay[] = Array.from({ length }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`
    const weekday = (new Date(year, mon - 1, i + 1).getDay() + 6) % 7
    const holiday = extras.holidays?.[date] ?? null
    return {
      date,
      weekday,
      isoWeek: 1,
      dayType: holiday
        ? 'holiday'
        : weekday === 5
          ? 'saturday'
          : weekday === 6
            ? 'sunday'
            : 'weekday',
      holiday,
      notable: extras.notable?.[date] ?? null,
    }
  })
  return { month, days }
}
