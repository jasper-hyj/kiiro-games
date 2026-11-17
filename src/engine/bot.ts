import type { Decision, Game, TurnAction } from './game'
import { shantenAll, toCounts, type Counts } from './hand'
import { doraFrom, isDragon, isHonor, isRedFive, isTermOrHonor, kindOf, numOf, suitOf } from './tiles'

export type BotLevel = 'easy' | 'normal' | 'hard'

const visibleCounts = (g: Game, seat: number): Counts => g.visibleCounts(seat)

const neighbours = (counts: Counts): number[] => {
  const s = new Set<number>()
  for (let k = 0; k < 34; k++) {
    if (!counts[k]) continue
    s.add(k)
    if (k < 27) for (const d of [-2, -1, 1, 2]) { const j = k + d; if (j >= 0 && j < 27 && suitOf(j) === suitOf(k)) s.add(j) }
  }
  return [...s]
}

function ukeire(g: Game, counts: Counts, melds: number, cur: number, vis: Counts): number {
  let n = 0
  for (const k of neighbours(counts)) {
    if (vis[k] >= 4) continue
    counts[k]++
    if (shantenAll(counts, melds, g.rule.nSets, g.rule.specials) < cur) n += 4 - vis[k]
    counts[k]--
  }
  return n
}

function keepValue(g: Game, seat: number, k: number, counts: Counts, dora?: Set<number>): number {
  if (dora?.has(k)) return 40 + (counts[k] >= 2 ? 20 : 0)
  const sw = 27 + g.seatWind(seat), rw = 27 + g.roundWind
  if (isHonor(k)) {
    const yaku = isDragon(k) || k === sw || k === rw
    if (counts[k] >= 2) return yaku ? 60 : 25
    return yaku ? 8 : 0
  }
  if (isTermOrHonor(k)) return 1
  const n = numOf(k)
  return n === 5 ? 4 : n === 2 || n === 8 ? 2 : 3
}

function danger(g: Game, k: number, threats: number[], vis: Counts, suji = false): number {
  let worst = 0
  for (const t of threats) {
    const safe = g.players[t].discards.some((d) => kindOf(d.tile) === k)
    if (safe) continue
    let d: number
    if (isHonor(k)) d = vis[k] >= 3 ? 0.5 : vis[k] === 2 ? 1.5 : 3
    else {
      d = isTermOrHonor(k) ? 3 : [2, 8].includes(numOf(k)) ? 4 : 5
      // suji: a tile 3 away from one the threat discarded cannot complete the ryanmen they gave up
      if (suji) {
        const n = numOf(k)
        const has = (m: number) => m >= 1 && m <= 9 && g.players[t].discards.some((x) => kindOf(x.tile) === k - n + m)
        if (has(n - 3) || has(n + 3)) d = Math.min(d, 2)
      }
    }
    worst = Math.max(worst, d)
  }
  return worst
}

export function chooseDiscard(g: Game, seat: number, ids: number[], level: BotLevel = 'normal'): { tile: number; shantenAfter: number } {
  if (!ids.length) return { tile: -1, shantenAfter: 9 }
  const p = g.players[seat]
  const counts = toCounts(p.hand.map(kindOf))
  const vis = visibleCounts(g, seat)
  const melds = p.melds.length
  const kinds = [...new Set(ids.map(kindOf))]
  const info = kinds.map((k) => {
    counts[k]--
    const sh = shantenAll(counts, melds, g.rule.nSets, g.rule.specials)
    counts[k]++
    return { k, sh }
  })
  const best = Math.min(...info.map((i) => i.sh))
  const threats = g.players.filter((q) => q.seat !== seat && q.riichi).map((q) => q.seat)
  const hard = level === 'hard'
  const doraSet = hard && g.isRiichi ? new Set(g.doraIndicators().map((i) => doraFrom(kindOf(i), g.sanma))) : undefined
  const redIds = new Set(hard && g.opts.aka ? p.hand.filter(isRedFive).map(kindOf) : [])
  const fold = threats.length > 0 && (best >= 2 || (best === 1 && (threats.length > 1 || hard)))
  let pool = info
  if (!fold) pool = info.filter((i) => i.sh === best)
  const scored = pool.map((i) => {
    counts[i.k]--
    const u = i.sh === best ? ukeire(g, counts, melds, i.sh, vis) : 0
    counts[i.k]++
    let score = u * 100 - keepValue(g, seat, i.k, counts, doraSet) * 10 - (hard && redIds.has(i.k) ? 300 : 0)
    if (threats.length) score -= danger(g, i.k, threats, vis, hard) * (fold ? 1000 : 25)
    return { ...i, score }
  })
  scored.sort((a, b) => b.score - a.score)
  const pick = scored[0] ?? { k: kindOf(ids[0]), sh: 9 }
  const cand = ids.filter((t) => kindOf(t) === pick.k)
  // keep red fives: discard the plain copy
  cand.sort((a, b) => b - a)
  return { tile: cand[0], shantenAfter: pick.sh }
}

/** Look at the tenpai hand left after discarding `tile`: how many winning tiles remain and what a win would be worth right now (no riichi). */
function tenpaiInfo(g: Game, seat: number, tile: number) {
  const p = g.players[seat]
  const saved = p.hand.slice(), savedDrawn = p.drawn
  p.hand.splice(p.hand.indexOf(tile), 1); p.drawn = null
  try {
    const vis = g.visibleCounts(seat)
    let left = 0, worth = 0, yaku = false
    for (const k of g.waitsFor(seat)) {
      left += Math.max(0, 4 - vis[k])
      const sc = g.checkWin(seat, false, k * 4 + 3)
      if (sc) { yaku = true; worth = Math.max(worth, sc.total) }
    }
    return { left, worth, yaku }
  } finally { p.hand = saved; p.drawn = savedDrawn }
}

/** Hard bots do not riichi blindly: declare when the hand needs it for a yaku, or the wait is good and the hand is cheap; stay quiet (dama) with a big hand or a bad wait. */
function wantsRiichi(g: Game, seat: number, tile: number): boolean {
  const { left, worth, yaku } = tenpaiInfo(g, seat, tile)
  if (left === 0) return false
  if (!yaku) return true
  if (worth >= 5) return false
  return left >= 3
}

export function botTurn(g: Game, seat: number, level: BotLevel = 'normal'): TurnAction {
  const p = g.players[seat]
  const o = g.turnOptions(seat)
  if (o.tsumo) return { type: 'tsumo' }
  if (o.nuki) return { type: 'nuki' }
  if (p.riichi) return { type: 'discard', tile: o.discard[0] }
  if (level === 'easy' && Math.random() < 0.3) return { type: 'discard', tile: o.discard[Math.floor(Math.random() * o.discard.length)] }
  if (!g.afterCall) {
    const cur = g.shanten(seat)
    for (const k of o.ankan) {
      const rest = p.hand.filter((i) => kindOf(i) !== k)
      const sh = shantenAll(toCounts(rest.map(kindOf)), p.melds.length + 1, g.rule.nSets, g.rule.specials)
      if (sh <= cur - 0 && g.players.every((q) => !q.riichi || q.seat === seat)) return { type: 'ankan', kind: k }
    }
    if (o.kakan.length && g.players.every((q) => !q.riichi || q.seat === seat)) return { type: 'kakan', tile: o.kakan[0] }
  }
  const { tile, shantenAfter } = chooseDiscard(g, seat, o.discard, level)
  let riichi = o.riichi.includes(tile) && shantenAfter === 0
  if (riichi && level === 'hard') riichi = wantsRiichi(g, seat, tile)
  return { type: 'discard', tile, riichi }
}

function callAllowed(g: Game, seat: number, kind: number, remaining: Counts, meldsAfter: Game['players'][0]['melds']): boolean {
  const sw = 27 + g.seatWind(seat), rw = 27 + g.roundWind
  const yakuhai = isDragon(kind) || kind === sw || kind === rw
  if (g.rule.id === 'taiwan') return true
  if (yakuhai && meldsAfter.some((m) => m.type === 'pon' && kindOf(m.tiles[0]) === kind)) return true
  const all = remaining.slice()
  for (const m of meldsAfter) for (const t of m.tiles) all[kindOf(t)]++
  const total = all.reduce((a, b) => a + b, 0)
  const suits = [0, 0, 0, 0]
  all.forEach((v, k) => (suits[suitOf(k)] += v))
  const flush = Math.max(suits[0], suits[1], suits[2]) + suits[3] >= total - 1
  if (flush) return true
  if (g.rule.id === 'riichi') return all.every((v, k) => v === 0 || (!isTermOrHonor(k)))
  return false
}

export function botReact(g: Game, seat: number, level: BotLevel = 'normal'): Decision {
  const r = g.reactions[seat]
  if (r.ron) return { type: 'ron' }
  if (level === 'easy' && Math.random() < 0.5) return { type: 'pass' }
  const p = g.players[seat]
  if (p.riichi) return { type: 'pass' }
  if (g.players.some((q) => q.seat !== seat && q.riichi)) return { type: 'pass' }
  const tile = g.lastDiscard!.tile
  const k = kindOf(tile)
  const counts = toCounts(p.hand.map(kindOf))
  const cur = g.shanten(seat)
  const bestAfter = (rem: Counts, melds: number) => {
    let b = 99
    for (let i = 0; i < 34; i++) {
      if (!rem[i]) continue
      rem[i]--
      b = Math.min(b, shantenAll(rem, melds, g.rule.nSets, g.rule.specials))
      rem[i]++
    }
    return b
  }
  let best: { d: Decision; sh: number } | null = null
  const consider = (d: Decision, used: number[]) => {
    const rem = counts.slice()
    for (const u of used) rem[kindOf(u)]--
    const meldsAfter = [...p.melds, { type: d.type === 'chi' ? 'chi' : 'pon', tiles: [tile, ...used], from: g.lastDiscard!.from } as Game['players'][0]['melds'][0]]
    const sh = bestAfter(rem, p.melds.length + 1)
    const isPon = d.type === 'pon'
    const sw = 27 + g.seatWind(seat), rw = 27 + g.roundWind
    const yakuhai = isPon && (isDragon(k) || k === sw || k === rw)
    if (!(sh < cur || (yakuhai && sh <= cur))) return
    if (!callAllowed(g, seat, k, rem, meldsAfter)) return
    if (!best || sh < best.sh) best = { d, sh }
  }
  if (r.pon) consider({ type: 'pon' }, p.hand.filter((i) => kindOf(i) === k).slice(0, 2))
  for (const c of r.chi) consider({ type: 'chi', use: c }, [...c])
  return best ? (best as { d: Decision }).d : { type: 'pass' }
}
