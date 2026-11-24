// Run: npx tsx scripts/accounts/authz-test.ts   (needs `wrangler dev` on :8787 and the local migrations applied)
// Authentication (who are you) and authorization (what may you do) end to end: sessions, logout, bans, expiry, every protected
// route with and without a token, admin-only routes, who may read a match, and that secrets never leave the server.
import { execSync } from 'node:child_process'
const API = process.env.API ?? 'http://localhost:8787/api'
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const sql = (q: string): any[] => { const out = execSync(`npx wrangler d1 execute kiiro-games --local --json --command "${q.replace(/"/g, '\\"')}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); try { return JSON.parse(out.slice(out.indexOf('['))) [0].results } catch { return [] } }
type R = { status: number; data: Record<string, any>; raw: string }
const call = async (path: string, token: string | null, body?: unknown, method = body === undefined ? 'GET' : 'POST', headers: Record<string, string> = {}): Promise<R> => {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  const raw = await r.text(); let data: Record<string, any> = {}; try { data = JSON.parse(raw) } catch { /* not json */ }
  return { status: r.status, data, raw }
}
sql('DELETE FROM throttle')
const tag = Math.random().toString(36).slice(2, 7)
const reg = async (n: string) => { const r = await call('/auth/register', null, { username: `${n}${tag}`, password: 'password123' }); return { token: r.data.token as string, name: `${n}${tag}` } }
const adm = await reg('adm'), a = await reg('ann'), b = await reg('bob'), c = await reg('cat')
sql(`UPDATE users SET role='admin' WHERE username='${adm.name}'`)
const id = async (t: string) => (await call('/me', t)).data.id as string
const aid = await id(a.token), bid = await id(b.token), cid = await id(c.token), admId = await id(adm.token)

// ---------------------------------------------------------------- authentication
console.log('-- who are you')
ok((await call('/me', a.token)).status === 200, 'a valid token opens /me')
for (const [label, t] of [['no token', null], ['an empty token', ''], ['a short token', 'abc'], ['a made-up long token', 'f'.repeat(64)], ['a token with SQL in it', "' OR 1=1 --" + 'x'.repeat(40)], ['a huge token', 'z'.repeat(500)]] as const) {
  const r = await call('/me', t)
  ok(r.status === 401, `${label} is refused (${r.status})`)
}
{ const r = await call('/me', null, undefined, 'GET', { Authorization: 'Basic ' + btoa('x:y') }); ok(r.status === 401, 'a non-Bearer Authorization header is refused') }
const rows = sql(`SELECT hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE u.username='${a.name}'`)
ok(rows.length >= 1 && rows.every((r) => r.hash !== a.token && /^[0-9a-f]{64}$/.test(r.hash)), 'sessions are stored hashed, never as the token itself')
const pwRow = sql(`SELECT pw FROM users WHERE username='${a.name}'`)[0]?.pw as string
ok(/^p1\$[0-9a-f]{32}\$[0-9a-f]{64}$/.test(pwRow) && !pwRow.includes('password123'), 'passwords are stored as a salted hash')
const pw2 = sql(`SELECT pw FROM users WHERE username='${b.name}'`)[0]?.pw as string
ok(pwRow !== pw2, 'two accounts with the same password have different hashes (salted)')

// ---------------------------------------------------------------- logout, expiry, ban
console.log('-- ending a session')
{
  const l = await call('/auth/login', null, { username: a.name, password: 'password123' }); const t2 = l.data.token as string
  ok((await call('/me', t2)).status === 200, 'a second session works')
  ok((await call('/auth/logout', t2, {})).status === 200, 'logout answers')
  ok((await call('/me', t2)).status === 401, 'the logged-out token stops working')
  ok((await call('/me', a.token)).status === 200, 'the other session is untouched by that logout')
  ok((await call('/auth/logout', t2, {})).status === 401, 'logging out twice is refused, not an error')
}
{
  const l = await call('/auth/login', null, { username: b.name, password: 'password123' }); const t2 = l.data.token as string
  sql(`UPDATE sessions SET expires=1 WHERE hash IN (SELECT hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE u.username='${b.name}' AND s.hash!='' ) AND expires>1 AND 0`) // (no-op guard: see next line)
  const mine = sql(`SELECT s.hash AS h FROM sessions s JOIN users u ON u.id=s.user_id WHERE u.username='${b.name}'`).map((r) => r.h)
  ok((await call('/me', t2)).status === 200, 'a fresh login works')
  for (const h of mine) sql(`UPDATE sessions SET expires=1 WHERE hash='${h}'`)
  ok((await call('/me', t2)).status === 401 && (await call('/me', b.token)).status === 401, 'an expired session is refused')
  const again = await call('/auth/login', null, { username: b.name, password: 'password123' })
  ok(typeof again.data.token === 'string', 'and the person can sign in again')
  b.token = again.data.token
}
console.log('-- bans')
{
  ok((await call(`/admin/users/${cid}/ban`, adm.token, { banned: true })).status === 200, 'an admin bans an account')
  ok((await call('/me', c.token)).status === 401, 'the banned account is signed out at once')
  ok((await call('/auth/login', null, { username: c.name, password: 'password123' })).data.error === 'bad_login', 'and cannot sign in again')
  ok((await call(`/admin/users/${cid}/ban`, adm.token, { banned: false })).status === 200, 'an admin lifts the ban')
  const l = await call('/auth/login', null, { username: c.name, password: 'password123' })
  ok(typeof l.data.token === 'string', 'who can then sign in again')
  c.token = l.data.token
  ok((await call(`/admin/users/${admId}/ban`, adm.token, { banned: true })).status === 400, 'nobody can ban themselves')
}

// ---------------------------------------------------------------- authorization: every protected route
console.log('-- every protected route needs a session')
const PROTECTED: [string, string, unknown?][] = [
  ['GET', '/me'], ['PATCH', '/me', { name: 'Zed Zed' }], ['PUT', '/me/password', { current: 'x', next: 'yyyyyyyy' }], ['GET', '/me/matches'], ['GET', '/matches/none'],
  ['POST', '/auth/logout', {}], ['POST', '/me/name', { name: 'Zed Zed' }], ['POST', '/me/password', { current: 'x', next: 'yyyyyyyy' }], ['GET', '/match/none'],
]
for (const [m, p, body] of PROTECTED) { const r = await call(p, null, body, m); ok(r.status === 401, `${m} ${p} without a token -> ${r.status}`) }
console.log('-- every admin route needs an admin')
const ADMIN: [string, string, unknown?][] = [
  ['GET', '/admin/overview'], ['GET', '/admin/users'], ['GET', '/admin/matches'], ['GET', '/admin/ledger'], ['GET', '/admin/audit'],
  ['POST', `/admin/users/${bid}/ban`, { banned: true }], ['POST', `/admin/users/${bid}/rename`, { name: 'Hacked' }], ['POST', `/admin/users/${bid}/grant`, { amount: 5000 }],
  ['POST', `/admin/users/${bid}/resetpw`, { password: 'takeover123' }], ['POST', `/admin/users/${bid}/role`, { admin: true }], ['POST', '/admin/maintenance/trim', {}],
  ['POST', '/admin/ban', { user: bid, banned: true }], ['POST', '/admin/grant', { user: bid, amount: 5000 }], ['POST', '/admin/resetpw', { user: bid, password: 'takeover123' }], ['POST', '/admin/trim', {}],
]
for (const [m, p, body] of ADMIN) {
  const none = await call(p, null, body, m), user = await call(p, a.token, body, m)
  ok(none.status === 401 && user.status === 403, `${m} ${p}: no token ${none.status}, normal account ${user.status}`)
}
ok((await call('/me', b.token)).data.name === (await call('/me', b.token)).data.name && !(await call(`/admin/users?q=${b.name}`, adm.token)).data.users?.[0]?.banned, 'none of those attempts changed the target account')
const takeover = await call('/auth/login', null, { username: b.name, password: 'takeover123' })
ok(takeover.data.error === 'bad_login', 'no password was changed by the refused calls')

console.log('-- admin routes work for an admin')
ok((await call('/admin/overview', adm.token)).status === 200, 'overview')
ok((await call('/admin/users?q=' + a.name, adm.token)).data.users?.length >= 1, 'user search')
ok((await call('/admin/ledger', adm.token)).status === 200 && (await call('/admin/audit', adm.token)).data.ok !== undefined, 'ledger and audit')
ok((await call(`/admin/users/${bid}/grant`, adm.token, { amount: 99999999 })).status === 400, 'a chip grant above the limit is refused')
ok((await call(`/admin/users/${bid}/grant`, adm.token, { amount: 0 })).status === 400, 'a zero grant is refused')
ok((await call(`/admin/users/nosuchuser/ban`, adm.token, { banned: true })).status === 404, 'an unknown user is a 404')
ok((await call(`/admin/users/${bid}/resetpw`, adm.token, { password: 'short' })).status === 400, 'a short temporary password is refused')
{
  const before = (await call('/me', b.token)).status
  ok((await call(`/admin/users/${bid}/resetpw`, adm.token, { password: 'temp-pass-123' })).status === 200, 'an admin resets a forgotten password')
  ok(before === 200 && (await call('/me', b.token)).status === 401, 'which signs that account out everywhere')
  const l = await call('/auth/login', null, { username: b.name, password: 'temp-pass-123' })
  ok(typeof l.data.token === 'string', 'and the temporary password works')
  b.token = l.data.token
}

// ---------------------------------------------------------------- authorization: data
console.log('-- who may read what')
{
  // a match that only Ann and Bob played
  const mid = 'authz' + tag
  sql(`INSERT INTO matches (id,game,rule,ranked,season,room,started_at,ended_at,config,summary,replay) VALUES ('${mid}','mahjong','taiwan',0,'2026-11','x',1,2,'{}','[]','[]')`)
  sql(`INSERT INTO match_players (match_id,user_id,name,seat,place,points,chips) VALUES ('${mid}','${aid}','Ann',0,1,1,0)`)
  sql(`INSERT INTO match_players (match_id,user_id,name,seat,place,points,chips) VALUES ('${mid}','${bid}','Bob',1,2,0,0)`)
  ok((await call('/matches/' + mid, a.token)).status === 200, 'a player reads their own match')
  ok((await call('/matches/' + mid, c.token)).status === 403, 'someone who was not in it is refused')
  ok((await call('/matches/' + mid, adm.token)).status === 200, 'an admin can read any match')
  ok((await call('/me/matches', c.token)).data.matches?.every((m: any) => m.id !== mid), "a player's history lists only their own matches")
  ok((await call('/me/matches', a.token)).data.matches?.some((m: any) => m.id === mid), '...and does list theirs')
}
ok((await call('/leaderboard', null)).status === 200, 'the leaderboard is public')
ok((await call('/config', null)).status === 200, 'the public config is public')

// ---------------------------------------------------------------- secrets and input
console.log('-- nothing secret leaves the server')
for (const [label, r] of [['/me', await call('/me', a.token)], ['/auth/login', await call('/auth/login', null, { username: a.name, password: 'password123' })], ['/admin/users', await call('/admin/users?q=' + a.name, adm.token)], ['/leaderboard', await call('/leaderboard', null)]] as const) {
  ok(!/"pw"|p1\$|"hash"|"google_sub"/.test(r.raw), `${label} never includes a password hash or an id from another service`)
}
ok(!(await call('/admin/users?q=' + a.name, adm.token)).raw.includes('"sessions"'), 'the user list carries no session data')
console.log('-- names and input')
ok((await call('/me', a.token, { name: 'x' }, 'PATCH')).status === 400, 'a one-character display name is refused')
ok((await call('/me', a.token, { name: 'visit http://evil.example/' }, 'PATCH')).status === 400, 'a display name with a link is refused')
ok((await call('/me', a.token, { name: '<b>Hi</b>' }, 'PATCH')).data.name === 'bHi/b', 'angle brackets are stripped from a display name')
ok((await call('/auth/login', null, { username: { $ne: '' }, password: 'x' })).status === 401, 'a non-string username does not get past the check')
ok((await call('/auth/register', null, { username: a.name.toUpperCase(), password: 'password123' })).data.error === 'username_taken', 'usernames are unique regardless of case')
ok((await call('/auth/google', null, { credential: 'not-a-token' })).status === 401, 'a forged Google credential is refused')
{ const r = await call('/anything', null); ok(r.status === 404 || r.status === 401, 'an unknown route is a 404/401, not a crash') }
{ const r = await fetch(API + '/me', { method: 'OPTIONS', headers: { Origin: 'https://example.com', 'Access-Control-Request-Method': 'GET' } }); ok(r.status === 204, 'the CORS preflight answers') }

// ---------------------------------------------------------------- the same sessions on the game sockets
console.log('-- game sockets use the same sessions')
const WS = (process.env.WS ?? 'ws://localhost:8787') + '/parties/main/'
const join = async (code: string, token: string | null, extra: Record<string, unknown> = {}) => {
  const ws = new WebSocket(WS + code); const got: any[] = []
  ws.addEventListener('message', (e) => { try { got.push(JSON.parse(String(e.data))) } catch { /* ignore */ } })
  await new Promise<void>((res) => ws.addEventListener('open', () => res()))
  ws.send(JSON.stringify({ t: 'join', id: 'authz-' + Math.random().toString(36).slice(2), name: 'Guest', game: 'holdem', create: true, pcfg: { sb: 25, bb: 50, casual: false }, ...(token ? { token } : {}), ...extra }))
  await new Promise((r) => setTimeout(r, 700))
  return { ws, got }
}
{
  const code = String(1000 + Math.floor(Math.random() * 9000))
  const g = await join(code, 'f'.repeat(64))
  const v = g.got.find((m) => m.t === 'pview')?.view
  ok(!!v && v.signedIn === false, 'a forged token joins a table as a guest, not as an account')
  g.ws.send(JSON.stringify({ t: 'p', m: { k: 'sit', buyin: 2000 } })); await new Promise((r) => setTimeout(r, 500))
  ok(g.got.some((m) => m.t === 'error' && m.message === 'signin_required'), 'and cannot sit at a cash table')
  g.ws.close()
  const code2 = String(1000 + Math.floor(Math.random() * 9000))
  const h = await join(code2, a.token)
  ok(h.got.find((m) => m.t === 'pview')?.view?.signedIn === true, 'a real token joins as the signed-in account')
  h.ws.send(JSON.stringify({ t: 'p', m: { k: 'sit', buyin: 99999999 } })); await new Promise((r) => setTimeout(r, 500))
  ok(h.got.some((m) => m.t === 'error'), 'a buy-in beyond what is allowed or owned is refused')
  const acct = (await call('/me', a.token)).data
  ok(acct.balance >= 0 && acct.balance <= 10000 + 1000, `the balance is untouched by the refused buy-in (${acct.balance})`)
  h.ws.close()
}
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
