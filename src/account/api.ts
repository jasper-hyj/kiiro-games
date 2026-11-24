/** Talks to the Worker's /api routes. The session token lives in localStorage and is sent as a Bearer header. */
// accept the host with or without https:// and a trailing slash
const envHost = ((import.meta.env.VITE_PARTYKIT_HOST as string | undefined) || '').trim().replace(/^(https?|wss?):\/\//, '').replace(/\/+$/, '')
const host = envHost || `${location.hostname || 'localhost'}:8787`
const local = /^(localhost|127\.|192\.168\.|10\.|\[?::1)/.test(host)
export const API_BASE = `${local ? 'http' : 'https'}://${host}/api`
/** false on a deployed site with no Worker configured: accounts then stay hidden and everything works as a guest */
export const accountsAvailable = !!envHost || import.meta.env.DEV || ['localhost', '127.0.0.1', ''].includes(location.hostname)

const KEY = 'kiiro-token'
export const getToken = (): string | null => { try { return localStorage.getItem(KEY) } catch { return null } }
export const setToken = (t: string | null) => { try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY) } catch { /* ignore */ } }

export class ApiError extends Error { constructor(public status: number, public code: string) { super(code) } }

export async function api<T = any>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const token = getToken()
  let res: Response
  try {
    res = await fetch(API_BASE + path, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined })
  } catch { throw new ApiError(0, 'offline') }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error || 'error')
  return data as T
}

export interface Me { id: string; name: string; username: string | null; email: string; admin: boolean; season: string; balance: number; profit: number; level: number; games: number }
export interface BoardRow { rank: number; name: string; level: number; profit: number; games: number; score?: number; me?: boolean }
