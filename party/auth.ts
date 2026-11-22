import type { D1, Env } from './d1'

const enc = new TextEncoder()
export async function sha256(s: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', enc.encode(s))
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
}
function rand(bytes = 32): string {
  const a = crypto.getRandomValues(new Uint8Array(bytes))
  return [...a].map((x) => x.toString(16).padStart(2, '0')).join('')
}

const SESSION_MS = 90 * 24 * 3600e3
const MAGIC_MS = 15 * 60e3

export interface User { id: string; email: string; name: string; banned: number; games: number }

/** Allow `max` hits per `windowSec` for a key; returns false when the caller is over the limit. */
export async function allow(db: D1, key: string, max: number, windowSec: number): Promise<boolean> {
  const now = Date.now()
  const row = await db.prepare('SELECT n,reset FROM throttle WHERE key=?').bind(key).first<{ n: number; reset: number }>()
  if (!row || row.reset < now) {
    await db.prepare('INSERT OR REPLACE INTO throttle (key,n,reset) VALUES (?,?,?)').bind(key, 1, now + windowSec * 1000).run()
    return true
  }
  if (row.n >= max) return false
  await db.prepare('UPDATE throttle SET n=n+1 WHERE key=?').bind(key).run()
  return true
}

/** Display names: 2-16 visible characters, no control characters, no links. */
export function cleanName(raw: string, fallback = 'Player'): string {
  const s = String(raw ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16)
  if (s.length < 2 || /https?:|www\.|\.[a-z]{2,}\//i.test(s)) return fallback
  return s
}

export async function newSession(db: D1, userId: string): Promise<string> {
  const token = rand()
  await db.prepare('INSERT INTO sessions (hash,user_id,expires) VALUES (?,?,?)').bind(await sha256(token), userId, Date.now() + SESSION_MS).run()
  await db.prepare('DELETE FROM sessions WHERE expires < ?').bind(Date.now()).run()
  return token
}

export async function userFromToken(db: D1, token: string | null | undefined): Promise<User | null> {
  if (!token || token.length < 32 || token.length > 200) return null
  const row = await db.prepare(
    'SELECT u.id,u.email,u.name,u.banned,u.games FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>?').bind(await sha256(token), Date.now()).first<User>()
  if (!row || row.banned) return null
  return row
}

export async function endSession(db: D1, token: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE hash=?').bind(await sha256(token)).run()
}

/** Find or create the account for a verified email. A Google id, if given, is linked to it. */
export async function upsertUser(db: D1, email: string, nameHint: string, googleSub?: string): Promise<User> {
  email = email.toLowerCase()
  let u = await db.prepare('SELECT id,email,name,banned,games FROM users WHERE email=?').bind(email).first<User>()
  if (!u) {
    const id = rand(12)
    const name = cleanName(nameHint || email.split('@')[0], 'Player' + id.slice(0, 4))
    await db.prepare('INSERT INTO users (id,email,name,google_sub,created_at,games,banned,last_seen) VALUES (?,?,?,?,?,0,0,?)').bind(id, email, name, googleSub ?? null, Date.now(), Date.now()).run()
    u = { id, email, name, banned: 0, games: 0 }
  } else if (googleSub) {
    await db.prepare('UPDATE users SET google_sub=COALESCE(google_sub,?) WHERE id=?').bind(googleSub, u.id).run()
  }
  return u
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/

export async function startMagic(db: D1, env: Env, emailRaw: string, ip: string): Promise<{ ok: boolean; error?: string; devLink?: string }> {
  const email = String(emailRaw || '').trim().toLowerCase()
  if (!EMAIL.test(email) || email.length > 254) return { ok: false, error: 'bad_email' }
  if (!(await allow(db, 'mail:' + email, 3, 3600)) || !(await allow(db, 'mailip:' + ip, 10, 3600))) return { ok: false, error: 'slow_down' }
  const token = rand()
  await db.prepare('INSERT INTO magic (hash,email,expires) VALUES (?,?,?)').bind(await sha256(token), email, Date.now() + MAGIC_MS).run()
  await db.prepare('DELETE FROM magic WHERE expires < ?').bind(Date.now()).run()
  const link = `${(env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')}/?signin=${token}`
  if (env.DEV_MODE === '1') return { ok: true, devLink: link }
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return { ok: false, error: 'mail_not_configured' }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM, to: [email], subject: 'Your Kiiro Games sign-in link',
      text: `Open this link to sign in to Kiiro Games (valid for 15 minutes):\n\n${link}\n\nIf you did not ask for this, ignore this email.`,
    }),
  })
  return res.ok ? { ok: true } : { ok: false, error: 'mail_failed' }
}

export async function finishMagic(db: D1, token: string): Promise<{ user: User; token: string } | null> {
  if (!token || token.length < 32 || token.length > 200) return null
  const h = await sha256(token)
  const row = await db.prepare('SELECT email,expires FROM magic WHERE hash=?').bind(h).first<{ email: string; expires: number }>()
  if (!row) return null
  await db.prepare('DELETE FROM magic WHERE hash=?').bind(h).run() // single use
  if (row.expires < Date.now()) return null
  const user = await upsertUser(db, row.email, '')
  if (user.banned) return null
  return { user, token: await newSession(db, user.id) }
}

/** Verify a Google Identity Services credential with Google and check it was issued for this app. */
export async function finishGoogle(db: D1, env: Env, credential: string): Promise<{ user: User; token: string } | null> {
  if (!env.GOOGLE_CLIENT_ID || !credential || credential.length > 4000) return null
  const res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential))
  if (!res.ok) return null
  const info = (await res.json()) as { aud?: string; email?: string; email_verified?: string | boolean; sub?: string; name?: string; exp?: string }
  if (info.aud !== env.GOOGLE_CLIENT_ID || !info.email || !info.sub) return null
  if (info.email_verified !== true && info.email_verified !== 'true') return null
  const user = await upsertUser(db, info.email, info.name || '', info.sub)
  if (user.banned) return null
  return { user, token: await newSession(db, user.id) }
}

export function isAdmin(env: Env, email: string): boolean {
  const list = String(env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean)
  return list.includes(email.toLowerCase())
}
