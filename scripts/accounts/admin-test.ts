// Run: npx tsx scripts/accounts/admin-test.ts   (needs `wrangler dev` on :8787 and the local migrations applied)
// Admin roles: the first admin is set once in the database; after that admins are made and removed from the admin page's API.
import { execSync } from 'node:child_process'
const API = 'http://localhost:8787/api'
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const call = async (path: string, token: string | null, body?: unknown, method = body === undefined ? 'GET' : 'POST') => {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: r.status, data: (await r.json().catch(() => ({}))) as Record<string, any> }
}
const tag = Math.random().toString(36).slice(2, 7)
const reg = async (n: string) => {
  const r = await call('/auth/register', null, { username: `${n}${tag}`, password: 'password123' })
  return { token: r.data.token as string, name: `${n}${tag}` }
}
const a = await reg('adm'),
  b = await reg('usr'),
  c = await reg('oth')
const id = async (t: string) => (await call('/me', t)).data.id as string

ok((await call('/admin/overview', a.token)).status === 403, 'a normal account cannot open the admin API')
ok((await call('/me', a.token)).data.admin === false, 'and is not flagged as an admin')
// the one-time start: make the first admin in the database
execSync(`npx wrangler d1 execute kiiro-games --local --command "UPDATE users SET role='admin' WHERE username='${a.name}'"`, { stdio: 'ignore' })
ok((await call('/me', a.token)).data.admin === true, 'a role set in the database makes the account an admin')
ok((await call('/admin/overview', a.token)).status === 200, 'who can then open the admin API')

const bid = await id(b.token)
ok((await call(`/admin/users/${bid}/role`, b.token, { admin: true })).status === 403, 'a normal account cannot make itself an admin')
ok((await call(`/admin/users/${bid}/role`, a.token, { admin: true })).status === 200, 'an admin makes another account an admin')
ok((await call('/admin/overview', b.token)).status === 200, 'who can then use the admin API')
ok((await call('/admin/users?q=' + encodeURIComponent(b.name), a.token)).data.users?.[0]?.admin === true, 'the users list shows the role')
const aid = await id(a.token)
ok((await call(`/admin/users/${aid}/role`, a.token, { admin: false })).status === 400, 'nobody can remove their own admin rights (no lock-out)')
ok((await call(`/admin/users/${aid}/role`, b.token, { admin: false })).status === 200, 'another admin can remove them')
ok((await call('/admin/overview', a.token)).status === 403, 'who then loses access straight away')
ok((await call(`/admin/users/${bid}/role`, a.token, { admin: false })).status === 403, 'and cannot change roles any more')
const cid = await id(c.token)
const up = await call(`/admin/users/${cid}/role`, b.token, { admin: true }),
  down = await call(`/admin/users/${cid}/role`, b.token, { admin: false })
ok(up.status === 200 && down.status === 200, `promote and demote work both ways (${up.status} ${JSON.stringify(up.data)}, ${down.status})`)
// older route names still answer
const old = await call('/admin/ban', b.token, { user: cid, banned: false })
ok(old.status === 200, `the older /admin/ban route still answers (${old.status} ${JSON.stringify(old.data)})`)
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
