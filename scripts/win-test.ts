import { Game } from '../src/engine/game'
import { Table } from '../src/engine/table'
import { kindOf, sortIds } from '../src/engine/tiles'
import type { RuleId } from '../src/engine/rules'

let fails = 0
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fails++
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`)
}
const parse = (s: string): number[] => {
  const ks: number[] = []; let d: number[] = []
  for (const ch of s) { if (/\d/.test(ch)) d.push(+ch); else { const b = ({ m: 0, p: 9, s: 18, z: 27 } as any)[ch]; for (const x of d) ks.push(b + x - 1); d = [] } }
  return ks
}

/** A game where every seat holds a fixed hand; ids are unique across seats. */
function table(rule: RuleId, hands: string[], opts: Partial<{ wall: number; discards: number }> = {}) {
  const g = new Game(rule, { rule, aka: false, rounds: 1, minFan: 0 } as any, ['A', 'B', 'C', 'D'])
  const used = new Map<number, number>()
  const take = (k: number) => { const n = used.get(k) ?? 0; used.set(k, n + 1); return k * 4 + n }
  hands.forEach((h, seat) => {
    const p = g.players[seat]
    p.hand = sortIds(parse(h).map(take)); p.drawn = null; p.melds = []; p.flowers = []; p.riichi = false
    p.discards = Array.from({ length: opts.discards ?? 1 }, () => ({ tile: take(33), riichi: false, called: false })) // dummy discards (not first turn)
  })
  const left: number[] = []
  for (let k = 0; k < 34; k++) for (let c = 0; c < 4; c++) if (c >= (used.get(k) ?? 0)) left.push(k * 4 + c)
  g.wall = left.slice(0, opts.wall ?? 40)
  g.dealer = 0; g.roundIndex = 0; g.lian = 0; g.honba = 0; g.sticks = 0
  g.reactions = {}; g.decisions = {}; g.phase = 'turn'; g.anyCall = true
  return { g, take, used }
}
/** seat throws the given tile out (it is placed in their hand as the drawn tile first). */
function throwOut(t: ReturnType<typeof table>, seat: number, tile: string) {
  const p = t.g.players[seat]
  const id = t.take(parse(tile)[0])
  p.hand.push(id); p.drawn = id; t.g.turn = seat; t.g.phase = 'turn'
  return { ok: t.g.act(seat, { type: 'discard', tile: id }), id }
}

const TENPAI = '123m456m789m123p45p77s'   // 16 tiles, waits 3p / 6p
const JUNK = '147m258p369s1234z567z'      // 16 tiles, nothing
const JUNK2 = '147m258p369s2z3z4z567z1z'.slice(0, 0) + '1479m2589p369s123z'  // 16

// 1. one tile away, an opponent throws the winning tile out
{
  const t = table('taiwan', [JUNK, JUNK, TENPAI, JUNK])
  const r = throwOut(t, 1, '3p')
  eq('discard accepted, game waits for reactions', [r.ok, t.g.phase], [true, 'reaction'])
  eq('only the waiting player gets a Ron option', Object.keys(t.g.reactions).map(Number), [2])
  eq('Ron is offered', t.g.reactions[2].ron, true)
  eq('declaring Ron from a non-waiting seat is rejected', t.g.submitDecision(3, { type: 'ron' }), false)
  eq('Ron accepted', t.g.submitDecision(2, { type: 'ron' }), true)
  const res = t.g.result!
  eq('result: win by ron from seat 1', [t.g.phase, res.kind, res.winner, res.from, res.tsumo], ['result', 'win', 2, 1, false])
  eq('payment: discarder alone pays 30 + 10*3 tai', res.deltas, [0, -60, 60, 0])
  eq('points updated and conserved', t.g.players.map((p) => p.points), [1000, 940, 1060, 1000])
  eq('dealer (seat 0) lost -> deal passes to seat 1', [t.g.dealer, t.g.roundIndex], [1, 1])
  t.g.next()
  eq('next hand starts: new hand, new dealer (seat 1) holds 17, others 16', [t.g.handNo, t.g.phase, t.g.players.map((p) => p.hand.length)].join(), [2, 'turn', 16, 17, 16, 16].join())
}

// 2. pass on the winning tile, then still win on the next one (Taiwan has no furiten)
{
  const t = table('taiwan', [JUNK, JUNK, TENPAI, JUNK])
  throwOut(t, 1, '3p')
  t.g.submitDecision(2, { type: 'pass' })
  eq('after everyone passes the next player draws', [t.g.phase, t.g.turn], ['turn', 2])
  t.g.players[2].hand = t.g.players[2].hand.slice(0, 16) // seat 2 drew a tile; discard it and let seat 3 throw the other wait
  const drawn = t.g.players[2].drawn!
  t.g.act(2, { type: 'discard', tile: drawn })
  throwOut(t, 3, '6p')
  eq('Ron offered again on the other wait', t.g.reactions[2]?.ron, true)
}

// 3. tsumo: the winning tile is drawn
{
  const t = table('taiwan', [JUNK, JUNK, TENPAI, JUNK])
  const id = t.take(parse('3p')[0])
  const p = t.g.players[2]; p.hand.push(id); p.drawn = id; t.g.turn = 2; t.g.phase = 'turn'
  const o = t.g.turnOptions(2)
  eq('Tsumo is offered when the drawn tile completes the hand', o.tsumo, true)
  eq('Tsumo accepted', t.g.act(2, { type: 'tsumo' }), true)
  const res = t.g.result!
  eq('tsumo payments: dealer pays +1 tai extra, others pay base', res.deltas, [-90, -80, 250, -80])
  eq('tsumo scored as concealed self-draw (3) + pinghu (2)', res.score!.total, 5)
}
{
  const t = table('taiwan', [JUNK, JUNK, TENPAI, JUNK])
  const id = t.take(parse('1z')[0]) // useless draw
  const p = t.g.players[2]; p.hand.push(id); p.drawn = id; t.g.turn = 2; t.g.phase = 'turn'
  eq('no Tsumo offered when the draw does not complete the hand', t.g.turnOptions(2).tsumo, false)
  eq('Tsumo rejected if forced', t.g.act(2, { type: 'tsumo' }), false)
}

// 4. double ron (Taiwan): two players wait on the same tile
{
  const t = table('taiwan', [JUNK, JUNK, TENPAI, TENPAI])
  throwOut(t, 1, '3p')
  eq('both waiting players get Ron', Object.keys(t.g.reactions).map(Number).sort(), [2, 3])
  t.g.submitDecision(2, { type: 'ron' })
  eq('game waits for the other ron decision', t.g.phase, 'reaction')
  t.g.submitDecision(3, { type: 'ron' })
  const res = t.g.result!
  eq('double ron: discarder pays both winners', res.deltas, [0, -120, 60, 60])
  eq('double ron: second winner is recorded', res.others?.map((o) => o.winner), [3])
}
// one ron, one pass
{
  const t = table('taiwan', [JUNK, JUNK, TENPAI, TENPAI])
  throwOut(t, 1, '3p')
  t.g.submitDecision(2, { type: 'pass' }); t.g.submitDecision(3, { type: 'ron' })
  eq('passing player does not win, the other does', [t.g.result!.winner, t.g.result!.deltas], [3, [0, -60, 0, 60]])
}

// 5. dealer wins: keeps the seat, streak grows
{
  const t = table('taiwan', [TENPAI, JUNK, JUNK, JUNK])
  throwOut(t, 1, '3p')
  t.g.submitDecision(0, { type: 'ron' })
  eq('dealer win: seat kept, streak +1', [t.g.dealer, t.g.lian, t.g.roundIndex], [0, 1, 0])
  eq('dealer win scores dealer tai (1) on top', t.g.result!.score!.yaku.some((y) => y.name === 'Dealer'), true)
}

// 6. last discard of the wall
{
  const t = table('taiwan', [JUNK, JUNK, TENPAI, JUNK], { wall: 0 })
  throwOut(t, 1, '3p')
  eq('ron on the very last discard is still allowed', t.g.reactions[2]?.ron, true)
  t.g.submitDecision(2, { type: 'ron' })
  eq('last discard bonus tai counted (1 more tai)', t.g.result!.score!.yaku.some((y) => y.name === 'Last Discard'), true)
}
// wall empty and nobody wins -> draw, dealer stays
{
  const t = table('taiwan', [JUNK, JUNK, JUNK, JUNK], { wall: 0 })
  throwOut(t, 1, '1z')
  eq('exhausted wall with no winner is a draw', [t.g.phase, t.g.result?.kind], ['result', 'draw'])
  eq('draw: dealer stays and streak counts (Taiwanese)', [t.g.dealer, t.g.lian], [0, 1])
}

// 7. all eight flowers
{
  const t = table('taiwan', [JUNK, JUNK, JUNK, JUNK])
  t.g.players[1].flowers = [136, 137, 138, 139, 140, 141, 142]
  t.g.wall.push(143) // next draw is the 8th flower
  ;(t.g as any).beginTurn(1, false)
  eq('eight flowers wins immediately', [t.g.phase, t.g.result?.winner, t.g.result?.score?.yaku[0].name], ['result', 1, 'Eight Flowers'])
}

// 8. furiten (riichi): a winning tile already in your own discards blocks ron, tsumo is still fine
{
  const H13 = '123m456m789m45p77s' // waits 3p / 6p
  const t = table('riichi', [JUNK2.slice(0, 0) + '1479m2589p369s1z', '1479m2589p369s2z', H13, '1479m2589p369s3z'])
  const p = t.g.players[2]; p.riichi = true
  p.discards.push({ tile: t.take(parse('6p')[0]), riichi: false, called: false }) // own discard 6p => furiten
  throwOut(t, 1, '3p')
  eq('furiten: no Ron offered even though 3p completes the hand', t.g.reactions[2]?.ron ?? false, false)
}
{
  const H13 = '123m456m789m45p77s'
  const t = table('riichi', [JUNK2.slice(0, 0) + '1479m2589p369s1z', '1479m2589p369s2z', H13, '1479m2589p369s3z'])
  t.g.players[2].riichi = true
  throwOut(t, 1, '3p')
  eq('riichi hand, not furiten: Ron offered', t.g.reactions[2]?.ron, true)
  t.g.submitDecision(2, { type: 'ron' })
  eq('riichi win pays discarder 1000-ish and updates points', [t.g.result!.kind, t.g.result!.deltas[1] < 0, t.g.result!.deltas.reduce((a, b) => a + b, 0)], ['win', true, 0])
}
{
  // passing a ron under riichi rules makes you temporarily furiten
  const H13 = '123m456m789m45p77s'
  const t = table('riichi', [JUNK2.slice(0, 0) + '1479m2589p369s1z', '1479m2589p369s2z', H13, '1479m2589p369s3z'])
  t.g.players[2].riichi = true
  throwOut(t, 1, '3p')
  t.g.submitDecision(2, { type: 'pass' })
  eq('passed ron -> furiten flag set', t.g.isFuriten(2), true)
}

// 9. through Table (what the UI sees): view shows Ron, decide, ack, next hand
async function viaTable() {
  const tb = new Table({ rule: 'taiwan', aka: false, rounds: 1, minFan: 0, players: 4, botLevel: 'normal' }); tb.randomize = false
  tb.join('me', 'Me')
  tb.start('me')
  const g = tb.game!
  const used = new Map<number, number>()
  const take = (k: number) => { const n = used.get(k) ?? 0; used.set(k, n + 1); return k * 4 + n }
  ;[TENPAI, JUNK, JUNK, JUNK].forEach((h, s) => { const p = g.players[s]; p.hand = sortIds(parse(h).map(take)); p.drawn = null; p.flowers = []; p.melds = []; p.discards = [{ tile: take(33), riichi: false, called: false }] })
  g.anyCall = true; g.phase = 'turn'; g.turn = 1
  const id = take(parse('3p')[0]); g.players[1].hand.push(id); g.players[1].drawn = id
  g.act(1, { type: 'discard', tile: id })
  const v = tb.view('me').game!
  eq('UI view: reaction offered to the human with Ron', [v.phase, v.reaction?.ron, v.lastDiscard?.from], ['reaction', true, 1])
  tb.decide('me', { type: 'ron' })
  const v2 = tb.view('me').game!
  eq('UI view: result shows winner, tai and score changes', [v2.phase, v2.result?.winner, v2.result?.score?.total, v2.players[0].points], ['result', 0, 4, 1060 + 10])
  tb.ack('me')
  await new Promise((r) => setTimeout(r, 700))
  const v3 = tb.view('me').game!
  eq('UI view: after Next hand a new hand starts', [v3.handNo, v3.phase === 'turn' || v3.phase === 'reaction'], [2, true])
}
await viaTable()


// 10. hand-value preview: a closed tenpai hand with no yaku shows what riichi would make it worth
async function previewTest() {
  const tb = new Table({ rule: 'riichi', aka: false, rounds: 1, minFan: 0, players: 4, botLevel: 'normal' }); tb.randomize = false
  tb.join('me', 'Me')
  tb.start('me')
  const g = tb.game!
  const used = new Map<number, number>()
  const take = (k: number) => { const n = used.get(k) ?? 0; used.set(k, n + 1); return k * 4 + n }
  ;['123m456p789s33z44z', JUNK, JUNK, JUNK].forEach((h, i) => { const p = g.players[i]; p.hand = sortIds(parse(h).map(take)); p.drawn = null; p.flowers = []; p.melds = []; p.discards = [{ tile: take(33), riichi: false, called: false }] })
  g.players[1].hand = g.players[1].hand.slice(0, 13); g.players[2].hand = g.players[2].hand.slice(0, 13); g.players[3].hand = g.players[3].hand.slice(0, 13)
  const id = take(parse('1z')[0]); g.players[1].hand.push(id); g.players[1].drawn = id
  g.anyCall = true; g.phase = 'turn'; g.turn = 1
  const h = tb.view('me').game!.hint
  eq('preview: waits are 3z/4z', h?.waits.slice().sort((a, b) => a - b), [29, 30])
  eq('preview: no yaku without riichi, but valued "with riichi"', [h?.values[29]?.riichi, (h?.values[29]?.total ?? 0) >= 1], [true, true])
  g.players[0].riichi = true
  const h2 = tb.view('me').game!.hint
  eq('preview: once riichi is declared the value is real (not hypothetical)', [h2?.values[29]?.riichi ?? false, (h2?.values[29]?.total ?? 0) >= 1], [false, true])
}
await previewTest()

console.log(fails ? `\n${fails} FAILED` : '\nall win checks passed')
process.exit(fails ? 1 : 0)
