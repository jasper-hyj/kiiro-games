export {}
// Run: npx tsx scripts/blackjack/ws-test.ts   (needs `wrangler dev` on :8787 with DEV_MODE=1)
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
    errors,
    get view() {
      return view
    },
    close: () => ws.close(),
  }
}
const tag = Math.random().toString(36).slice(2, 6)
const code = () => String(1000 + Math.floor(Math.random() * 9000))

// casual: a guest plays rounds against the dealer
let room = code()
const g = client(room, 'g' + tag, 'Gus', { create: true, game: 'blackjack', pcfg: { bb: 10, casual: true } })
await sleep(500)
ok(g.view?.config?.bet === 10 && g.view?.config?.casual === true, 'blackjack room is created with the chosen minimum bet')
g.p({ k: 'sit', buyin: 0 })
await sleep(500)
ok(g.view?.phase === 'bet' && g.view?.canBet === true, 'a seated player gets the betting window')
g.p({ k: 'act', a: { a: 'bet', amount: 10 } })
await sleep(600)
ok(g.view?.phase === 'play' || g.view?.phase === 'result' || g.view?.phase === 'bet', 'the round is dealt once everyone has bet')
const my = () => g.view?.seats?.find((s: any) => s.me)
ok((my()?.hands?.[0]?.cards?.length ?? 0) >= 2 || g.view?.phase !== 'play', 'you see your own two cards')
if (g.view?.phase === 'play') ok(g.view.dealer.cards[1] === null, "the dealer's hole card stays hidden during play")
for (let i = 0; i < 12 && g.view?.phase === 'play'; i++) {
  if (g.view.options) g.p({ k: 'act', a: { a: 'stand' } })
  await sleep(250)
}
await sleep(3000)
ok(['result', 'bet', 'wait'].includes(g.view?.phase), 'the round finishes after standing')
g.close()

// wrong game
room = code()
const h = client(room, 'h' + tag, 'H', { create: true, game: 'blackjack', pcfg: { bb: 10, casual: true } })
await sleep(400)
const w = client(room, 'w' + tag, 'W', { game: 'holdem' })
await sleep(400)
ok(w.errors.includes('wrong_game:blackjack'), "joining a blackjack code as hold'em says which game it is")
h.close()
w.close()

// cash: bet from a real balance, leave, and the ledger and history agree
const ta = await login(`bj${tag}@x.test`)
room = code()
const a = client(room, 'a' + tag, 'A', { token: ta, create: true, game: 'blackjack', pcfg: { bb: 10, casual: false } })
await sleep(500)
const before = (await get('/me', ta)).balance
a.p({ k: 'sit', buyin: 500 })
await sleep(700)
ok(before - (await get('/me', ta)).balance === 500, 'buy-in of 500 comes off the balance')
for (let round = 0; round < 6; round++) {
  for (let k = 0; k < 20 && a.view?.phase !== 'bet'; k++) await sleep(200)
  if (a.view?.phase === 'bet') a.p({ k: 'act', a: { a: 'bet', amount: 20 } })
  for (let k = 0; k < 40; k++) {
    await sleep(200)
    if (a.view?.options) a.p({ k: 'act', a: { a: 'stand' } })
    if (a.view?.phase === 'result') break
  }
}
await sleep(500)
a.p({ k: 'stand' })
await sleep(1500)
const after = (await get('/me', ta)).balance
const hist = (await get('/me/matches', ta)).matches.filter((m: any) => m.game === 'blackjack')
const net = hist.reduce((x: number, m: any) => x + m.chips, 0)
ok(hist.length >= 3, `rounds are saved as matches (${hist.length})`)
ok(after - before === net, `balance change (${after - before}) equals the sum of saved round results (${net})`)
const audit = await get('/admin/audit', await login('test@example.com'))
ok(audit.balanceDrift?.length === 0, 'ledger audit shows no drift')
a.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
