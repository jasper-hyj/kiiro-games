export {}
import { chooseMove } from '../../src/games/bigtwo/engine/table'
import { evalCombo } from '../../src/games/bigtwo/engine/combos'
// Run: npx tsx scripts/bigtwo/ws-test.ts   (needs `wrangler dev` on :8787 with DEV_MODE=1)
const API = 'http://localhost:8787/api'
const post = async (p: string, b: unknown, tok?: string) => (await fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(b) })).json() as Promise<any>
const get = async (p: string, tok: string) => (await fetch(API + p, { headers: { Authorization: 'Bearer ' + tok } })).json() as Promise<any>
const login = async (name: string) => { const u = name.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20).padEnd(3, 'x'), password = 'test-password-1'; const r = await post('/auth/register', { username: u, password }); return (r.token ?? (await post('/auth/login', { username: u, password })).token) as string }
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
function client(room: string, id: string, name: string, opts: { token?: string; create?: boolean } = {}) {
  const ws = new WebSocket(`ws://localhost:8787/parties/main/${room}`)
  const errors: string[] = []; let view: any = null
  ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.t === 'error') errors.push(m.message); if (m.t === 'pview') view = m.view }
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', id, name, create: opts.create, game: 'bigtwo', ...(opts.token ? { token: opts.token } : {}) }))
  const p = (m: object) => ws.send(JSON.stringify({ t: 'p', m }))
  return { p, errors, get view() { return view }, close: () => ws.close() }
}
const tag = Math.random().toString(36).slice(2, 6)
const code = () => String(1000 + Math.floor(Math.random() * 9000))
// the same simple strategy the bots use, driven from the client side
const move = (c: ReturnType<typeof client>) => {
  const v = c.view; if (!v || v.status !== 'playing' || v.turn !== v.you) return
  const cur = v.current ? evalCombo(v.current.cards) : null
  const m = chooseMove(v.hand, cur, v.mustOpen)
  if (m) c.p({ k: 'play', cards: m.cards }); else if (v.canPass) c.p({ k: 'pass' }); else c.p({ k: 'play', cards: [v.hand[0]] })
}

let room = code()
const ta = await login(`ba${tag}@x.test`), tb = await login(`bb${tag}@x.test`)
const a = client(room, 'a' + tag, 'A', { token: ta, create: true }); await sleep(500)
const g = client(room, 'g' + tag, 'Guest'); await sleep(400)
ok(a.view?.status === 'lobby' && a.view.seats.filter((s: any) => !s.empty).length === 2, 'players join the lobby')
a.p({ k: 'config', config: { ranked: true } }); await sleep(300)
ok(a.view?.config?.ranked === true, 'a signed-in host can make the room ranked')
a.p({ k: 'start' }); await sleep(400)
ok(a.view?.status === 'lobby' && a.errors.includes('ranked_needs_players'), 'a guest in the room blocks a ranked start')
g.close(); await sleep(300)
const b = client(room, 'b' + tag, 'B', { token: tb }); await sleep(500)
const before = [(await get('/me', ta)).balance, (await get('/me', tb)).balance]
a.p({ k: 'start' }); await sleep(500)
console.log('debug', a.errors, b.errors, a.view?.status, a.view?.seats?.map((x: any) => x.name))
ok(a.view?.status === 'playing' && a.view.hand.length === 13, 'ranked game starts with two signed-in humans and two bots')
ok(b.view?.hand.length === 13 && JSON.stringify(a.view.hand) !== JSON.stringify(b.view.hand), 'each human gets their own 13 cards')
for (let i = 0; i < 400 && a.view?.status === 'playing'; i++) { move(a); move(b); await sleep(120) }
ok(a.view?.status === 'over', 'the game finishes')
await sleep(800)
const after = [(await get('/me', ta)).balance, (await get('/me', tb)).balance]
const delta = after.map((x, i) => x - before[i])
ok(delta[0] + delta[1] === 0, `chips are zero-sum between the two humans (${delta})`)
const hist = (await get('/me/matches', ta)).matches.filter((m: any) => m.game === 'bigtwo')
ok(hist.length === 1 && hist[0].chips === delta[0], 'the game is saved to history with the same chip change')
const audit = await get('/admin/audit', await login('test@example.com'))
ok(audit.balanceDrift?.length === 0, 'ledger audit shows no drift')
a.close(); b.close()
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
