import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppError } from '@/lib/errors'
import { makeProject } from '@/test/fixtures'
import { mockApi } from '@/test/mock-api'

import { loadProjectFile, parseProjectFile, projectFileName, serializeProject } from './file'

const blob = (text: string) => new Blob([text], { type: 'application/json' })

describe('project files', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('names files after the project and month', () => {
    expect(projectFileName(makeProject({ name: 'Plan for Café Ø', month: '2027-03' }))).toBe(
      'plan-for-cafe-2027-03.shiftplan.json',
    )
    expect(projectFileName(makeProject({ name: '!!!' }))).toBe('shift-plan-2027-02.shiftplan.json')
  })

  it('round-trips through save and open', async () => {
    const project = makeProject()
    mockApi({
      'POST /api/project/migrate': async (request) => Response.json(await request.json()),
    })
    await expect(loadProjectFile(blob(serializeProject(project)))).resolves.toEqual(project)
  })

  it('rejects files that are not JSON objects', async () => {
    await expect(parseProjectFile(blob('not json'))).rejects.toMatchObject({
      key: 'errors.fileNotJson',
    })
    await expect(parseProjectFile(blob('[1, 2]'))).rejects.toBeInstanceOf(AppError)
  })

  it('surfaces API validation errors as translatable errors', async () => {
    mockApi({
      'POST /api/project/migrate': () =>
        Response.json(
          {
            code: 'project.newerSchemaVersion',
            params: { version: 3, supported: 1 },
            details: [],
          },
          { status: 422 },
        ),
    })
    await expect(loadProjectFile(blob('{"schemaVersion": 3}'))).rejects.toMatchObject({
      key: 'errors.project.newerSchemaVersion',
      params: { version: 3, supported: 1 },
    })
  })

  it('opens a current-version file offline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    const project = makeProject()
    await expect(loadProjectFile(blob(JSON.stringify(project)))).resolves.toEqual(project)
  })
})
