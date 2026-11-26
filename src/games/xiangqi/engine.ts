import { TurnGame, type GameMeta, type Outcome } from '../frame/base'
import { bestMove, ending, fromFen, inCheck, key, legal, play, startPos, text, toFen, type End, type Pos } from './rules'

/** Xiangqi (Chinese chess) for two: Red moves first; checkmate and stalemate both win; resigning is allowed; a position repeated three times is a draw. */
export const XQ_META: GameMeta = {
  kind: 'xiangqi',
  minPlayers: 2,
  maxPlayers: 2,
  variable: false,
  chipUnit: 500,
  fields: [
    {
      key: 'level',
      label: 'chLevel',
      options: [
        ['easy', 'chEasy'],
        ['normal', 'chNormal'],
        ['hard', 'chHard'],
      ],
    },
  ],
  defaults: { level: 'normal', ranked: false },
}
interface State {
  fen: string
  keys: string[]
  moves: string[]
  last: [number, number] | null
  red: number
  end: End | null
}

export class Xiangqi extends TurnGame {
  readonly meta = XQ_META
  private s: State = { fen: '', keys: [], moves: [], last: null, red: 0, end: null }
  private pos: Pos = startPos()
  constructor() {
    super()
    this.turnTimerMs = 300000
  }

  protected begin() {
    this.pos = startPos()
    this.s = { fen: toFen(this.pos), keys: [key(this.pos)], moves: [], last: null, red: (this.gameNo - 1) % 2, end: null }
  }
  turn() {
    return this.status === 'playing' && !this.s.end ? (this.pos.turn === 1 ? this.s.red : 1 - this.s.red) : -1
  }
  private apply(m: { from: number; to: number }) {
    const t = text(this.pos, m)
    this.pos = play(this.pos, m)
    this.s.fen = toFen(this.pos)
    this.s.keys.push(key(this.pos))
    this.s.moves.push(t)
    this.s.last = [m.from, m.to]
    let end = ending(this.pos, this.s.keys)
    if (!end.over && this.s.moves.length >= 500) end = { over: true, result: 'cap', winner: 0 }
    if (end.over) this.s.end = end
  }
  protected act(seat: number, m: any): string | null {
    if (m?.resign) {
      this.s.end = { over: true, result: 'resign', winner: seat === this.s.red ? -1 : 1 }
      return null
    }
    const from = Number(m?.from),
      to = Number(m?.to)
    const hit = legal(this.pos).find((x) => x.from === from && x.to === to)
    if (!hit) return 'bad_move'
    this.apply(hit)
    return null
  }
  protected bot(_seat: number) {
    const depth = this.config.level === 'easy' ? 1 : this.config.level === 'hard' ? 3 : 2
    const m = bestMove(this.pos, depth, this.config.level === 'easy' ? 120 : this.config.level === 'hard' ? 4 : 18)
    if (m) this.apply(m)
  }
  protected gameView(seat: number) {
    const mine = seat >= 0 && seat === this.turn()
    const targets: Record<number, number[]> = {}
    if (mine) for (const m of legal(this.pos)) (targets[m.from] ??= []).push(m.to)
    return {
      board: this.pos.b,
      red: this.s.red,
      color: seat < 0 ? 0 : seat === this.s.red ? 1 : -1,
      toMove: this.pos.turn,
      last: this.s.last,
      check: inCheck(this.pos) ? this.pos.b.indexOf(this.pos.turn) : -1,
      moves: this.s.moves,
      targets,
      end: this.s.end,
    }
  }
  protected outcome(): Outcome | null {
    const e = this.s.end
    if (!e || !e.over) return null
    const winner = e.winner === 0 ? -1 : e.winner === 1 ? this.s.red : 1 - this.s.red
    return { points: winner < 0 ? [0, 0] : winner === 0 ? [1, -1] : [-1, 1], winner, summary: { result: e.result, moves: this.s.moves.length } }
  }
  protected saveState() {
    return this.s
  }
  protected loadState(s: State) {
    this.s = s
    this.pos = fromFen(s.fen)
  }
}
