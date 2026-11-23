import type { components } from './schema'

type Schemas = components['schemas']

export type Project = Schemas['Project']
export type StoreSettings = Schemas['StoreSettings']
export type Employee = Schemas['Employee']
export type AvailabilityEntry = Schemas['AvailabilityEntry']
export type Rules = Schemas['Rules']
export type Shift = Schemas['Shift']
export type MonthCalendar = Schemas['MonthCalendar']
export type CalendarDay = Schemas['CalendarDay']
export type DayType = CalendarDay['dayType']
export type ApiError = Schemas['ApiError']

/** Must match the backend. Fails to compile if the generated schema moves to a new version. */
export const CURRENT_SCHEMA_VERSION: Project['schemaVersion'] = 1
