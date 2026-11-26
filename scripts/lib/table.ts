// Test helper: make a real table the way the site does. A room is opened, a game and its rules are picked and Start is pressed;
// the room's server then prepares the table, and the first person to open /<game>/<code> sits at it (and becomes its host).
// Needs wrangler dev on :8787. Returns the table's address.
const WS = process.env.WS ?? 'ws://localhost:8787'
const BASE = process.env.BASE ?? 'http://localhost:5200'
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

const API = process.env.API ?? WS.replace(/^ws/, 'http') + '/api'
/** a four-digit code no table is using (the site does the same check before it opens a room) */
async function freeCode(): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const code = String(1000 + Math.floor(Math.random() * 9000))
    try {
      const r = (await (await fetch(`${API}/rooms/${code}`)).json()) as { free?: boolean }
      if (r.free) return code
    } catch {
      return code
    }
  }
  throw new Error('no free room code')
}

/** `waitFor` more people expected in the room: the table then waits in its lobby (up to 6 seconds) instead of starting at once. */
export async function makeTable(game: string, cfg: object = {}, room?: string, waitFor = 0): Promise<string> {
  room ??= await freeCode()
  const ws = new WebSocket(`${WS}/parties/room/${room}`)
  const got: Record<string, unknown>[] = []
  ws.addEventListener('message', (e) => {
    try {
      got.push(JSON.parse(String(e.data)))
    } catch {
      /* ignore */
    }
  })
  await new Promise<void>((res, rej) => {
    ws.addEventListener('open', () => res())
    ws.addEventListener('error', () => rej(new Error('cannot reach the room server on ' + WS)))
  })
  ws.send(JSON.stringify({ t: 'join', id: 'maker-' + room, name: 'Maker', create: true }))
  const until = async (f: () => boolean, what: string) => {
    for (let i = 0; i < 100; i++) {
      if (f()) return
      await wait(50)
    }
    throw new Error('table helper: ' + what + ' ' + JSON.stringify(got.slice(-2)))
  }
  await until(() => got.some((m) => m.t === 'room'), 'room did not open')
  for (let i = 0; i < waitFor; i++) {
    const x = new WebSocket(`${WS}/parties/room/${room}`)
    await new Promise<void>((r) => x.addEventListener('open', () => r()))
    x.send(JSON.stringify({ t: 'join', id: `extra${i}-${room}`, name: 'Extra' + i }))
  }
  await wait(200)
  ws.send(JSON.stringify({ t: 'pick', game, cfg }))
  await until(() => got.some((m) => m.t === 'room' && m.game === game), 'game was not picked')
  ws.send(JSON.stringify({ t: 'launch' }))
  await until(() => got.some((m) => m.t === 'go' || m.t === 'error'), 'no answer to Start')
  const bad = got.find((m) => m.t === 'error')
  if (bad) throw new Error('table helper: ' + JSON.stringify(bad))
  ws.close()
  return room
}

/** The address of a freshly made table (what the old `?room=..&make=1&cfg=..` addresses used to open). */
export async function tableUrl(game: string, cfg: object = {}, room?: string): Promise<string> {
  const code = await makeTable(game, cfg, room)
  return `${BASE}/${game}/${code}`
}
