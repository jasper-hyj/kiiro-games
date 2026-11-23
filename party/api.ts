import { getServerByName } from 'partyserver'
import type { Env } from './d1'
import { allow, cleanName, endSession, badPassword, finishGoogle, isAdmin, login, passwordOk, register, setPassword, userFromToken, type User } from './auth'
import { ensureAccount, FLOOR_CHIPS, leaderboard, level, seasonOf, START_CHIPS } from './economy'
import { trimReplays } from './matches'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
const bearer = (req: Request) => (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '') || null

async function body(req: Request): Promise<Record<string, unknown>> {
  try { const t = await req.text(); if (t.length > 20000) return {}; const j = JSON.parse(t); return j && typeof j === 'object' ? j : {} } catch { return {} }
}

/** Everything under /api. Returns null for paths that are not ours. */
export async function handleApi(req: Request, env: Env): Promise<Response | null> {
  const url = new URL(req.url)
  if (!url.pathname.startsWith('/api/')) return null
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const db = env.DB
  if (!db) return json({ error: 'accounts_not_configured' }, 503)
  const ip = req.headers.get('CF-Connecting-IP') || 'local'
  const path = url.pathname.slice(4)
  const token = bearer(req)

  // is a four-digit code free to open a new room on? A table of any game on that code would clash with the room's table.
  if (req.method === 'GET' && path.startsWith('/code/')) {
    const code = path.slice(6).toLowerCase()
    if (!/^\d{4}$/.test(code) || !env.Main) return json({ free: false })
    try {
      const stub = await getServerByName(env.Main as never, code)
      const r = await stub.fetch(new Request(`https://table/parties/main/${code}/status`))
      const j = (await r.json()) as { taken?: boolean }
      return json({ free: !j.taken })
    } catch { return json({ free: true }) } // if the check itself fails, do not block room creation
  }
  if (req.method === 'GET' && path === '/config') return json({ google: env.GOOGLE_CLIENT_ID || null, season: seasonOf(), start: START_CHIPS, floor: FLOOR_CHIPS })

  if (req.method === 'POST' && (path === '/auth/register' || path === '/auth/login')) {
    const b = await body(req)
    const r = path === '/auth/register' ? await register(db, String(b.username ?? ''), String(b.password ?? ''), ip) : await login(db, String(b.username ?? ''), String(b.password ?? ''), ip)
    if ('error' in r) return json({ error: r.error }, r.error === 'slow_down' ? 429 : r.error === 'bad_login' ? 401 : 400)
    return json({ token: r.token, user: { id: r.user.id, name: r.user.name } })
  }
  if (req.method === 'POST' && path === '/auth/google') {
    if (!(await allow(db, 'auth:' + ip, 30, 600))) return json({ error: 'slow_down' }, 429)
    const b = await body(req)
    const r = await finishGoogle(db, env, String(b.credential ?? ''))
    if (!r) return json({ error: 'invalid' }, 401)
    return json({ token: r.token, user: { id: r.user.id, name: r.user.name } })
  }
  if (req.method === 'GET' && path === '/leaderboard') {
    const me = await userFromToken(db, token)
    const season = /^\d{4}-\d{2}$/.test(url.searchParams.get('season') || '') ? url.searchParams.get('season')! : seasonOf()
    return json({ season, rows: await leaderboard(db, season, me?.id) })
  }

  const user = await userFromToken(db, token)
  if (!user) return json({ error: 'unauthorized' }, 401)
  await db.prepare('UPDATE users SET last_seen=? WHERE id=?').bind(Date.now(), user.id).run()

  if (req.method === 'POST' && path === '/auth/logout') { await endSession(db, token!); return json({ ok: true }) }
  if (req.method === 'GET' && path === '/me') {
    const acct = await ensureAccount(db, user.id)
    return json({ id: user.id, name: user.name, username: user.email.startsWith('u:') ? user.email.slice(2) : null, admin: isAdmin(env, user.email), ...acct, level: level(user.games) })
  }
  if (req.method === 'POST' && path === '/me/password') {
    if (!user.email.startsWith('u:')) return json({ error: 'no_password' }, 400)
    if (!(await allow(db, 'pw:' + user.id, 5, 900))) return json({ error: 'slow_down' }, 429)
    const b = await body(req)
    if (badPassword(String(b.next ?? ''))) return json({ error: 'bad_password' }, 400)
    if (!(await passwordOk(db, user.id, String(b.current ?? '')))) return json({ error: 'bad_login' }, 401)
    await setPassword(db, user.id, String(b.next), token)
    return json({ ok: true })
  }
  if (req.method === 'POST' && path === '/me/name') {
    if (!(await allow(db, 'rename:' + user.id, 5, 3600))) return json({ error: 'slow_down' }, 429)
    const b = await body(req)
    const name = cleanName(String(b.name ?? ''), '')
    if (!name) return json({ error: 'bad_name' }, 400)
    await db.prepare('UPDATE users SET name=? WHERE id=?').bind(name, user.id).run()
    return json({ name })
  }
  if (req.method === 'GET' && path === '/me/matches') {
    const { results } = await db.prepare(
      `SELECT m.id,m.game,m.rule,m.ranked,m.ended_at AS at,p.place,p.points,p.chips FROM match_players p JOIN matches m ON m.id=p.match_id
        WHERE p.user_id=? ORDER BY m.ended_at DESC LIMIT 50`).bind(user.id).all()
    return json({ matches: results })
  }
  if (req.method === 'GET' && path.startsWith('/match/')) {
    const id = decodeURIComponent(path.slice(7))
    const mine = await db.prepare('SELECT 1 AS x FROM match_players WHERE match_id=? AND user_id=?').bind(id, user.id).first()
    if (!mine && !isAdmin(env, user.email)) return json({ error: 'forbidden' }, 403)
    return json(await matchDetail(env, id))
  }

  if (path.startsWith('/admin/')) {
    if (!isAdmin(env, user.email)) return json({ error: 'forbidden' }, 403)
    return admin(req, env, user, path.slice(6), url)
  }
  return json({ error: 'not_found' }, 404)
}

async function matchDetail(env: Env, id: string) {
  const db = env.DB!
  const m = await db.prepare('SELECT id,game,rule,ranked,season,room,started_at,ended_at,config,summary,replay FROM matches WHERE id=?').bind(id).first<Record<string, unknown>>()
  if (!m) return { error: 'not_found' }
  const { results } = await db.prepare('SELECT seat,name,user_id,place,points,chips FROM match_players WHERE match_id=? ORDER BY place').bind(id).all()
  const parse = (s: unknown) => { try { return s ? JSON.parse(String(s)) : null } catch { return null } }
  return { ...m, config: parse(m.config), summary: parse(m.summary), replay: parse(m.replay), players: results }
}

async function admin(req: Request, env: Env, me: User, path: string, url: URL): Promise<Response> {
  const db = env.DB!
  const now = Date.now(), day = 86400e3, season = seasonOf()
  const one = async (sql: string, ...v: unknown[]) => (await db.prepare(sql).bind(...v).first<Record<string, number>>()) ?? {}

  if (req.method === 'GET' && path === '/overview') {
    const [users, newToday, active24, active7, matches, matchesToday, ranked, chips, banned] = await Promise.all([
      one('SELECT COUNT(*) AS n FROM users'), one('SELECT COUNT(*) AS n FROM users WHERE created_at>?', now - day),
      one('SELECT COUNT(*) AS n FROM users WHERE last_seen>?', now - day), one('SELECT COUNT(*) AS n FROM users WHERE last_seen>?', now - 7 * day),
      one('SELECT COUNT(*) AS n FROM matches'), one('SELECT COUNT(*) AS n FROM matches WHERE ended_at>?', now - day),
      one('SELECT COUNT(*) AS n FROM matches WHERE ranked=1 AND season=?', season),
      one('SELECT COALESCE(SUM(balance),0) AS n FROM season_accounts WHERE season=?', season), one('SELECT COUNT(*) AS n FROM users WHERE banned=1'),
    ])
    const { results: perDay } = await db.prepare('SELECT strftime(\'%Y-%m-%d\', ended_at/1000, \'unixepoch\') AS day, COUNT(*) AS n FROM matches WHERE ended_at>? GROUP BY day ORDER BY day').bind(now - 14 * day).all()
    const { results: signups } = await db.prepare('SELECT strftime(\'%Y-%m-%d\', created_at/1000, \'unixepoch\') AS day, COUNT(*) AS n FROM users WHERE created_at>? GROUP BY day ORDER BY day').bind(now - 14 * day).all()
    const { results: byGame } = await db.prepare(
      `SELECT m.game AS game, COUNT(DISTINCT m.id) AS matches, COUNT(DISTINCT p.user_id) AS players, COUNT(DISTINCT CASE WHEN m.ended_at>? THEN m.id END) AS last24h
         FROM matches m LEFT JOIN match_players p ON p.match_id=m.id AND p.user_id IS NOT NULL GROUP BY m.game ORDER BY matches DESC`).bind(now - day).all()
    return json({ byGame, season, users: users.n, newToday: newToday.n, active24h: active24.n, active7d: active7.n, matches: matches.n, matchesToday: matchesToday.n, rankedThisSeason: ranked.n, chipsInCirculation: chips.n, banned: banned.n, matchesPerDay: perDay, signupsPerDay: signups })
  }
  if (req.method === 'GET' && path === '/users') {
    const q = '%' + (url.searchParams.get('q') || '').replace(/[%_]/g, '') + '%'
    const { results } = await db.prepare(
      `SELECT u.id,u.name,u.username,u.email,u.games,u.banned,u.created_at,u.last_seen,a.balance FROM users u LEFT JOIN season_accounts a ON a.user_id=u.id AND a.season=?
        WHERE u.name LIKE ? OR u.email LIKE ? OR u.username LIKE ? ORDER BY u.last_seen DESC LIMIT 100`).bind(season, q, q, q).all()
    return json({ users: results })
  }
  if (req.method === 'GET' && path === '/matches') {
    const { results } = await db.prepare(
      `SELECT m.id,m.game,m.rule,m.ranked,m.ended_at AS at, (SELECT GROUP_CONCAT(name || ':' || points, ', ') FROM match_players WHERE match_id=m.id) AS players
         FROM matches m ORDER BY m.ended_at DESC LIMIT 100`).all()
    return json({ matches: results })
  }
  if (req.method === 'GET' && path === '/ledger') {
    const uid = url.searchParams.get('user')
    const { results } = uid
      ? await db.prepare('SELECT id,season,user_id,delta,reason,ref,at FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT 200').bind(uid).all()
      : await db.prepare('SELECT id,season,user_id,delta,reason,ref,at FROM ledger ORDER BY id DESC LIMIT 200').all()
    return json({ ledger: results })
  }
  /** Consistency checks that should always come back empty. */
  if (req.method === 'GET' && path === '/audit') {
    const { results: drift } = await db.prepare(
      `SELECT a.user_id,a.balance, COALESCE((SELECT SUM(delta) FROM ledger l WHERE l.season=a.season AND l.user_id=a.user_id),0) AS ledger
         FROM season_accounts a WHERE a.season=? AND a.balance != COALESCE((SELECT SUM(delta) FROM ledger l WHERE l.season=a.season AND l.user_id=a.user_id),0)`).bind(season).all()
    const { results: negative } = await db.prepare('SELECT user_id,balance FROM season_accounts WHERE season=? AND balance<0').bind(season).all()
    const { results: unbalanced } = await db.prepare(
      `SELECT ref AS match_id, SUM(delta) AS net FROM ledger WHERE season=? AND reason LIKE 'play:%' AND reason NOT IN ('play:holdem','play:blackjack') GROUP BY ref HAVING ABS(SUM(delta)) > 5`).bind(season).all()
    return json({ season, balanceDrift: drift, negativeBalances: negative, unbalancedMatches: unbalanced, ok: !drift.length && !negative.length && !unbalanced.length })
  }
  if (req.method === 'POST') {
    const b = await body(req)
    const id = String(b.user ?? '')
    const target = await db.prepare('SELECT id,name FROM users WHERE id=?').bind(id).first<{ id: string; name: string }>()
    if (!target) return json({ error: 'no_user' }, 404)
    if (path === '/ban') {
      if (target.id === me.id) return json({ error: 'not_yourself' }, 400)
      const ban = b.banned === true ? 1 : 0
      await db.prepare('UPDATE users SET banned=? WHERE id=?').bind(ban, id).run()
      if (ban) await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run()
      return json({ ok: true })
    }
    if (path === '/rename') {
      const name = cleanName(String(b.name ?? ''), '')
      if (!name) return json({ error: 'bad_name' }, 400)
      await db.prepare('UPDATE users SET name=? WHERE id=?').bind(name, id).run()
      return json({ ok: true })
    }
    if (path === '/grant') {
      const amount = Math.trunc(Number(b.amount))
      if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100000) return json({ error: 'bad_amount' }, 400)
      const acct = await ensureAccount(db, id)
      const delta = Math.max(-acct.balance, amount)
      const ref = `${me.id}:${Date.now()}`
      await db.batch([
        db.prepare('INSERT INTO ledger (season,user_id,delta,reason,ref,at) VALUES (?,?,?,?,?,?)').bind(season, id, delta, 'bonus', ref, Date.now()),
        db.prepare('UPDATE season_accounts SET balance=balance+? WHERE season=? AND user_id=?').bind(delta, season, id),
      ])
      return json({ ok: true, delta })
    }
    if (path === '/resetpw') {
      // for a player who forgot their password: set a temporary one and tell them in person; this signs them out everywhere
      const pw = String(b.password ?? '')
      if (badPassword(pw)) return json({ error: 'bad_password' }, 400)
      await setPassword(db, id, pw)
      return json({ ok: true })
    }
    if (path === '/trim') { await trimReplays(db); return json({ ok: true }) }
  }
  return json({ error: 'not_found' }, 404)
}
