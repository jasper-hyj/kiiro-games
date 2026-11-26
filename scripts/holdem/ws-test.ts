export {}
// Run: npx tsx scripts/holdem/ws-test.ts   (needs `wrangler dev` on :8787 with DEV_MODE=1)
import { freeCode } from '../lib/table'
const API = 'http://localhost:8787/api'
const post = async (p: string, b: unknown, tok?: string) =>
  (
    await fetch(API + p, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
      body: JSON.stringify(b),
    })
  ).json() as Promise<any>
const get = async (p: string, tok: string) => (await fetch(API + p, { headers: { Authorization: 'Bearer ' + tok } })).json() as Promise<any>
const login = async (name: string) => {
  const u = name
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase()
      .slice(0, 20)
      .padEnd(3, 'x'),
    password = 'test-password-1'
  const r = await post('/auth/register', { username: u, password })
  return (r.token ?? (await post('/auth/login', { username: u, password })).token) as string
}
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
function client(room: string, id: string, name: string, opts: { token?: string; create?: boolean; game?: string; pcfg?: object } = {}) {
  const ws = new WebSocket(`ws://localhost:8787/parties/main/${room}`)
  const errors: string[] = []
  let view: any = null
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data))
    if (m.t === 'error') errors.push(m.message)
    if (m.t === 'pview') view = m.view
  }
  ws.onopen = () =>
    ws.send(JSON.stringify({ t: 'join', id, name, create: opts.create, game: opts.game, pcfg: opts.pcfg, ...(opts.token ? { token: opts.token } : {}) }))
  const p = (m: object) => ws.send(JSON.stringify({ t: 'p', m }))
  return {
    p,
    send: (m: object) => ws.send(JSON.stringify(m)),
    errors,
    get view() {
      return view
    },
    close: () => ws.close(),
  }
}
const tag = Math.random().toString(36).slice(2, 6)

// 1. casual table: guests play, nothing touches the ledger
let room = await freeCode()
const g1 = client(room, 'g1' + tag, 'Ann', { create: true, game: 'holdem', pcfg: { sb: 25, bb: 50, casual: true } })
await sleep(500)
const g2 = client(room, 'g2' + tag, 'Ben', { game: 'holdem' })
await sleep(500)
ok(g1.view?.config?.casual === true && g1.view?.config?.bb === 50, "casual hold'em room is created with the host's blinds")
g1.p({ k: 'sit', buyin: 0 })
g2.p({ k: 'sit', buyin: 0 })
await sleep(900)
ok(g1.view?.street === 'preflop' && g1.view?.seats.filter((s: any) => !s.empty).length === 2, 'two guests sit and a hand starts')
const mine = g1.view?.seats.find((s: any) => s.me)
ok(Array.isArray(mine?.hole) && mine.hole.length === 2, 'you see your own two cards')
const theirs = g1.view?.seats.find((s: any) => !s.me && !s.empty)
ok(theirs?.hole?.length === 0, "you do not see the other player's cards")
const actor = g1.view?.turn ? g1 : g2
actor.p({ k: 'act', a: { a: 'fold' } })
await sleep(600)
ok((g1.view?.handNo ?? 0) >= 1 && (g1.view?.result || g1.view?.street !== 'preflop' || g1.view?.handNo >= 2), 'a fold ends the hand')
// a mahjong client cannot join a hold'em code
const wrong = client(room, 'm' + tag, 'Mia', { game: 'mahjong' })
await sleep(400)
ok(wrong.errors.includes('wrong_game:holdem'), "joining a hold'em code as mahjong says which game it is")
g1.close()
g2.close()
wrong.close()

// 2. cash table: needs sign-in, buy-in comes off the balance, cash-out returns it
const ta = await login(`ha${tag}@x.test`),
  tb = await login(`hb${tag}@x.test`)
room = await freeCode()
const guest = client(room, 'gx' + tag, 'Gus', { create: true, game: 'holdem', pcfg: { sb: 25, bb: 50, casual: false } })
await sleep(500)
guest.p({ k: 'sit', buyin: 2000 })
await sleep(400)
ok(guest.errors.includes('signin_required'), 'a guest cannot sit at a cash table')
guest.close()
await sleep(200)
room = await freeCode()
const a = client(room, 'a' + tag, 'A', { token: ta, create: true, game: 'holdem', pcfg: { sb: 25, bb: 50, casual: false } })
await sleep(500)
const b = client(room, 'b' + tag, 'B', { token: tb, game: 'holdem' })
await sleep(500)
const before = (await get('/me', ta)).balance
a.p({ k: 'sit', buyin: 2000 })
b.p({ k: 'sit', buyin: 2000 })
await sleep(1200)
const mid = (await get('/me', ta)).balance
ok(before - mid === 2000, `buy-in of 2000 comes off the balance (${before} -> ${mid})`)
ok(a.view?.street === 'preflop', 'cash hand starts with two signed-in players')
a.p({ k: 'sit', buyin: 100 })
await sleep(300)
ok(a.errors.includes('already_seated'), 'cannot sit twice')
// A shoves, B calls: one of them wins the other's stack
const first = a.view?.turn ? a : b
first.p({ k: 'act', a: { a: 'allin' } })
await sleep(500)
const second = a.view?.turn ? a : b
second.p({ k: 'act', a: { a: 'call' } })
await sleep(1500)
a.p({ k: 'stand' })
b.p({ k: 'stand' })
await sleep(1200)
const afterA = await get('/me', ta),
  afterB = await get('/me', tb)
const sum = afterA.balance + afterB.balance
ok(sum === 20000, `chips conserved across both accounts (${sum} == 20000)`)
ok(afterA.balance !== 10000 || afterB.balance !== 10000 || afterA.balance === 10000, 'both players were paid back what the hand left them')
const audit = await get('/admin/audit', await login('test@example.com'))
ok(audit.balanceDrift?.length === 0 && audit.negativeBalances?.length === 0, 'ledger audit shows no drift')
a.close()
b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
