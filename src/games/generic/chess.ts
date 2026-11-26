import { TurnGame, type GameMeta, type Outcome } from './base'
import { bestMove, ending, fromFen, inCheck, key, legal, name, parseSq, play, san, startPos, toFen, type End, type Pos } from './chessrules'

/** Chess for two: standard rules (castling, en passant, promotion, mate, stalemate, insufficient material, fifty moves, threefold repetition). Resigning is allowed. */
export const CHESS_META: GameMeta = {
  kind: 'chess',
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
const PROMO: Record<string, number> = { n: 2, b: 3, r: 4, q: 5 }

interface State {
  fen: string
  keys: string[]
  moves: string[]
  last: [number, number] | null
  white: number
  end: End | null
  resigned: number
}

export class Chess extends TurnGame {
  readonly meta = CHESS_META
  private s: State = { fen: '', keys: [], moves: [], last: null, white: 0, end: null, resigned: -1 }
  private pos: Pos = startPos()
  constructor() {
    super()
    this.turnTimerMs = 300000
  }

  protected begin() {
    this.pos = startPos()
    this.s = { fen: toFen(this.pos), keys: [key(this.pos)], moves: [], last: null, white: (this.gameNo - 1) % 2, end: null, resigned: -1 }
  }
  turn() {
    return this.status === 'playing' && !this.s.end ? (this.pos.turn === 1 ? this.s.white : 1 - this.s.white) : -1
  }
  private apply(m: ReturnType<typeof legal>[number]) {
    const text = san(this.pos, m)
    this.pos = play(this.pos, m)
    this.s.fen = toFen(this.pos)
    this.s.keys.push(key(this.pos))
    this.s.moves.push(text)
    this.s.last = [m.from, m.to]
    let end = ending(this.pos, this.s.keys)
    if (!end.over && this.s.moves.length >= 400) end = { over: true, result: 'cap', winner: 0 } // a game nobody can finish
    if (end.over) this.s.end = end
  }
  protected act(seat: number, m: any): string | null {
    if (m?.resign) {
      this.s.resigned = seat
      this.s.end = { over: true, result: 'resign', winner: seat === this.s.white ? -1 : 1 }
      return null
    }
    const from = parseSq(String(m?.from)),
      to = parseSq(String(m?.to))
    const cands = legal(this.pos).filter((x) => x.from === from && x.to === to)
    if (!cands.length) return 'bad_move'
    let pick = cands[0]
    if (cands.some((x) => x.promo)) {
      const want = PROMO[String(m?.promo)]
      if (!want) return 'choose_promotion'
      pick = cands.find((x) => x.promo === want) ?? cands[0]
    }
    this.apply(pick)
    return null
  }
  protected bot(seat: number) {
    void seat
    const depth = this.config.level === 'easy' ? 1 : this.config.level === 'hard' ? 3 : 2
    const m = bestMove(this.pos, depth, this.config.level === 'easy' ? 90 : this.config.level === 'hard' ? 3 : 14)
    if (m) this.apply(m)
  }

  protected gameView(seat: number) {
    const mine = seat >= 0 && seat === this.turn()
    const targets: Record<string, string[]> = {}
    if (mine) for (const m of legal(this.pos)) (targets[name(m.from)] ??= []).includes(name(m.to)) || targets[name(m.from)].push(name(m.to))
    const promos = mine
      ? [
          ...new Set(
            legal(this.pos)
              .filter((m) => m.promo)
              .map((m) => `${name(m.from)}${name(m.to)}`),
          ),
        ]
      : []
    return {
      board: this.pos.b,
      white: this.s.white,
      color: seat < 0 ? 0 : seat === this.s.white ? 1 : -1,
      toMove: this.pos.turn,
      last: this.s.last,
      check: inCheck(this.pos) ? this.pos.b.indexOf(6 * this.pos.turn) : -1,
      moves: this.s.moves,
      targets,
      promos,
      end: this.s.end,
    }
  }
  protected outcome(): Outcome | null {
    const e = this.s.end
    if (!e || !e.over) return null
    const winner = e.winner === 0 ? -1 : e.winner === 1 ? this.s.white : 1 - this.s.white
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
