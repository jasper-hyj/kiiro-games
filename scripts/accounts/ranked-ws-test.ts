export {}
// Run: npx tsx scripts/accounts/ranked-ws-test.ts   (needs wrangler dev on :8787)
const API = 'http://localhost:8787/api'
const post = async (p: string, b: unknown) => (await fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })).json() as Promise<any>
const login = async (name: string) => { const u = name.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20).padEnd(3, 'x'), password = 'test-password-1'; const r = await post('/auth/register', { username: u, password }); return (r.token ?? (await post('/auth/login', { username: u, password })).token) as string }
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function client(room: string, id: string, name: string, token?: string, create = false) {
  const ws = new WebSocket(`ws://localhost:8787/parties/main/${room}`)
  const errors: string[] = []; let view: any = null
  ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.t === 'error') errors.push(m.message); if (m.t === 'view') view = m.view }
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', id, name, create, ...(token ? { token } : {}) }))
  return { send: (m: object) => ws.send(JSON.stringify(m)), errors, get view() { return view }, close: () => ws.close() }
}
const tag = Math.random().toString(36).slice(2, 6)
const ta = await login(`ra${tag}@x.test`), tb = await login(`rb${tag}@x.test`)

// signed-in host + signed-in friend: ranked allowed and starts
let room = '9' + Math.floor(100 + Math.random() * 899)
const a = client(room, 'a' + tag, 'A', ta, true); await sleep(400)
const b = client(room, 'b' + tag, 'B', tb); await sleep(400)
a.send({ t: 'config', config: { ranked: true } }); await sleep(300)
ok(a.view?.config?.ranked === true, 'signed-in host can switch the room to ranked')
ok(a.view?.seats?.some((s: any) => s.name.startsWith('ra' + tag)), 'seat is named after the account')
a.send({ t: 'start' }); await sleep(400)
ok(a.view?.status === 'playing', 'ranked game starts with two signed-in players')
a.close(); b.close()

// a guest cannot make a room ranked
room = '8' + Math.floor(100 + Math.random() * 899)
const g = client(room, 'g' + tag, 'Guest', undefined, true); await sleep(400)
g.send({ t: 'config', config: { ranked: true } }); await sleep(300)
ok(g.view?.config?.ranked !== true && g.errors.includes('ranked_needs_signin'), 'guest host cannot enable ranked')
g.close()

// a guest in a ranked room blocks the start
room = '7' + Math.floor(100 + Math.random() * 899)
const h = client(room, 'h' + tag, 'H', ta, true); await sleep(400)
const g2 = client(room, 'gg' + tag, 'Guest2'); await sleep(400)
h.send({ t: 'config', config: { ranked: true } }); await sleep(300)
h.send({ t: 'start' }); await sleep(400)
ok(h.view?.status !== 'playing' && h.errors.includes('ranked_needs_players'), 'ranked start is refused while a guest is seated')
// the same account cannot take two seats
const dup = client(room, 'dup' + tag, 'Dup', ta); await sleep(400)
ok(dup.errors.includes('already_seated'), 'same account cannot sit twice in one room')
h.close(); g2.close(); dup.close()
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
