export {}
// Run: npx tsx scripts/accounts/auth-test.ts   (needs wrangler dev on :8787, ADMIN_USERS=<anything> in .dev.vars, migrations applied)
const API = 'http://localhost:8787/api'
const call = async (p: string, b?: unknown, tok?: string) => {
  const r = await fetch(API + p, { method: b === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) })
  return { status: r.status, ...((await r.json()) as any) }
}
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const u = 'authtest' + Math.floor(Math.random() * 1e6)

ok((await call('/auth/register', { username: 'a b', password: 'longenough1' })).error === 'bad_username', 'a username with a space is refused')
ok((await call('/auth/register', { username: 'me@x.com', password: 'longenough1' })).error === 'bad_username', 'an email address is not a username')
ok((await call('/auth/register', { username: u, password: 'short' })).error === 'bad_password', 'a short password is refused')
const reg = await call('/auth/register', { username: u.replace('authtest', 'AuthTest'), password: 'first-password' })
ok(typeof reg.token === 'string' && reg.user?.name === u.replace('authtest', 'AuthTest'), 'registering gives a session and keeps the capitals as the display name')
ok((await call('/auth/register', { username: u.toUpperCase(), password: 'another-one-1' })).error === 'username_taken', 'usernames are unique, case-insensitively')
const me = await call('/me', undefined, reg.token)
ok(me.username === u && !('pw' in me), '/me shows the username and never the password hash')
ok((await call('/auth/login', { username: u, password: 'wrong-password' })).status === 401, 'a wrong password is refused')
ok((await call('/auth/login', { username: 'nobody' + u, password: 'whatever-1' })).error === 'bad_login', 'an unknown user gets the same error as a wrong password')
const login = await call('/auth/login', { username: u.toUpperCase(), password: 'first-password' })
ok(typeof login.token === 'string', 'login works (username not case sensitive)')
ok((await call('/me/password', { current: 'nope-nope', next: 'second-password' }, login.token)).status === 401, 'changing the password needs the current one')
ok((await call('/me/password', { current: 'first-password', next: 'second-password' }, login.token)).ok === true, 'the password can be changed')
ok((await call('/me', undefined, login.token)).id === me.id, 'the session used for the change stays signed in')
ok((await call('/me', undefined, reg.token)).status === 401, 'other sessions are signed out after a change')
ok((await call('/auth/login', { username: u, password: 'first-password' })).status === 401, 'the old password stops working')
ok(typeof (await call('/auth/login', { username: u, password: 'second-password' })).token === 'string', 'the new password works')
ok((await call('/admin/overview', undefined, login.token)).status === 403, 'a normal user is not an admin')
// throttle: ten bad tries on one username lock further tries for a while
let last = 0
for (let i = 0; i < 12; i++) last = (await call('/auth/login', { username: u, password: 'bad-' + i })).status
ok(last === 429, 'repeated bad passwords are rate limited')
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
