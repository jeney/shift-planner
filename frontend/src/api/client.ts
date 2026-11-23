import createClient from 'openapi-fetch'

import type { paths } from './schema'

/**
 * Typed API client. Types are generated from the backend's OpenAPI spec
 * (`npm run gen:api`), so frontend and backend can't drift apart.
 * Requests go to same-origin `/api`: Vite proxies it in dev, nginx in production.
 */
export const api = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? window.location.origin,
  // Resolve fetch at call time (not import time) so it can be stubbed in tests.
  fetch: (request) => globalThis.fetch(request),
})
