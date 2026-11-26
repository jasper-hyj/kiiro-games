/** The Worker's entry: the JSON API, the WebSocket routes to the Durable Objects, and the daily clean-up. */
import { routePartykitRequest } from 'partyserver'
import type { Env } from './d1'
import { handleApi } from './api'
import { trimReplays } from './matches'

export { Main } from './durable/main'
export { Room } from './durable/room'
export { Play } from './durable/play'

export default {
  /** daily: drop replay logs older than 90 days (summaries stay) */
  async scheduled(_e: unknown, env: Env): Promise<void> {
    if (env.DB) await trimReplays(env.DB)
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname.endsWith('/__prepare')) return new Response('Not found', { status: 404 }) // only a room may prepare a table
    const api = await handleApi(request, env)
    if (api) return api
    return (await routePartykitRequest(request, env as never)) || new Response('Kiiro Games server', { status: 200 })
  },
}
