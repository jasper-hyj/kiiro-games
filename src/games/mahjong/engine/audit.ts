import type { Game } from './game'
import { kindOf, numOf, suitOf, isFlowerId } from './tiles'

/** A second, independent look at the whole game state. Runs after every move; any message it returns means a rule was broken. */
export function auditGame(g: Game): string[] {
  const errs: string[] = []
  const e = (m: string) => { if (errs.length < 12) errs.push(m) }

  // 1. every tile exists exactly once
  const ids: number[] = [...g.wall, ...g.dead, ...g.doraPool, ...g.uraPool]
  for (const p of g.players) {
    ids.push(...p.hand, ...p.flowers, ...p.nuki)
    for (const m of p.melds) ids.push(...m.tiles)
    for (const d of p.discards) if (!d.called) ids.push(d.tile)
  }
  const expected = g.sichuan ? 108 : g.rule.flowers ? (g.sanma ? 116 : 144) : g.sanma ? 108 : 136
  if (g.phase !== 'over') {
    if (new Set(ids).size !== ids.length) e('a tile appears twice')
    if (ids.length !== expected) e(`tile count ${ids.length} (expected ${expected})`)
    if (ids.some((i) => !Number.isInteger(i) || i < 0 || i >= 144)) e('an invalid tile id')
  }
  if (g.wall.length < 0) e('negative wall')

  // 2. hand sizes: the player to move holds one extra tile; nobody else does
  if (g.phase === 'turn' || g.phase === 'reaction' || g.phase === 'result') {
    for (const p of g.players) {
      const base = g.rule.handSize - 3 * p.melds.length
      const diff = p.hand.length - base
      const mover = g.phase === 'turn' && g.turn === p.seat && !p.out
      if (p.out) { if (Math.abs(diff) > 1) e(`seat ${p.seat} (already won) holds ${p.hand.length} tiles`); continue } // winners keep their hand (a shared winning tile may not be in it)
      if (g.phase === 'turn' && mover && diff !== 1) e(`seat ${p.seat} is on turn with hand size ${p.hand.length} and ${p.melds.length} melds`)
      if (g.phase === 'turn' && !mover && diff !== 0 && !(p.out && diff === 1)) e(`seat ${p.seat} holds ${p.hand.length} tiles with ${p.melds.length} melds`)
      const kanMaker = g.phase === 'reaction' && g.reactionKind === 'chankan' && g.lastDiscard?.from === p.seat // still holds the tile it is adding to its pon
      if (g.phase === 'reaction' && diff !== (kanMaker ? 1 : 0)) e(`seat ${p.seat} holds ${p.hand.length} tiles during a reaction`)
      if (p.drawn !== null && !p.hand.includes(p.drawn)) e(`seat ${p.seat}: drawn tile is not in the hand`)
    }
  }

  // 3. melds are legal
  for (const p of g.players) {
    for (const m of p.melds) {
      const ks = m.tiles.map(kindOf)
      if (m.type === 'chi') {
        const s = [...ks].sort((a, b) => a - b)
        if (m.tiles.length !== 3 || s[0] >= 27 || suitOf(s[0]) !== suitOf(s[2]) || s[1] !== s[0] + 1 || s[2] !== s[1] + 1) e(`seat ${p.seat} has an illegal chi`)
        if ((g.sanma && g.isRiichi) || g.sichuan) e('chi in a ruleset without chi')
      } else if (m.type === 'pon') {
        if (m.tiles.length !== 3 || new Set(ks).size !== 1) e(`seat ${p.seat} has an illegal pon`)
      } else if (m.tiles.length !== 4 || new Set(ks).size !== 1) e(`seat ${p.seat} has an illegal kan (${m.type})`)
      if (m.tiles.some(isFlowerId)) e('a flower inside a meld')
    }
    if (p.hand.some(isFlowerId)) e(`seat ${p.seat} holds a flower in the hand`)
    if (p.riichi && !p.melds.every((m) => m.type === 'ankan')) e(`seat ${p.seat} declared riichi with an open meld`)
    if (p.hand.length > g.rule.handSize + 1) e(`seat ${p.seat} holds ${p.hand.length} tiles`)
  }

  // 4. points are conserved
  const start = g.sanma && g.isRiichi ? 35000 : g.rule.startPoints
  const sum = g.players.reduce((a, p) => a + p.points, 0) + g.sticks * 1000
  if (sum !== start * g.n) e(`points not conserved (${sum} vs ${start * g.n})`)
  if (g.players.some((p) => !Number.isInteger(p.points))) e('non-integer points')

  // 5. turn / reaction bookkeeping
  if (g.phase === 'turn') {
    if (!g.players[g.turn]) e('turn belongs to nobody')
    else if (g.players[g.turn].out) e('the turn belongs to a player who has already won')
  }
  if (g.phase === 'reaction') {
    const from = g.lastDiscard?.from
    if (from === undefined) e('reaction without a discard')
    else for (const s of Object.keys(g.reactions).map(Number)) if (s === from) e('reaction offered to the discarder')
    if (!Object.keys(g.reactions).length) e('reaction with nobody to react')
  }
  if (g.isRiichi && g.doraCount > 5) e('more than five dora indicators')

  // 6. Sichuan: the given-up suit
  if (g.sichuan && g.phase !== 'swap' && g.phase !== 'void') {
    for (const p of g.players) {
      if (p.voidSuit === null) e(`seat ${p.seat} never chose a suit to give up`)
      else if (p.out && [...p.hand, ...p.melds.flatMap((m) => m.tiles)].some((i) => suitOf(kindOf(i)) === p.voidSuit)) e(`seat ${p.seat} won while holding the given-up suit`)
    }
    if (g.sc.wins.length > 3) e('more than three winners')
  }
  void numOf
  return errs
}
