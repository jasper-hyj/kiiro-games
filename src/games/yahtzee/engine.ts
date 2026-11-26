import { TurnGame, type GameMeta, type Outcome } from '../frame/base'

/**
 * Yahtzee, 1 to 4 players (alone it is a high-score game). 13 rounds: roll five dice up to three times, keeping any you like, then write the
 * result in one of 13 boxes. Upper boxes (ones to sixes) earn a 35 bonus at 63 or more; a second Yahtzee scores a 100 bonus and may fill
 * the full house and the straights at full value (the "joker").
 */
export const YAHTZEE_META: GameMeta = {
  kind: 'yahtzee',
  minPlayers: 1,
  maxPlayers: 4,
  variable: true,
  chipUnit: 5,
  fields: [
    {
      key: 'players',
      label: 'yzPlayers',
      options: [
        [1, '1'],
        [2, '2'],
        [3, '3'],
        [4, '4'],
      ],
    },
  ],
  defaults: { players: 2, ranked: false },
}
export const CATS = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 'three', 'four', 'house', 'small', 'large', 'yahtzee', 'chance'] as const
export type Cat = (typeof CATS)[number]
const EXPECT: Record<Cat, number> = {
  ones: 2.1,
  twos: 4.2,
  threes: 6.3,
  fours: 8.4,
  fives: 10.5,
  sixes: 12.6,
  three: 21,
  four: 13,
  house: 22,
  small: 29,
  large: 32,
  yahtzee: 16,
  chance: 22,
}

const counts = (d: number[]) => {
  const c = [0, 0, 0, 0, 0, 0, 0]
  for (const x of d) c[x]++
  return c
}
const sum = (d: number[]) => d.reduce((a, b) => a + b, 0)
const has = (d: number[], run: number) => {
  const u = new Set(d)
  for (let lo = 1; lo <= 7 - run; lo++) if (Array.from({ length: run }, (_, i) => lo + i).every((x) => u.has(x))) return true
  return false
}
/** what these five dice would score in a box; `joker` lets a repeat Yahtzee fill the fixed-value boxes at full value */
export function scoreFor(cat: Cat, d: number[], joker = false): number {
  const c = counts(d),
    top = Math.max(...c)
  switch (cat) {
    case 'ones':
    case 'twos':
    case 'threes':
    case 'fours':
    case 'fives':
    case 'sixes': {
      const f = CATS.indexOf(cat) + 1
      return c[f] * f
    }
    case 'three':
      return top >= 3 ? sum(d) : 0
    case 'four':
      return top >= 4 ? sum(d) : 0
    case 'house':
      return joker || (c.includes(3) && c.includes(2)) ? 25 : 0
    case 'small':
      return joker || has(d, 4) ? 30 : 0
    case 'large':
      return joker || has(d, 5) ? 40 : 0
    case 'yahtzee':
      return top === 5 ? 50 : 0
    case 'chance':
      return sum(d)
  }
}
interface State {
  dice: number[]
  rolls: number
  turn: number
  round: number
  sheets: (number | null)[][]
  bonus: number[]
  last: { seat: number; cat: Cat; points: number } | null
}

export class Yahtzee extends TurnGame {
  readonly meta = YAHTZEE_META
  private s: State = { dice: [], rolls: 0, turn: 0, round: 1, sheets: [], bonus: [], last: null }
  private get n() {
    return this.seats.length
  }

  protected begin() {
    this.s = {
      dice: [],
      rolls: 0,
      turn: 0,
      round: 1,
      sheets: Array.from({ length: this.n }, () => CATS.map(() => null)),
      bonus: Array(this.n).fill(0),
      last: null,
    }
  }
  turn() {
    return this.status === 'playing' && !this.finished() ? this.s.turn : -1
  }
  private finished() {
    return this.s.round > 13
  }
  private roll(held?: boolean[]) {
    const d = this.s.dice.length === 5 ? [...this.s.dice] : [0, 0, 0, 0, 0]
    for (let i = 0; i < 5; i++) if (this.s.dice.length !== 5 || !held?.[i]) d[i] = 1 + Math.floor(Math.random() * 6)
    this.s.dice = d
    this.s.rolls++
  }
  /** a second Yahtzee while the Yahtzee box already holds 50 */
  private joker(seat: number) {
    return scoreFor('yahtzee', this.s.dice) === 50 && this.s.sheets[seat][CATS.indexOf('yahtzee')] === 50
  }
  protected act(seat: number, m: any): string | null {
    const s = this.s
    if (m?.roll) {
      if (s.rolls >= 3) return 'no_rolls_left'
      this.roll(Array.isArray(m.held) ? m.held.map(Boolean) : undefined)
      return null
    }
    if (typeof m?.score === 'string') {
      const cat = m.score as Cat
      const idx = CATS.indexOf(cat)
      if (idx < 0 || s.rolls === 0) return s.rolls === 0 ? 'roll_first' : 'bad_move'
      if (s.sheets[seat][idx] !== null) return 'box_taken'
      const jok = this.joker(seat)
      const pts = scoreFor(cat, s.dice, jok)
      if (jok) s.bonus[seat] += 100
      s.sheets[seat][idx] = pts
      s.last = { seat, cat, points: pts }
      s.dice = []
      s.rolls = 0
      s.turn = (s.turn + 1) % this.n
      if (s.turn === 0) s.round++
      return null
    }
    return 'bad_move'
  }

  protected bot(seat: number) {
    const s = this.s
    if (s.rolls === 0) {
      this.act(seat, { roll: true })
      return
    }
    const jok = this.joker(seat)
    const open = CATS.filter((_, i) => s.sheets[seat][i] === null)
    const best = (): { cat: Cat; gain: number } =>
      open.map((cat) => ({ cat, gain: scoreFor(cat, s.dice, jok) - EXPECT[cat] * (cat === 'yahtzee' ? 1 : 0.85) })).sort((a, b) => b.gain - a.gain)[0]
    const b = best()
    const done =
      s.rolls >= 3 ||
      scoreFor('yahtzee', s.dice) === 50 ||
      (scoreFor('large', s.dice) === 40 && open.includes('large')) ||
      (scoreFor('house', s.dice) === 25 && open.includes('house') && b.gain > 6 && s.rolls >= 2)
    if (done || b.gain > 14) {
      this.act(seat, { score: b.cat })
      return
    }
    // keep the most common value (the higher one on a tie); with a straight draw keep its run
    const c = counts(s.dice)
    const run = open.includes('large') || open.includes('small') ? [1, 2, 3, 4, 5, 6].filter((x) => c[x] > 0) : []
    let keep: number[] | null = null
    for (const lo of [1, 2, 3]) {
      const want = [lo, lo + 1, lo + 2, lo + 3]
      if (want.every((x) => run.includes(x))) {
        keep = want
        break
      }
    }
    const top = Math.max(...c)
    if (!keep || top >= 3) {
      const face = [6, 5, 4, 3, 2, 1].sort((a, b2) => c[b2] - c[a] || b2 - a)[0]
      keep = [face]
    }
    const seen = new Set<number>()
    const held = s.dice.map((d) => {
      if (!keep!.includes(d)) return false
      if (keep!.length > 1) {
        if (seen.has(d)) return false
        seen.add(d)
      }
      return true
    })
    this.act(seat, { roll: true, held })
  }

  private totals(seat: number) {
    const sh = this.s.sheets[seat]
    const upper = sh.slice(0, 6).reduce<number>((a, x) => a + (x ?? 0), 0)
    const lower = sh.slice(6).reduce<number>((a, x) => a + (x ?? 0), 0)
    const bonus = upper >= 63 ? 35 : 0
    return { upper, bonus, yahtzeeBonus: this.s.bonus[seat], total: upper + bonus + lower + this.s.bonus[seat] }
  }
  protected gameView(seat: number) {
    const s = this.s
    const mine = seat >= 0 && seat === s.turn && s.rolls > 0
    const jok = mine && this.joker(seat)
    const options: Record<string, number> = {}
    if (mine)
      CATS.forEach((c, i) => {
        if (s.sheets[seat][i] === null) options[c] = scoreFor(c, s.dice, jok)
      })
    return {
      dice: s.dice,
      rolls: s.rolls,
      round: Math.min(s.round, 13),
      sheets: s.sheets,
      totals: s.sheets.map((_, i) => this.totals(i)),
      options,
      last: s.last,
      joker: jok,
    }
  }
  protected outcome(): Outcome | null {
    if (!this.finished()) return null
    const tot = this.s.sheets.map((_, i) => this.totals(i).total)
    const mean = tot.reduce((a, b) => a + b, 0) / tot.length
    const winner = tot.indexOf(Math.max(...tot))
    return { points: this.n === 1 ? [tot[0]] : tot.map((x) => x - mean), winner, summary: tot }
  }
  protected saveState() {
    return this.s
  }
  protected loadState(s: State) {
    this.s = s
  }
}
