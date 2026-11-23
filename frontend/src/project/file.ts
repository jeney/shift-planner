import { migrateProject } from '@/api/project-api'
import { CURRENT_SCHEMA_VERSION, type Project } from '@/api/types'
import { AppError } from '@/lib/errors'

export const PROJECT_FILE_EXTENSION = '.shiftplan.json'

export function projectFileName(project: Project): string {
  const slug =
    project.name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'shift-plan'
  return `${slug}-${project.month}${PROJECT_FILE_EXTENSION}`
}

export function serializeProject(project: Project): string {
  return `${JSON.stringify(project, null, 2)}\n`
}

/** Offer the project as a .json download. Returns the file name. */
export function downloadProject(project: Project): string {
  const fileName = projectFileName(project)
  const url = URL.createObjectURL(
    new Blob([serializeProject(project)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return fileName
}

export async function parseProjectFile(file: Blob): Promise<Record<string, unknown>> {
  let value: unknown
  try {
    value = JSON.parse(await file.text())
  } catch {
    throw new AppError('errors.fileNotJson')
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppError('errors.fileNotJson')
  }
  return value as Record<string, unknown>
}

/**
 * Validate (and if needed upgrade) a saved project via the API. If the API is unreachable,
 * a file already in the current format is accepted as-is.
 */
export async function loadProjectFile(file: Blob): Promise<Project> {
  const raw = await parseProjectFile(file)
  try {
    return await migrateProject(raw)
  } catch (error) {
    if (error instanceof TypeError && raw.schemaVersion === CURRENT_SCHEMA_VERSION) {
      return raw as unknown as Project
    }
    throw error
  }
}
