import type { TableView, PlayerView } from '../engine/table'
import type { Meld } from '../engine/game'

/** Fabricated worst-case table for layout testing: ?stress=full (max tiles) | min (empty ponds) | call (full + every action button). */
export function stressView(mode: string, players = 4, rule = 'taiwan'): TableView {
  const jp = rule === 'riichi'
  const full = mode !== 'min'
  const call = mode === 'call'
  let k = 0
  const id = () => { const v = (k * 7 + 3) % 136; k++; return v } // spread of valid tile ids
  const flowers = (n: number) => Array.from({ length: n }, (_, i) => 136 + i)
  const discards = (n: number) => Array.from({ length: n }, (_, i) => ({ tile: id(), riichi: i === 6, called: i % 9 === 4 }))
  const meldSet = (): Meld[] => {
    const t = (n: number) => Array.from({ length: n }, id)
    const c = t(3)
    return [
      { type: 'chi', tiles: c, from: 3, called: c[0] },
      { type: 'pon', tiles: t(3), from: 2, called: 0 },
      { type: 'minkan', tiles: t(4), from: 1, called: 0 },
      { type: 'ankan', tiles: t(4), from: 0 },
      { type: 'kakan', tiles: t(4), from: 2, called: 0 },
    ].map((m) => ({ ...m, called: m.called === 0 ? m.tiles[0] : m.called })) as Meld[]
  }
  const mk = (seat: number): PlayerView => {
    const me = seat === 0
    const ms = full ? meldSet().slice(0, me ? 4 : 5) : []
    const handCount = full ? 16 - ms.length * 3 : 16
    return {
      seat, name: ['Player', 'Bot 1', 'Bot 2', 'Bot 3'][seat], points: 1000 + seat * 137, human: me, connected: true,
      handCount, hand: me ? Array.from({ length: handCount }, id).sort((a, b) => (a >> 2) - (b >> 2)) : null, drawn: me ? id() : null,
      melds: ms, discards: full ? discards(24) : [], flowers: full ? flowers(me ? 4 : 3) : [], riichi: seat === 2, seatWind: seat, nuki: [],
    }
  }
  const ps = Array.from({ length: players }, (_, s) => mk(s))
  const lp = ps[ps.length - 1]
  const last = lp.discards.length ? { tile: lp.discards[lp.discards.length - 1].tile, from: lp.seat } : null
  return {
    status: 'playing',
    config: { rule: jp ? 'riichi' : 'taiwan', aka: true, rounds: 1, minFan: 3, players: players as 3 | 4, botLevel: 'normal' },
    seats: ps.map((p) => ({ name: p.name, human: p.seat === 0, connected: true, bot: false })),
    you: 0, host: true,
    game: {
      phase: call ? 'reaction' : 'turn', turn: 0, dealer: 0, roundIndex: 0, roundWind: 0, honba: jp ? 2 : 0, sticks: jp ? 3 : 0, lian: 3,
      wallLeft: full ? 14 : 62, dora: jp ? [8 * 4, 14 * 4 + 1, 30 * 4 + 2, 22 * 4, 3 * 4].slice(0, full ? 5 : 1) : [], handNo: 9, players: ps, lastDiscard: last,
      turnOptions: call ? null : { tsumo: true, discard: ps[0].hand!.concat(ps[0].drawn!), riichi: [], ankan: [4, 5], kakan: [1], nuki: false, abort: false },
      reaction: call ? { ron: true, pon: true, minkan: true, chi: [[0, 4], [4, 12], [12, 16]] } : null,
      reactionKind: 'discard', waiting: [], timeLeft: 22000, result: null, acks: [],
      standings: ps.map((p) => ({ seat: p.seat, name: p.name, points: p.points })),
      hint: full ? { shanten: 0, waits: [1, 4, 7, 10, 13], discardWaits: {}, left: { 1: 2, 4: 0, 7: 3, 10: 1, 13: 2 }, values: { 1: { total: 6 }, 4: { total: 4 }, 7: { total: 8 }, 10: null, 13: { total: 3 } }, furiten: false } : null,
      history: [], chat: [{ n: 1, seat: 2, key: 'hello', ago: 100 }, { n: 2, seat: 1, key: 'e1', ago: 100 }, { n: 3, seat: 3, key: 'nice', ago: 100 }],
      log: [], rule: jp ? { id: 'riichi', name: 'Japanese Riichi', nSets: 4 } : { id: 'taiwan', name: 'Taiwanese', nSets: 5 },
    },
  }
}
