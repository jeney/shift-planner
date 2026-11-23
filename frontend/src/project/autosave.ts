import { migrateProject } from '@/api/project-api'
import { CURRENT_SCHEMA_VERSION, type Project } from '@/api/types'

import { useProjectStore } from './store'

export const AUTOSAVE_KEY = 'shift-planner.project'
export const AUTOSAVE_BACKUP_KEY = 'shift-planner.project.backup'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readAutosave(): Record<string, unknown> | null {
  try {
    const text = localStorage.getItem(AUTOSAVE_KEY)
    if (!text) return null
    const value: unknown = JSON.parse(text)
    return isRecord(value) ? value : null
  } catch {
    return null
  }
}

export function writeAutosave(project: Project | null): void {
  try {
    if (project) localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project))
    else localStorage.removeItem(AUTOSAVE_KEY)
  } catch {
    // Storage full or unavailable (private mode): autosave is best-effort.
  }
}

export type RestoreResult = 'none' | 'restored' | 'migrated' | 'failed'

/**
 * Restore the autosaved project. A project in the current format is loaded synchronously;
 * an older one is upgraded through the API. If that fails, the raw data is kept as a backup.
 */
export async function restoreAutosave(): Promise<RestoreResult> {
  const raw = readAutosave()
  if (!raw) return 'none'
  if (raw.schemaVersion === CURRENT_SCHEMA_VERSION) {
    useProjectStore.getState().setProject(raw as unknown as Project)
    return 'restored'
  }
  try {
    useProjectStore.getState().setProject(await migrateProject(raw))
    return 'migrated'
  } catch {
    try {
      localStorage.setItem(AUTOSAVE_BACKUP_KEY, JSON.stringify(raw))
    } catch {
      // ignore
    }
    return 'failed'
  }
}

/** Save the project to localStorage shortly after every change. Returns an unsubscribe. */
export function startAutosave(delayMs = 400): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    writeAutosave(useProjectStore.getState().project)
  }
  const unsubscribe = useProjectStore.subscribe((state, previous) => {
    if (state.project === previous.project) return
    clearTimeout(timer)
    timer = setTimeout(flush, delayMs)
  })
  const onHide = () => {
    if (timer !== undefined) flush()
  }
  window.addEventListener('pagehide', onHide)
  return () => {
    onHide()
    unsubscribe()
    window.removeEventListener('pagehide', onHide)
  }
}
