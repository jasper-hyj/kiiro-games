import { Game, type Decision, type TurnAction } from '../src/engine/game'
import { botTurn } from '../src/engine/bot'
import { kindOf, numOf, suitOf } from '../src/engine/tiles'
import type { RuleId } from '../src/engine/rules'
import { auditGame } from '../src/engine/audit'

/** Independent check of every chi / pon / kan / ron option the engine offers (and rejects) over thousands of random turns. */
let bad = 0
const fail = (m: string) => { bad++; if (bad <= 25) console.log('FAIL', m) }
const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
const counts = (ids: number[]) => { const c = new Array(34).fill(0); for (const i of ids) c[kindOf(i)]++; return c }

let checkedReactions = 0, checkedTurns = 0, chiOffered = 0, ponOffered = 0, kanOffered = 0, rejected = 0

function checkReaction(g: Game, seat: number, from: number, tile: number) {
  const r = g.reactions[seat]
  if (!r) return
  const p = g.players[seat]
  const k = kindOf(tile)
  const c = counts(p.hand)
  checkedReactions++
  if (seat === from) fail('reaction offered to the discarder')
  if (p.out) fail('reaction offered to a player who already won')
  // pon: needs two of the same kind in hand
  if (r.pon && c[k] < 2) fail(`pon offered without two ${k} in hand (${c[k]})`)
  if (r.pon) ponOffered++
  if (r.minkan && c[k] < 3) fail(`kan offered without three ${k} in hand (${c[k]})`)
  if (r.minkan) kanOffered++
  if (!r.pon && c[k] >= 2 && !p.riichi && g.wall.length > 0 && !(g.sichuan && suitOf(k) === p.voidSuit)) fail(`pon missing although two ${k} are held`)
  // chi: only from the player on the left (the previous seat), numbers only, never in sanma / sichuan, and only real runs
  for (const use of r.chi) {
    chiOffered++
    if ((from + 1) % g.n !== seat) fail(`chi offered to seat ${seat} from seat ${from} (not the player on the left)`)
    if ((g.sanma && g.isRiichi) || g.sichuan) fail('chi offered in a ruleset without chi')
    if (k >= 27) fail('chi offered on an honor tile')
    const kinds = [kindOf(use[0]), kindOf(use[1]), k].sort((a, b) => a - b)
    if (!(kinds[1] === kinds[0] + 1 && kinds[2] === kinds[1] + 1)) fail(`chi with a non-sequence ${kinds.join(',')}`)
    if (new Set(kinds.map(suitOf)).size !== 1) fail(`chi across suits ${kinds.join(',')}`)
    if (!p.hand.includes(use[0]) || !p.hand.includes(use[1]) || use[0] === use[1]) fail('chi uses tiles that are not in the hand')
    if (kinds[0] % 9 > 6) fail('chi sequence wraps around a suit')
  }
  // every possible run is offered when it exists, and none otherwise
  if (g.reactionKind === 'chankan') { /* robbing a kan: only ron is offered, never a chi or pon */ }
  else if (!(g.sanma && g.isRiichi) && !g.sichuan && (from + 1) % g.n === seat && k < 27 && g.wall.length > 0 && !p.riichi) {
    const n = numOf(k)
    const has = (kk: number) => kk >= 0 && kk < 27 && suitOf(kk) === suitOf(k) && c[kk] > 0
    let want = 0
    if (n >= 3 && has(k - 2) && has(k - 1)) want++
    if (n >= 2 && n <= 8 && has(k - 1) && has(k + 1)) want++
    if (n <= 7 && has(k + 1) && has(k + 2)) want++
    if (r.chi.length !== want) fail(`chi options ${r.chi.length} but ${want} runs exist for kind ${k} [rule ${g.rule.id} n=${g.n} wall=${g.wall.length} hand=${p.hand.map(kindOf).sort((a, b) => a - b)} melds=${p.melds.length} riichi=${p.riichi} out=${p.out} void=${p.voidSuit} from=${from} seat=${seat}]`)
  } else if (r.chi.length) fail('chi offered where chi is not allowed')
}

function checkTurn(g: Game, seat: number) {
  const o = g.turnOptions(seat)
  const p = g.players[seat]
  const c = counts(p.hand)
  checkedTurns++
  for (const k of o.ankan) if (c[k] !== 4) fail(`closed kan offered with ${c[k]} of kind ${k}`)
  for (const id of o.kakan) {
    const meld = p.melds.find((m) => m.type === 'pon' && kindOf(m.tiles[0]) === kindOf(id))
    if (!meld) fail('added kan offered without a matching pon')
    if (!p.hand.includes(id)) fail('added kan tile is not in the hand')
  }
  for (const d of o.discard) if (!p.hand.includes(d)) fail('discard offered for a tile not in the hand')
  if (g.sichuan && p.voidSuit !== null) {
    const voids = p.hand.filter((i) => suitOf(kindOf(i)) === p.voidSuit)
    if (voids.length && !o.discard.every((d) => voids.includes(d))) fail('Sichuan: a non-void tile may be discarded while void tiles remain')
  }
  if (o.discard.length === 0 && !o.tsumo && g.phase === 'turn') fail('a turn with nothing to do')
}

function illegalAttempts(g: Game, seat: number, from: number, tile: number) {
  const p = g.players[seat]
  const r = g.reactions[seat]
  if (!r || g.decisions[seat]) return
  const c = counts(p.hand)
  const k = kindOf(tile)
  const tries: Decision[] = []
  if (!r.pon) tries.push({ type: 'pon' })
  if (!r.minkan) tries.push({ type: 'minkan' })
  if (!r.ron) tries.push({ type: 'ron' })
  tries.push({ type: 'chi', use: [p.hand[0], p.hand[0]] as [number, number] })
  tries.push({ type: 'chi', use: [-1, 99999] as [number, number] })
  for (const use of [[p.hand[0], p.hand[1]], [p.hand[2], p.hand[5]]] as [number, number][]) if (!r.chi.some((x) => x[0] === use[0] && x[1] === use[1])) tries.push({ type: 'chi', use })
  tries.push({ type: 'garbage' } as unknown as Decision, null as unknown as Decision, { type: 'chi' } as unknown as Decision)
  void c; void k; void from
  for (const d of tries) {
    const before = JSON.stringify([g.decisions, g.phase])
    const ok = g.submitDecision(seat, d)
    if (ok) fail(`engine accepted an illegal decision ${JSON.stringify(d)} for seat ${seat}`)
    else rejected++
    if (JSON.stringify([g.decisions, g.phase]) !== before) fail('a rejected decision changed the game state')
  }
}

function playGame(rule: RuleId, players: 3 | 4, callBias: number): void {
  const n = rule === 'riichi' ? players : 4
  const g = new Game(rule, { rule, aka: true, rounds: 1, minFan: rule === 'mcr' ? 8 : rule === 'hk' ? 1 : 0, swap: false } as never, Array.from({ length: n }, (_, i) => 'P' + i))
  let guard = 0
  while ((g.phase as string) !== 'over' && guard++ < 30000) {
    const ph = g.phase as string
    if (ph !== 'swap' && ph !== 'void') { const a = auditGame(g); if (a.length) { fail(`${rule}: audit — ${a.slice(0, 3).join(' | ')}`); break } }
    if (ph === 'swap') { for (const p of g.players) { const suit = [0, 1, 2].find((s) => g.players[p.seat].hand.filter((i) => suitOf(kindOf(i)) === s).length >= 3) ?? 0; g.submitSwap(p.seat, g.players[p.seat].hand.filter((i) => suitOf(kindOf(i)) === suit).slice(0, 3)) } }
    else if (ph === 'void') { for (const p of g.players) g.submitVoid(p.seat, Math.floor(Math.random() * 3)) }
    else if (ph === 'turn') {
      const s = g.turn
      checkTurn(g, s)
      const o = g.turnOptions(s)
      let a: TurnAction
      const roll = Math.random()
      if (o.tsumo) a = { type: 'tsumo' }
      else if (o.ankan.length && roll < callBias) a = { type: 'ankan', kind: rnd(o.ankan) }
      else if (o.kakan.length && roll < callBias) a = { type: 'kakan', tile: rnd(o.kakan) }
      else a = Math.random() < 0.5 ? botTurn(g, s, 'normal') : { type: 'discard', tile: rnd(o.discard) }
      if (!g.act(s, a)) { fail(`own action rejected: ${JSON.stringify(a)}`); g.act(s, { type: 'discard', tile: o.discard[0] }) }
      // an illegal turn action must be refused
      if ((g.phase as string) === 'turn') {
        const s2 = g.turn
        const o2 = g.turnOptions(s2)
        const p2 = g.players[s2]
        const notMine = [0, 1, 2, 3, 135].filter((id) => !p2.hand.includes(id))[0]
        if (g.act(s2, { type: 'discard', tile: notMine })) fail('discard of a tile not in the hand was accepted')
        if (!o2.ankan.includes(5) && g.act(s2, { type: 'ankan', kind: 5 })) fail('closed kan accepted without four tiles')
        if (!o2.tsumo && g.act(s2, { type: 'tsumo' })) fail('tsumo accepted on a non-winning hand')
        if (g.act((s2 + 1) % g.n, { type: 'discard', tile: p2.hand[0] })) fail('a player acted out of turn')
      }
    } else if (ph === 'reaction') {
      const { tile, from } = g.lastDiscard!
      for (const s of g.pendingSeats()) { checkReaction(g, s, from, tile); illegalAttempts(g, s, from, tile) }
      for (const s of g.pendingSeats()) {
        if ((g.phase as string) !== 'reaction') break
        const r = g.reactions[s]
        let d: Decision = { type: 'pass' }
        const roll = Math.random()
        if (r.ron) d = { type: 'ron' }
        else if (roll < callBias && r.chi.length) d = { type: 'chi', use: rnd(r.chi) }
        else if (roll < callBias && r.minkan) d = { type: 'minkan' }
        else if (roll < callBias && r.pon) d = { type: 'pon' }
        if (!g.submitDecision(s, d)) fail(`legal decision rejected: ${JSON.stringify(d)}`)
      }
      // after the claim: the claimed meld must really contain the tile and be legal
      for (const p of g.players) for (const m of p.melds) {
        if (m.type === 'chi') {
          const ks = m.tiles.map(kindOf).sort((a, b) => a - b)
          if (!(ks[1] === ks[0] + 1 && ks[2] === ks[1] + 1) || new Set(ks.map(suitOf)).size !== 1) fail(`illegal chi meld on the table ${ks.join(',')}`)
        } else if (m.type === 'pon') { if (new Set(m.tiles.map(kindOf)).size !== 1 || m.tiles.length !== 3) fail('illegal pon meld') }
        else if (new Set(m.tiles.map(kindOf)).size !== 1 || m.tiles.length !== 4) fail(`illegal kan meld (${m.type})`)
      }
    } else if (ph === 'result') g.next()
  }
  if (guard >= 30000) fail(`${rule}: game did not finish`)
}

const N = Number(process.argv[2] ?? 80)
const rules: [RuleId, 3 | 4][] = [['taiwan', 4], ['hk', 4], ['hk', 3], ['riichi', 4], ['riichi', 3], ['mcr', 4], ['sichuan', 4]]
for (const [rule, pl] of rules) for (let i = 0; i < N; i++) playGame(rule, pl, i % 2 ? 0.9 : 0.3)
console.log(`checked ${checkedReactions} reactions (${ponOffered} pon, ${chiOffered} chi, ${kanOffered} kan offers), ${checkedTurns} turns, ${rejected} illegal attempts refused`)
console.log(bad ? `\n${bad} PROBLEMS` : '\nall call checks passed')
process.exit(bad ? 1 : 0)
