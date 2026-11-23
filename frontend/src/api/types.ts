import type { components } from './schema'

type Schemas = components['schemas']

// Models used both as request and response bodies are split by OpenAPI into "-Input" (fields
// with defaults optional) and "-Output" (everything present). The app works with complete
// objects, so it uses the "-Output" shapes; they're also valid request bodies.
export type Project = Schemas['Project-Output']
export type StoreSettings = Schemas['StoreSettings-Output']
export type Employee = Schemas['Employee-Output']
export type AvailabilityEntry = Schemas['AvailabilityEntry-Output']
export type Rules = Schemas['Rules-Output']
export type Shift = Schemas['Shift-Output']
export type Plan = Schemas['Plan-Output']
export type MonthCalendar = Schemas['MonthCalendar']
export type CalendarDay = Schemas['CalendarDay']
export type DayType = CalendarDay['dayType']
export type ApiError = Schemas['ApiError']
export type SolveResponse = Schemas['SolveResponse']
export type Violation = Schemas['Violation']
export type Diagnostic = Schemas['Diagnostic']
export type EmployeeStats = Schemas['EmployeeStats']

/** Must match the backend. Fails to compile if the generated schema moves to a new version. */
export const CURRENT_SCHEMA_VERSION: Project['schemaVersion'] = 3
export type WishOutcome = Schemas['WishOutcome']
export type ValidateResponse = Schemas['ValidateResponse']
