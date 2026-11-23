import type { ApiError } from '@/api/types'

export type ErrorKey =
  | 'errors.offline'
  | 'errors.unknown'
  | 'errors.fileNotJson'
  | 'errors.project.missingSchemaVersion'
  | 'errors.project.newerSchemaVersion'
  | 'errors.project.noMigration'
  | 'errors.project.invalid'

const API_CODES: Record<string, ErrorKey> = {
  'project.missingSchemaVersion': 'errors.project.missingSchemaVersion',
  'project.newerSchemaVersion': 'errors.project.newerSchemaVersion',
  'project.noMigration': 'errors.project.noMigration',
  'project.invalid': 'errors.project.invalid',
}

/** An error the UI can show: a translation key plus its parameters. */
export class AppError extends Error {
  readonly key: ErrorKey
  readonly params: Record<string, unknown>
  readonly details: string[]

  constructor(key: ErrorKey, params: Record<string, unknown> = {}, details: string[] = []) {
    super(key)
    this.name = 'AppError'
    this.key = key
    this.params = params
    this.details = details
  }
}

export function isApiError(value: unknown): value is ApiError {
  return typeof value === 'object' && value !== null && typeof (value as ApiError).code === 'string'
}

export function fromApiError(error: ApiError): AppError {
  return new AppError(
    API_CODES[error.code] ?? 'errors.unknown',
    error.params ?? {},
    (error.details ?? []).map((d) => `${d.loc.join('.')}: ${d.message}`),
  )
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (isApiError(error)) return fromApiError(error)
  // fetch() rejects with a TypeError when the server can't be reached.
  if (error instanceof TypeError) return new AppError('errors.offline')
  return new AppError('errors.unknown')
}
