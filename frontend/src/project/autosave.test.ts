import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeProject } from '@/test/fixtures'
import { mockApi } from '@/test/mock-api'

import {
  AUTOSAVE_BACKUP_KEY,
  AUTOSAVE_KEY,
  readAutosave,
  restoreAutosave,
  startAutosave,
} from './autosave'
import { useProjectStore } from './store'

describe('autosave', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: null })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('writes the project shortly after each change', () => {
    vi.useFakeTimers()
    const stop = startAutosave(100)
    useProjectStore.getState().setProject(makeProject())
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()

    vi.advanceTimersByTime(100)
    expect(readAutosave()).toMatchObject({ id: 'project-1' })

    useProjectStore.getState().updateProject((draft) => {
      draft.name = 'Renamed'
    })
    vi.advanceTimersByTime(100)
    expect(readAutosave()).toMatchObject({ name: 'Renamed' })

    useProjectStore.getState().setProject(null)
    vi.advanceTimersByTime(100)
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()
    stop()
  })

  it('flushes pending changes when the page is hidden', () => {
    vi.useFakeTimers()
    const stop = startAutosave(10_000)
    useProjectStore.getState().setProject(makeProject())
    window.dispatchEvent(new Event('pagehide'))
    expect(readAutosave()).toMatchObject({ id: 'project-1' })
    stop()
  })

  it('restores a current-version project synchronously', async () => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(makeProject()))
    const pending = restoreAutosave()
    expect(useProjectStore.getState().project?.id).toBe('project-1')
    await expect(pending).resolves.toBe('restored')
  })

  it('returns "none" when nothing is saved or the data is corrupt', async () => {
    await expect(restoreAutosave()).resolves.toBe('none')
    localStorage.setItem(AUTOSAVE_KEY, '{not json')
    await expect(restoreAutosave()).resolves.toBe('none')
  })

  it('migrates an older project through the API', async () => {
    const migrated = makeProject({ name: 'Migrated' })
    mockApi({ 'POST /api/project/migrate': () => Response.json(migrated) })
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ schemaVersion: 0, legacy: true }))
    await expect(restoreAutosave()).resolves.toBe('migrated')
    expect(useProjectStore.getState().project?.name).toBe('Migrated')
  })

  it('keeps a backup when migration fails', async () => {
    mockApi({
      'POST /api/project/migrate': () =>
        Response.json({ code: 'project.invalid', params: {}, details: [] }, { status: 422 }),
    })
    const legacy = { schemaVersion: 0, legacy: true }
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(legacy))
    await expect(restoreAutosave()).resolves.toBe('failed')
    expect(JSON.parse(localStorage.getItem(AUTOSAVE_BACKUP_KEY)!)).toEqual(legacy)
    expect(useProjectStore.getState().project).toBeNull()
  })
})
