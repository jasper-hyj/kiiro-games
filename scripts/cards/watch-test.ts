export {}
// Run: npx tsx scripts/cards/watch-test.ts   (needs `wrangler dev` on :8787)
// Observers: they see the table but never a hand, can read and write chat, cannot act, and can take a seat.
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
// a code no table is using (left-over tables from earlier runs would otherwise be joined by accident)
const code = async (): Promise<string> => {
  for (let i = 0; i < 40; i++) {
    const c = String(1000 + Math.floor(Math.random() * 9000))
    try {
      if (((await (await fetch(`http://localhost:8787/api/rooms/${c}`)).json()) as { free?: boolean }).free) return c
    } catch {
      return c
    }
  }
  throw new Error('no free code')
}
function client(room: string, id: string, name: string, game: string, o: { create?: boolean; watch?: boolean } = {}) {
  const ws = new WebSocket(`ws://localhost:8787/parties/main/${room}`)
  const c = {
    view: null as any,
    talk: [] as any[],
    errors: [] as string[],
    send: (m: unknown) => ws.send(JSON.stringify({ t: 'p', m })),
    say: (text: string) => ws.send(JSON.stringify({ t: 'talk', text })),
    close: () => ws.close(),
  }
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data))
    if (m.t === 'pview' || m.t === 'view') c.view = m.view
    if (m.t === 'talk') c.talk.push(m.msg)
    if (m.t === 'error') c.errors.push(m.message)
  }
  ws.onopen = () =>
    ws.send(
      JSON.stringify({ t: 'join', id, name, game, ...(o.create ? { create: true, pcfg: { bb: 10, casual: true } } : {}), ...(o.watch ? { watch: true } : {}) }),
    )
  return c
}
const tag = Math.random().toString(36).slice(2, 5)

{
  // Big Two
  const room = await code()
  const host = client(room, 'h' + tag, 'Host', 'bigtwo', { create: true })
  await sleep(500)
  const w = client(room, 'w' + tag, 'Watcher', 'bigtwo', { watch: true })
  await sleep(500)
  ok(w.view?.you === -1 && w.view.hand.length === 0, 'bigtwo: a watcher has no seat and no hand')
  ok(host.view?.watching === 1, 'bigtwo: the host sees one person watching')
  host.send({ k: 'start' })
  await sleep(800)
  ok(
    w.view?.status === 'playing' && w.view.hand.length === 0 && w.view.seats.every((s: any) => typeof s.count === 'number'),
    'bigtwo: a watcher sees counts but never cards',
  )
  ok(!JSON.stringify(w.view).includes(JSON.stringify(host.view.hand)), 'bigtwo: the host hand is not in the watcher view')
  w.say('hello from the stands')
  await sleep(400)
  ok(host.talk.some((m) => m.text === 'hello from the stands') && w.talk.length === 1, 'bigtwo: watchers can write chat and everyone reads it')
  host.say('and the players answer')
  await sleep(1200)
  ok(
    w.talk.some((m) => m.text === 'and the players answer'),
    'bigtwo: watchers read the players chat',
  )
  host.close()
  w.close()
  await sleep(300)
}
{
  // Big Two: a full room turns the fifth person into a watcher
  const room = await code()
  const ps = [0, 1, 2, 3].map((i) => client(room, `p${i}${tag}`, 'P' + i, 'bigtwo', { create: i === 0 }))
  await sleep(900)
  const extra = client(room, 'x' + tag, 'Extra', 'bigtwo')
  await sleep(600)
  ok(extra.view?.you === -1 && !extra.errors.includes('room_full'), 'bigtwo: the fifth person watches instead of being refused')
  ps[3].close()
  await sleep(600)
  extra.send({ k: 'sit' })
  await sleep(500)
  ok(extra.view?.you >= 0, 'bigtwo: a watcher can take a seat that opened up')
  ps.forEach((p) => p.close())
  extra.close()
  await sleep(300)
}
{
  // Hold'em: a watcher sees no hole cards
  const room = await code()
  const a = client(room, 'a' + tag, 'A', 'holdem', { create: true })
  await sleep(500)
  const w = client(room, 'w' + tag, 'W', 'holdem', { watch: true })
  await sleep(500)
  ok(w.view && (w.view.you ?? -1) < 0, 'holdem: a watcher is not seated')
  w.say('watching quietly')
  await sleep(400)
  ok(a.talk.length === 1, "holdem: a watcher's chat reaches the table")
  a.close()
  w.close()
}
{
  // Mahjong
  const room = await code()
  const mk = (id: string, name: string, o: { create?: boolean; watch?: boolean } = {}) => {
    const ws = new WebSocket(`ws://localhost:8787/parties/main/${room}`)
    const c = { view: null as any, talk: [] as any[], errors: [] as string[], send: (m: unknown) => ws.send(JSON.stringify(m)), close: () => ws.close() }
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data))
      if (m.t === 'view') c.view = m.view
      if (m.t === 'talk') c.talk.push(m.msg)
      if (m.t === 'error') c.errors.push(m.message)
    }
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', id, name, ...(o.create ? { create: true } : {}), ...(o.watch ? { watch: true } : {}) }))
    return c
  }
  const host = mk('mh' + tag, 'Host', { create: true })
  await sleep(500)
  const w = mk('mw' + tag, 'Watcher', { watch: true })
  await sleep(500)
  ok(w.view?.you === -1 && !w.errors.length, 'mahjong: a watcher joins without a seat')
  host.send({ t: 'start' })
  await sleep(1200)
  const handsSeen = w.view?.game?.players?.filter((p: any) => p.hand).length ?? -1
  ok(w.view?.status === 'playing' && handsSeen === 0, `mahjong: a watcher sees no hands during play (${handsSeen} visible)`)
  ok(host.view?.watching === 1, 'mahjong: the host sees one person watching')
  w.send({ t: 'act', a: { k: 'discard', tile: 0 } })
  await sleep(200)
  w.send({ t: 'talk', text: 'good luck all' })
  await sleep(400)
  ok(host.talk.some((m: any) => m.text === 'good luck all') && w.talk.length === 1, 'mahjong: chat works for watchers and players')
  host.close()
  w.close()
}
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
