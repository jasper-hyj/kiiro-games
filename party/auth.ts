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

export interface User {
  id: string
  email: string
  name: string
  banned: number
  games: number
  role?: string | null
}

/** Allow `max` hits per `windowSec` for a key; returns false when the caller is over the limit. */
export async function allow(db: D1, key: string, max: number, windowSec: number): Promise<boolean> {
  const now = Date.now()
  const row = await db.prepare('SELECT n,reset FROM throttle WHERE key=?').bind(key).first<{ n: number; reset: number }>()
  if (!row || row.reset < now) {
    await db
      .prepare('INSERT OR REPLACE INTO throttle (key,n,reset) VALUES (?,?,?)')
      .bind(key, 1, now + windowSec * 1000)
      .run()
    return true
  }
  if (row.n >= max) return false
  await db.prepare('UPDATE throttle SET n=n+1 WHERE key=?').bind(key).run()
  return true
}

/** Display names: 2-16 visible characters, no control characters, no links. */
export function cleanName(raw: string, fallback = 'Player'): string {
  const s = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16)
  if (s.length < 2 || /https?:|www\.|\.[a-z]{2,}\//i.test(s)) return fallback
  return s
}

export async function newSession(db: D1, userId: string): Promise<string> {
  const token = rand()
  await db
    .prepare('INSERT INTO sessions (hash,user_id,expires) VALUES (?,?,?)')
    .bind(await sha256(token), userId, Date.now() + SESSION_MS)
    .run()
  await db.prepare('DELETE FROM sessions WHERE expires < ?').bind(Date.now()).run()
  return token
}

export async function userFromToken(db: D1, token: string | null | undefined): Promise<User | null> {
  if (!token || token.length < 32 || token.length > 200) return null
  const hash = await sha256(token)
  let row: User | null
  try {
    row = await db
      .prepare('SELECT u.id,u.email,u.name,u.banned,u.games,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>?')
      .bind(hash, Date.now())
      .first<User>()
  } catch {
    // the "role" column comes from migration 0003: until it is applied, sign-in must keep working (just without admin roles)
    row = await db
      .prepare('SELECT u.id,u.email,u.name,u.banned,u.games FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>?')
      .bind(hash, Date.now())
      .first<User>()
  }
  if (!row || row.banned) return null
  return row
}

export async function endSession(db: D1, token: string): Promise<void> {
  await db
    .prepare('DELETE FROM sessions WHERE hash=?')
    .bind(await sha256(token))
    .run()
}

/** Find or create the account for a verified email. A Google id, if given, is linked to it. */
export async function upsertUser(db: D1, email: string, nameHint: string, googleSub?: string): Promise<User> {
  email = email.toLowerCase()
  let u = await db.prepare('SELECT id,email,name,banned,games FROM users WHERE email=?').bind(email).first<User>()
  if (!u) {
    const id = rand(12)
    const name = cleanName(nameHint || email.split('@')[0], 'Player' + id.slice(0, 4))
    await db
      .prepare('INSERT INTO users (id,email,name,google_sub,created_at,games,banned,last_seen) VALUES (?,?,?,?,?,0,0,?)')
      .bind(id, email, name, googleSub ?? null, Date.now(), Date.now())
      .run()
    u = { id, email, name, banned: 0, games: 0 }
  } else if (googleSub) {
    await db.prepare('UPDATE users SET google_sub=COALESCE(google_sub,?) WHERE id=?').bind(googleSub, u.id).run()
  }
  return u
}

const USERNAME = /^[a-z0-9_.-]{3,20}$/ // compared in lower case, so Jasper, JASPER and jasper are one account
const PW_ITER = 100_000 // the most WebCrypto PBKDF2 allows in a Worker
const hex = (a: Uint8Array) => [...a].map((x) => x.toString(16).padStart(2, '0')).join('')

async function pbkdf2(pw: string, salt: BufferSource): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PW_ITER }, key, 256)
  return hex(new Uint8Array(bits))
}
export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `p1$${hex(salt)}$${await pbkdf2(pw, salt)}`
}
async function checkPassword(pw: string, stored: string | null): Promise<boolean> {
  // an unknown user still costs one hash, so response time does not reveal which usernames exist
  const [v, saltHex, want = ''] = (stored ?? 'p1$00000000000000000000000000000000$x').split('$')
  const salt = new Uint8Array((saltHex.match(/../g) ?? []).map((h) => parseInt(h, 16)))
  const got = await pbkdf2(pw, salt)
  let diff = got.length ^ want.length
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ (want.charCodeAt(i) || 0)
  return !!stored && v === 'p1' && diff === 0
}
export function badPassword(pw: string): boolean {
  return pw.length < 8 || pw.length > 72
}

type Signed = { user: User; token: string } | { error: string }

export async function register(db: D1, usernameRaw: string, pw: string, ip: string): Promise<Signed> {
  const username = String(usernameRaw ?? '')
    .trim()
    .toLowerCase()
  if (!USERNAME.test(username)) return { error: 'bad_username' }
  if (badPassword(String(pw ?? ''))) return { error: 'bad_password' }
  if (!(await allow(db, 'reg:' + ip, 10, 3600))) return { error: 'slow_down' }
  if (await db.prepare('SELECT 1 AS x FROM users WHERE username=?').bind(username).first()) return { error: 'username_taken' }
  const id = rand(12)
  const hash = await hashPassword(pw)
  try {
    await db
      .prepare('INSERT INTO users (id,email,name,username,pw,created_at,games,banned,last_seen) VALUES (?,?,?,?,?,?,0,0,?)')
      .bind(id, 'u:' + username, cleanName(String(usernameRaw).trim(), username), username, hash, Date.now(), Date.now())
      .run()
  } catch {
    return { error: 'username_taken' }
  }
  return { user: { id, email: 'u:' + username, name: cleanName(String(usernameRaw).trim(), username), banned: 0, games: 0 }, token: await newSession(db, id) }
}

export async function login(db: D1, usernameRaw: string, pw: string, ip: string): Promise<Signed> {
  const username = String(usernameRaw ?? '')
    .trim()
    .toLowerCase()
  pw = String(pw ?? '')
  if (!USERNAME.test(username) || pw.length > 72) return { error: 'bad_login' }
  if (!(await allow(db, 'login:' + ip, 30, 600)) || !(await allow(db, 'loginu:' + username, 10, 900))) return { error: 'slow_down' }
  const row = await db.prepare('SELECT id,email,name,banned,games,pw FROM users WHERE username=?').bind(username).first<User & { pw: string | null }>()
  const good = await checkPassword(pw, row?.pw ?? null)
  if (!row || !good || row.banned) return { error: 'bad_login' }
  const { pw: _pw, ...user } = row
  return { user, token: await newSession(db, user.id) }
}

/** Change a password and sign out every other session. `keep` is the token to leave signed in. */
export async function setPassword(db: D1, userId: string, pw: string, keep?: string | null): Promise<void> {
  await db
    .prepare('UPDATE users SET pw=? WHERE id=?')
    .bind(await hashPassword(pw), userId)
    .run()
  if (keep)
    await db
      .prepare('DELETE FROM sessions WHERE user_id=? AND hash!=?')
      .bind(userId, await sha256(keep))
      .run()
  else await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId).run()
}
export async function passwordOk(db: D1, userId: string, pw: string): Promise<boolean> {
  const row = await db.prepare('SELECT pw FROM users WHERE id=?').bind(userId).first<{ pw: string | null }>()
  return checkPassword(String(pw ?? ''), row?.pw ?? null)
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

/** Root admins: the usernames in ADMIN_USERS and the Google emails in ADMIN_EMAILS (settings, so they can never be locked out). Username accounts carry 'u:<name>' in the email column. */
export function isRootAdmin(env: Env, email: string): boolean {
  const split = (v?: string) =>
    String(v || '')
      .toLowerCase()
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  const e = email.toLowerCase()
  return e.startsWith('u:') ? split(env.ADMIN_USERS).includes(e.slice(2)) : split(env.ADMIN_EMAILS).includes(e)
}
/** An admin is a root admin or an account whose role is 'admin' (given from the admin page). */
export function isAdmin(env: Env, email: string, role?: string | null): boolean {
  return role === 'admin' || isRootAdmin(env, email)
}
