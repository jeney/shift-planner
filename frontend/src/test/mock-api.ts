import { vi } from 'vitest'

type Handler = (request: Request) => Response | Promise<Response>

/**
 * Stub global fetch with handlers keyed by "METHOD /path". Unmatched requests return 404.
 * Returns the mock so tests can inspect calls.
 */
export function mockApi(handlers: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const url = new URL(request.url)
    const handler = handlers[`${request.method} ${url.pathname}`]
    return handler ? handler(request) : new Response('Not found', { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export const healthOk = () => Response.json({ status: 'ok', version: 'test' })
