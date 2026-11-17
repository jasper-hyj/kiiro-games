import { Table, CHAT_KEYS, type TableView, type RoomConfig } from '../src/engine/table'
import { kindOf } from '../src/engine/tiles'
import type { RuleId } from '../src/engine/rules'

const SCENARIOS = Number(process.argv[2] ?? 24)
const SECONDS = Number(process.argv[3] ?? 40)
const rnd = (n: number) => Math.floor(Math.random() * n)
const pick = <T,>(a: readonly T[]): T => a[rnd(a.length)]

interface Violation { scenario: number; config: string; msg: string }
const violations: Violation[] = []
const stats: Record<string, number> = { scenarios: 0, ops: 0, hands: 0, games: 0, rejected: 0, stuck: 0 }

function inv(t: Table): string[] {
  const g = t.game
  if (!g) return []
  const errs: string[] = []
  // 1. every tile id is unique and the full set is accounted for
  const ids: number[] = []
  for (const p of g.players) {
    ids.push(...p.hand, ...p.flowers, ...p.nuki)
    for (const m of p.melds) ids.push(...m.tiles)
    for (const d of p.discards) if (!d.called) ids.push(d.tile)
  }
  ids.push(...g.wall, ...g.dead, ...g.doraPool, ...g.uraPool)
  const expected = g.rule.flowers ? 144 : g.sanma ? 108 : 136
  if (new Set(ids).size !== ids.length) errs.push('duplicate tile ids on the table')
  if (ids.length !== expected && g.phase !== 'over') errs.push(`tile count ${ids.length} != ${expected}`)
  // 2. hand sizes
  if (g.phase === 'turn' || g.phase === 'reaction') {
    for (const p of g.players) {
      const base = g.rule.handSize - 3 * p.melds.length
      const diff = p.hand.length - base
      if (diff !== 0 && diff !== 1) errs.push(`seat ${p.seat} hand size ${p.hand.length} with ${p.melds.length} melds`)
      if (p.drawn !== null && diff !== 1) errs.push(`seat ${p.seat} has a drawn tile but hand size diff ${diff}`)
      if (p.drawn !== null && !p.hand.includes(p.drawn)) errs.push(`seat ${p.seat} drawn tile not in hand`)
    }
  }
  // 3. points conserved
  const start = g.sanma ? 35000 : g.rule.startPoints
  const sum = g.players.reduce((a, p) => a + p.points, 0) + g.sticks * 1000
  if (sum !== start * g.n) errs.push(`points not conserved: ${sum} vs ${start * g.n}`)
  if (g.players.some((p) => !Number.isInteger(p.points))) errs.push('non-integer points')
  // 4. phase sanity
  if (!['turn', 'reaction', 'result', 'over'].includes(g.phase)) errs.push('bad phase ' + g.phase)
  if (g.phase === 'reaction' && !Object.keys(g.reactions).length) errs.push('reaction phase with nobody to react')
  if (g.wall.length < 0) errs.push('negative wall')
  return errs
}

function leaks(t: Table, id: string): string[] {
  const v = t.view(id)
  const errs: string[] = []
  try { JSON.stringify(v) } catch { errs.push('view not serialisable') }
  const g = v.game
  if (g && (g.phase === 'turn' || g.phase === 'reaction')) {
    for (const p of g.players) {
      if (p.seat !== v.you && (p.hand !== null || p.drawn !== null)) errs.push(`view for ${id} leaks seat ${p.seat}'s hand`)
    }
    if (g.result) errs.push('result visible while playing')
  }
  return errs
}

async function scenario(n: number): Promise<void> {
  const rule = pick<RuleId>(['riichi', 'hk', 'taiwan'])
  const cfg: RoomConfig = { rule, aka: Math.random() < 0.5, rounds: rule === 'taiwan' ? pick([1, 4] as const) : pick([1, 2] as const), minFan: rnd(5), players: rule === 'riichi' && Math.random() < 0.4 ? 3 : 4, botLevel: pick(['easy', 'normal'] as const) }
  const t = new Table(cfg)
  t.speed = 0.003
  t.graceMs = 30
  t.turnTimerMs = Math.random() < 0.5 ? 60 + rnd(200) : 0
  const label = JSON.stringify({ ...cfg, timer: t.turnTimerMs })
  const clients = Array.from({ length: 6 }, (_, i) => ({ id: `s${n}c${i}`, name: `N${i}` }))
  const bad = (msg: string) => { if (violations.length < 60) violations.push({ scenario: n, config: label, msg }) }
  let lastCheck = ''
  t.onChange(() => {
    try {
      for (const e of inv(t)) { const k = e + t.game?.handNo; if (k !== lastCheck) { bad(e); lastCheck = k } }
      for (const c of clients) if (t.seatOf(c.id) >= 0 || Math.random() < 0.05) for (const e of leaks(t, c.id)) bad(e)
    } catch (e) { bad('check threw: ' + String(e).slice(0, 120)) }
  })

  let lastHand = 0
  let lastProgress = Date.now()
  const garbage = [NaN, -1, 9999, 'x' as unknown as number, null as unknown as number, 3.5, 143, 0, 1]
  const step = () => {
    stats.ops++
    const c = pick(clients)
    const seat = t.seatOf(c.id)
    const v: TableView = t.view(c.id)
    const g = v.game
    const roll = Math.random()
    try {
      if (!g) {
        // lobby phase
        if (seat < 0) { if (t.join(c.id, c.name + rnd(99)) < 0) stats.rejected++ }
        else if (roll < 0.1) t.leave(c.id)
        else if (roll < 0.25) t.setConfig(c.id, { rule: pick<RuleId>(['riichi', 'hk', 'taiwan']), rounds: pick([1, 2, 4] as const), aka: Math.random() < 0.5, players: pick([3, 4] as const), botLevel: pick(['easy', 'normal'] as const), minFan: rnd(6) } as Partial<RoomConfig>)
        else if (roll < 0.35) t.toggleBot(c.id, rnd(5))
        else if (roll < 0.55) t.start(c.id)
        else if (roll < 0.65) t.chat(c.id, pick([...CHAT_KEYS, 'bogus']))
        return
      }
      if (seat < 0) { if (roll < 0.5) t.join(c.id, c.name) ; return }  // late join mid-game
      if (roll < 0.015) { t.leave(c.id); return }                      // disconnect
      if (roll < 0.03) { t.join(c.id, c.name); return }                // reconnect
      if (roll < 0.05) { t.chat(c.id, pick(CHAT_KEYS)); return }
      if (roll < 0.07 && roll >= 0.05) { t.setConfig(c.id, { rule: 'hk' }); t.toggleBot(c.id, rnd(4)); t.start(c.id); return } // must all be ignored mid-game
      if (roll < 0.0802 && roll >= 0.08 && !process.env.NOLOBBY) { t.backToLobby(c.id); return }
      if (g.phase === 'over') { if (roll < 0.3) { t.backToLobby(c.id); stats.rematch = (stats.rematch ?? 0) + 1 } return }
      if (g.phase === 'result') { if (roll < 0.6) t.ack(c.id); return }
      if (roll < 0.2) { // invalid input
        const k = rnd(6)
        if (k === 0) t.turnAction(c.id, { type: 'discard', tile: pick(garbage) } as never)
        else if (k === 1) t.turnAction(c.id, { type: 'nonsense' } as never)
        else if (k === 2) t.decide(c.id, { type: 'chi', use: [pick(garbage), pick(garbage)] } as never)
        else if (k === 3) t.decide(c.id, pick([{ type: 'ron' }, { type: 'pon' }, { type: 'minkan' }, { type: 'bogus' }] as never[]))
        else if (k === 4) t.turnAction(c.id, { type: 'ankan', kind: pick(garbage) } as never)
        else t.turnAction(c.id, undefined as never)
        return
      }
      const o = g.turnOptions
      if (o) {
        const r = Math.random()
        if (o.tsumo && r < 0.8) t.turnAction(c.id, { type: 'tsumo' })
        else if (o.abort && r < 0.3) t.turnAction(c.id, { type: 'abort' })
        else if (o.nuki && r < 0.6) t.turnAction(c.id, { type: 'nuki' })
        else if (o.ankan.length && r < 0.3) t.turnAction(c.id, { type: 'ankan', kind: pick(o.ankan) })
        else if (o.kakan.length && r < 0.3) t.turnAction(c.id, { type: 'kakan', tile: pick(o.kakan) })
        else if (o.riichi.length && r < 0.5) t.turnAction(c.id, { type: 'discard', tile: pick(o.riichi), riichi: true })
        else if (o.discard.length) t.turnAction(c.id, { type: 'discard', tile: pick(o.discard) })
        return
      }
      const rc = g.reaction
      if (rc) {
        const r = Math.random()
        if (rc.ron && r < 0.7) t.decide(c.id, { type: 'ron' })
        else if (rc.pon && r < 0.4) t.decide(c.id, { type: 'pon' })
        else if (rc.minkan && r < 0.3) t.decide(c.id, { type: 'minkan' })
        else if (rc.chi.length && r < 0.5) t.decide(c.id, { type: 'chi', use: pick(rc.chi) })
        else t.decide(c.id, { type: 'pass' })
      }
    } catch (e) {
      bad('exception: ' + String(e).slice(0, 160) + ' @' + String((e as Error).stack?.split('\n')[1] ?? '').trim().slice(0, 100))
    }
    const hn = t.game?.handNo ?? 0
    if (hn !== lastHand) { lastHand = hn; lastProgress = Date.now(); stats.hands++ }
    if (t.game?.phase === 'over') stats.games++
  }

  const iv = setInterval(() => { for (let i = 0; i < 3; i++) step() }, 3)
  // keep at least one client present so the game is not abandoned
  t.join(clients[0].id, clients[0].name)
  await new Promise((r) => setTimeout(r, SECONDS * 1000))
  clearInterval(iv)
  // stuck detection: the game should keep moving while somebody is connected or a bot is playing
  if (t.game && t.game.phase !== 'over' && Date.now() - lastProgress > 20000 && t.game.phase !== 'result') {
    // human-controlled seat waiting with timer off is legitimately idle; only flag when everything is bot/timer driven
    const waiting = t.game.phase === 'turn' ? t.game.turn : t.game.pendingSeats()[0]
    if (waiting !== undefined && (t.isBotControlled(waiting) || t.turnTimerMs > 0)) { stats.stuck++; bad(`stuck for 20s in phase ${t.game.phase} waiting on seat ${waiting}`) }
  }
  stats.scenarios++
}

async function main() {
  const t0 = Date.now()
  await Promise.all(Array.from({ length: SCENARIOS }, (_, i) => scenario(i)))
  console.log(`fuzz: ${stats.scenarios} scenarios, ${stats.ops} operations, ${stats.hands} hands, ${stats.games} game-over screens, ${stats.rematch ?? 0} rematches, ${stats.rejected} joins rejected, ${Math.round((Date.now() - t0) / 1000)}s`)
  if (!violations.length) console.log('no invariant violations')
  const seen = new Set<string>()
  for (const v of violations) {
    const k = v.msg.replace(/\d+/g, '#')
    if (seen.has(k)) continue
    seen.add(k)
    console.log(`VIOLATION [scenario ${v.scenario}] ${v.msg}\n   ${v.config}`)
  }
  process.exit(violations.length ? 1 : 0)
}
main()
void kindOf
