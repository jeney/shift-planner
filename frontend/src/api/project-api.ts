import { AppError, fromApiError, isApiError } from '@/lib/errors'

import { api } from './client'
import type { MonthCalendar, Project } from './types'

function unwrap<T>(data: T | undefined, error: unknown): T {
  if (data !== undefined) return data
  throw isApiError(error) ? fromApiError(error) : new AppError('errors.unknown')
}

export async function fetchNewProject(month: string): Promise<Project> {
  const { data, error } = await api.GET('/api/project/new', { params: { query: { month } } })
  return unwrap(data, error)
}

export async function fetchDemoProject(month: string): Promise<Project> {
  const { data, error } = await api.GET('/api/project/demo', { params: { query: { month } } })
  return unwrap(data, error)
}

/** Upgrade a saved project to the current schema version and validate it on the server. */
export async function migrateProject(raw: Record<string, unknown>): Promise<Project> {
  const { data, error } = await api.POST('/api/project/migrate', { body: raw })
  return unwrap(data, error)
}

export async function fetchMonthCalendar(month: string): Promise<MonthCalendar> {
  const { data, error } = await api.GET('/api/calendar/{month}', {
    params: { path: { month } },
  })
  return unwrap(data, error)
}
