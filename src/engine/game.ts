import { RULESETS, type RuleId, type RuleSet } from './rules'
import type { GameOptions, HandScore, MeldInfo, WinContext } from './rules/types'
import { hkValue } from './rules/hongkong'
import { TW_BASE, TW_PER_TAI } from './rules/taiwan'
import { doraFrom, freshWall, isFlowerId, isRedFive, kindOf, sortIds, suitOf, numOf } from './tiles'
import { isComplete, shantenAll, toCounts, waitsOf, type Counts } from './hand'

export type Meld = MeldInfo & { called?: number }
export interface Discard { tile: number; riichi: boolean; called: boolean }
export interface Player {
  seat: number; name: string; points: number
  hand: number[]; drawn: number | null
  melds: Meld[]; discards: Discard[]; flowers: number[]
  riichi: boolean; doubleRiichi: boolean; ippatsu: boolean; riichiPending: boolean; nuki: number[]
  tempFuriten: boolean; permFuriten: boolean
}
export type Decision =
  | { type: 'pass' } | { type: 'ron' } | { type: 'pon' } | { type: 'minkan' }
  | { type: 'chi'; use: [number, number] }
export type TurnAction =
  | { type: 'tsumo' } | { type: 'discard'; tile: number; riichi?: boolean }
  | { type: 'ankan'; kind: number } | { type: 'kakan'; tile: number } | { type: 'nuki' }
export interface ReactionOptions { ron: boolean; pon: boolean; minkan: boolean; chi: [number, number][] }
export interface TurnOptions {
  tsumo: boolean; discard: number[]; riichi: number[]; ankan: number[]; kakan: number[]; nuki: boolean
}
export type Phase = 'turn' | 'reaction' | 'result' | 'over'
export interface HandResult {
  kind: 'win' | 'draw'
  winner?: number; from?: number | null; tsumo?: boolean; score?: HandScore; winTile?: number
  deltas: number[]; sticksWon?: number; tenpai?: boolean[]
  hands: { hand: number[]; melds: Meld[]; flowers: number[] }[]
  ura?: number[]; dealerBefore: number; label?: string
  /** additional winners when several players ron the same discard (Taiwanese) */
  others?: { winner: number; score: HandScore; hand: { hand: number[]; melds: Meld[]; flowers: number[] } }[]
}

export const WIND_NAMES = ['East', 'South', 'West', 'North']

export class Game {
  rule: RuleSet
  opts: GameOptions
  n: number
  sanma: boolean
  players: Player[] = []
  wall: number[] = []
  dead: number[] = []
  doraPool: number[] = []
  uraPool: number[] = []
  doraCount = 1
  dealer = 0
  roundIndex = 0
  honba = 0
  sticks = 0
  lian = 0
  turn = 0
  phase: Phase = 'turn'
  reactionKind: 'discard' | 'chankan' = 'discard'
  lastDiscard: { tile: number; from: number } | null = null
  reactions: Record<number, ReactionOptions> = {}
  decisions: Record<number, Decision> = {}
  result: HandResult | null = null
  log: string[] = []
  kanCount = 0
  anyCall = false
  rinshan = false
  afterCall = false
  handNo = 0
  private pendingKakan: { seat: number; tile: number } | null = null
  private pendingOver = false

  constructor(ruleId: RuleId, opts: GameOptions, names: string[]) {
    this.rule = RULESETS[ruleId]
    this.opts = opts
    this.n = names.length
    this.sanma = this.n === 3 && ruleId === 'riichi'
    this.players = names.map((name, seat) => ({
      seat, name, points: this.sanma ? 35000 : this.rule.startPoints, hand: [], drawn: null, melds: [], discards: [], flowers: [],
      riichi: false, doubleRiichi: false, ippatsu: false, riichiPending: false, nuki: [], tempFuriten: false, permFuriten: false,
    }))
    this.startHand()
  }

  // ---------- helpers ----------
  get roundWind() { return Math.min(3, Math.floor(this.roundIndex / this.n)) }
  seatWind(seat: number) { return (seat - this.dealer + this.n) % this.n }
  say(m: string) { this.log.push(m); if (this.log.length > 60) this.log.shift() }
  get isRiichi() { return this.rule.id === 'riichi' }
  doraIndicators() { return this.isRiichi ? this.doraPool.slice(0, this.doraCount) : [] }
  isClosed(p: Player) { return p.melds.every((m) => m.type === 'ankan') }
  handCounts(p: Player): Counts { return toCounts(p.hand.map(kindOf)) }

  // ---------- hand setup ----------
  startHand() {
    this.handNo++
    this.wall = freshWall(this.rule.flowers, this.sanma)
    this.dead = this.wall.splice(0, this.rule.deadWall)
    if (this.isRiichi) {
      this.doraPool = this.dead.splice(0, 5)
      this.uraPool = this.dead.splice(0, 5)
    } else { this.doraPool = []; this.uraPool = [] }
    this.doraCount = 1
    this.kanCount = 0; this.anyCall = false; this.rinshan = false; this.afterCall = false
    this.result = null; this.reactions = {}; this.decisions = {}; this.lastDiscard = null; this.pendingKakan = null
    for (const p of this.players) {
      Object.assign(p, { hand: [], drawn: null, melds: [], discards: [], flowers: [], nuki: [], riichi: false, doubleRiichi: false, ippatsu: false, riichiPending: false, tempFuriten: false, permFuriten: false })
    }
    for (const p of this.players) for (let i = 0; i < this.rule.handSize; i++) p.hand.push(this.wall.pop()!)
    if (this.rule.flowers) {
      for (let i = 0; i < this.n; i++) {
        const p = this.players[(this.dealer + i) % this.n]
        let again = true
        while (again) {
          again = false
          for (const id of p.hand.filter(isFlowerId)) {
            p.hand.splice(p.hand.indexOf(id), 1)
            p.flowers.push(id)
            p.hand.push(this.drawReplacement())
            again = true
          }
        }
      }
    }
    for (const p of this.players) sortIds(p.hand)
    this.say(`— ${WIND_NAMES[this.roundWind]} ${(this.roundIndex % this.n) + 1}${this.honba ? ` · ${this.honba} honba` : ''} —`)
    this.beginTurn(this.dealer, false)
  }

  private drawReplacement(): number {
    let t: number
    if (this.dead.length > 0) {
      t = this.dead.shift()!
      if (this.wall.length > 0) this.dead.push(this.wall.pop()!)
    } else t = this.wall.pop()!
    return t
  }

  private beginTurn(seat: number, fromKan: boolean) {
    const p = this.players[seat]
    if (!fromKan && this.wall.length === 0) return this.exhaustiveDraw()
    let t = fromKan ? this.drawReplacement() : this.wall.pop()!
    while (isFlowerId(t)) {
      p.flowers.push(t)
      this.say(`${p.name} reveals a flower`)
      if (p.flowers.length === 8) return this.flowerWin(seat)
      t = this.drawReplacement()
    }
    p.hand.push(t)
    p.drawn = t
    this.turn = seat
    this.rinshan = fromKan
    this.afterCall = false
    this.phase = 'turn'
  }

  // ---------- win evaluation ----------
  buildContext(seat: number, tsumo: boolean, tile?: number, chankan = false): WinContext {
    const p = this.players[seat]
    const ids = tile !== undefined && !tsumo ? [...p.hand, tile] : p.hand.slice()
    const kinds = ids.map(kindOf)
    const counts = toCounts(kinds)
    const meldIds = p.melds.flatMap((m) => m.tiles)
    const allIds = [...ids, ...meldIds]
    const allKinds = toCounts(allIds.map(kindOf))
    const winKind = tsumo ? kindOf(p.drawn!) : kindOf(tile!)
    let dora = 0, ura = 0, aka = 0
    if (this.isRiichi) {
      const dk = this.doraPool.slice(0, this.doraCount).map((i) => doraFrom(kindOf(i), this.sanma))
      for (const k of dk) dora += allKinds[k]
      if (p.riichi) for (const k of this.uraPool.slice(0, this.doraCount).map((i) => doraFrom(kindOf(i), this.sanma))) ura += allKinds[k]
      if (this.opts.aka) aka = allIds.filter(isRedFive).length
    }
    let waitCount = 0
    if (this.rule.id === 'taiwan') {
      const c = counts.slice(); c[winKind]--
      waitCount = waitsOf(c, this.rule.specials).length
    }
    return {
      counts, melds: p.melds, allKinds, allIds, winKind, tsumo,
      seatWind: this.seatWind(seat), roundWind: this.roundWind, dealer: seat === this.dealer,
      flowers: p.flowers.map(kindOf),
      riichi: p.riichi, doubleRiichi: p.doubleRiichi, ippatsu: p.ippatsu,
      lastTile: this.wall.length === 0, rinshan: tsumo && this.rinshan, chankan,
      firstTurn: tsumo && !this.anyCall && p.discards.length === 0,
      dora, ura, aka, nuki: this.players[seat].nuki.length, lianZhuang: this.lian, waitCount, options: this.opts,
    }
  }

  checkWin(seat: number, tsumo: boolean, tile?: number, chankan = false): HandScore | null {
    const p = this.players[seat]
    const ctx = this.buildContext(seat, tsumo, tile, chankan)
    const sp = p.melds.length === 0 ? this.rule.specials : {}
    if (!isComplete(ctx.counts, sp)) return null
    return this.rule.evaluate(ctx)
  }

  /** Kinds this player is waiting on with its current 3n+1 tiles. */
  waitsFor(seat: number, handIds?: number[]): number[] {
    const p = this.players[seat]
    const ids = handIds ?? p.hand
    return waitsOf(toCounts(ids.map(kindOf)), p.melds.length === 0 ? this.rule.specials : {})
  }

  isFuriten(seat: number): boolean {
    if (!this.isRiichi) return false
    const p = this.players[seat]
    if (p.tempFuriten || p.permFuriten) return true
    const w = this.waitsFor(seat)
    const mine = new Set(p.discards.map((d) => kindOf(d.tile)))
    return w.some((k) => mine.has(k))
  }

  shanten(seat: number, ids?: number[]): number {
    const p = this.players[seat]
    const c = toCounts((ids ?? p.hand).map(kindOf))
    return shantenAll(c, p.melds.length, this.rule.nSets, this.rule.specials)
  }

  // ---------- turn actions ----------
  turnOptions(seat: number): TurnOptions {
    const p = this.players[seat]
    const none: TurnOptions = { tsumo: false, discard: [], riichi: [], ankan: [], kakan: [], nuki: false }
    if (this.phase !== 'turn' || this.turn !== seat) return none
    const o: TurnOptions = { tsumo: false, discard: p.riichi && p.drawn !== null ? [p.drawn] : [...p.hand], riichi: [], ankan: [], kakan: [], nuki: false }
    if (this.sanma && this.wall.length > 0 && p.hand.some((i) => kindOf(i) === 30) && (!p.riichi || (p.drawn !== null && kindOf(p.drawn) === 30))) o.nuki = true
    if (this.afterCall) return o
    if (p.drawn !== null) o.tsumo = this.checkWin(seat, true) !== null
    const kanOk = this.wall.length > 0 && this.kanCount < 4
    const cnt = this.handCounts(p)
    if (kanOk) {
      for (let k = 0; k < 34; k++) {
        if (cnt[k] !== 4) continue
        if (p.riichi) {
          if (k !== kindOf(p.drawn!)) continue
          const before = this.waitsFor(seat, p.hand.filter((i) => i !== p.drawn)).join()
          const after = this.waitsFor(seat, p.hand.filter((i) => kindOf(i) !== k)).join()
          if (before !== after || !before) continue
        }
        o.ankan.push(k)
      }
      if (!p.riichi) for (const m of p.melds) if (m.type === 'pon') { const id = p.hand.find((i) => kindOf(i) === kindOf(m.tiles[0])); if (id !== undefined) o.kakan.push(id) }
    }
    if (this.isRiichi && !p.riichi && this.isClosed(p) && p.points >= 1000 && this.wall.length >= 4) {
      const seen = new Set<number>()
      for (const id of p.hand) {
        const k = kindOf(id)
        if (seen.has(k)) continue
        seen.add(k)
        const rest = p.hand.slice(); rest.splice(rest.indexOf(id), 1)
        if (this.waitsFor(seat, rest).length > 0) o.riichi.push(...p.hand.filter((i) => kindOf(i) === k))
      }
    }
    return o
  }

  act(seat: number, a: TurnAction): boolean {
    if (this.phase !== 'turn' || this.turn !== seat) return false
    const p = this.players[seat]
    const o = this.turnOptions(seat)
    if (a.type === 'tsumo') { if (!o.tsumo) return false; this.declareWin(seat, true, null); return true }
    if (a.type === 'discard') {
      if (!o.discard.includes(a.tile)) return false
      if (a.riichi && !o.riichi.includes(a.tile)) return false
      this.doDiscard(p, a.tile, !!a.riichi)
      return true
    }
    if (a.type === 'nuki') {
      if (!o.nuki) return false
      const id = p.drawn !== null && kindOf(p.drawn) === 30 ? p.drawn : p.hand.find((i) => kindOf(i) === 30)!
      p.hand.splice(p.hand.indexOf(id), 1)
      p.nuki.push(id)
      if (p.drawn === id) p.drawn = null
      sortIds(p.hand)
      this.say(`${p.name} sets aside a North (nuki)`)
      this.beginTurn(seat, true)
      return true
    }
    if (a.type === 'ankan') {
      if (!o.ankan.includes(a.kind)) return false
      const tiles = p.hand.filter((i) => kindOf(i) === a.kind)
      p.hand = p.hand.filter((i) => kindOf(i) !== a.kind)
      p.melds.push({ type: 'ankan', tiles, from: seat })
      p.drawn = null
      this.afterKan(seat, 'declares a closed kan')
      return true
    }
    if (a.type === 'kakan') {
      if (!o.kakan.includes(a.tile)) return false
      this.pendingKakan = { seat, tile: a.tile }
      const reactions: Record<number, ReactionOptions> = {}
      for (let s = 0; s < this.n; s++) {
        if (s === seat) continue
        if (this.canRon(s, a.tile, true)) reactions[s] = { ron: true, pon: false, minkan: false, chi: [] }
      }
      if (Object.keys(reactions).length) {
        this.reactions = reactions; this.decisions = {}; this.reactionKind = 'chankan'
        this.lastDiscard = { tile: a.tile, from: seat }
        this.phase = 'reaction'
      } else this.completeKakan()
      return true
    }
    return false
  }

  private completeKakan() {
    const { seat, tile } = this.pendingKakan!
    this.pendingKakan = null
    const p = this.players[seat]
    p.hand.splice(p.hand.indexOf(tile), 1)
    const m = p.melds.find((x) => x.type === 'pon' && kindOf(x.tiles[0]) === kindOf(tile))!
    m.type = 'kakan'; m.tiles = [...m.tiles, tile]
    p.drawn = null
    this.afterKan(seat, 'adds to a pon (kan)')
  }

  private afterKan(seat: number, msg: string) {
    const p = this.players[seat]
    sortIds(p.hand)
    this.kanCount++
    this.anyCall = true
    for (const q of this.players) q.ippatsu = false
    if (this.isRiichi && this.doraCount < 5) this.doraCount++
    this.say(`${p.name} ${msg}`)
    this.beginTurn(seat, true)
  }

  private doDiscard(p: Player, tile: number, riichi: boolean) {
    p.hand.splice(p.hand.indexOf(tile), 1)
    sortIds(p.hand)
    p.drawn = null
    p.tempFuriten = false
    p.ippatsu = false
    p.discards.push({ tile, riichi, called: false })
    if (riichi) {
      p.riichiPending = true
      p.doubleRiichi = !this.anyCall && p.discards.length === 1
      this.say(`${p.name} declares riichi!`)
    }
    this.rinshan = false
    this.afterCall = false
    this.lastDiscard = { tile, from: p.seat }
    const reactions: Record<number, ReactionOptions> = {}
    for (let s = 0; s < this.n; s++) {
      if (s === p.seat) continue
      const r = this.reactionOptions(s, tile, p.seat)
      if (r.ron || r.pon || r.minkan || r.chi.length) reactions[s] = r
    }
    if (Object.keys(reactions).length) {
      this.reactions = reactions; this.decisions = {}; this.reactionKind = 'discard'; this.phase = 'reaction'
    } else this.nextAfterDiscard()
  }

  private canRon(seat: number, tile: number, chankan = false): boolean {
    if (this.isFuriten(seat)) return false
    return this.checkWin(seat, false, tile, chankan) !== null
  }

  reactionOptions(seat: number, tile: number, from: number): ReactionOptions {
    const p = this.players[seat]
    const k = kindOf(tile)
    const o: ReactionOptions = { ron: this.canRon(seat, tile), pon: false, minkan: false, chi: [] }
    if (this.wall.length === 0 || p.riichi) return o
    const cnt = this.handCounts(p)
    if (cnt[k] >= 2) o.pon = true
    if (cnt[k] >= 3 && this.kanCount < 4) o.minkan = true
    if (!this.sanma && seat === (from + 1) % this.n && suitOf(k) < 3) {
      const n = numOf(k)
      const pick = (kk: number) => Math.max(...p.hand.filter((i) => kindOf(i) === kk))
      const has = (kk: number) => cnt[kk] > 0
      if (n >= 3 && has(k - 2) && has(k - 1)) o.chi.push([pick(k - 2), pick(k - 1)])
      if (n >= 2 && n <= 8 && has(k - 1) && has(k + 1)) o.chi.push([pick(k - 1), pick(k + 1)])
      if (n <= 7 && has(k + 1) && has(k + 2)) o.chi.push([pick(k + 1), pick(k + 2)])
    }
    return o
  }

  submitDecision(seat: number, d: Decision): boolean {
    if (this.phase !== 'reaction' || !this.reactions[seat] || this.decisions[seat]) return false
    const r = this.reactions[seat]
    const ok =
      d.type === 'pass' || (d.type === 'ron' && r.ron) || (d.type === 'pon' && r.pon) || (d.type === 'minkan' && r.minkan) ||
      (d.type === 'chi' && r.chi.some((c) => c[0] === d.use[0] && c[1] === d.use[1]))
    if (!ok) return false
    this.decisions[seat] = d
    if (Object.keys(this.reactions).every((s) => this.decisions[+s])) this.resolveReactions()
    return true
  }

  pendingSeats(): number[] {
    if (this.phase !== 'reaction') return []
    return Object.keys(this.reactions).map(Number).filter((s) => !this.decisions[s])
  }

  private resolveReactions() {
    const { tile, from } = this.lastDiscard!
    const order = Array.from({ length: this.n - 1 }, (_, i) => (from + i + 1) % this.n)
    const isChankan = this.reactionKind === 'chankan'
    const ronners = order.filter((s) => this.decisions[s]?.type === 'ron')
    if (ronners.length) {
      this.reactions = {}
      const multi = this.rule.id === 'taiwan' ? ronners : ronners.slice(0, 1)
      return this.declareWin(multi[0], false, from, tile, isChankan, multi.slice(1))
    }
    for (const s of order) {
      if (this.reactions[s]?.ron && this.isRiichi) {
        const p = this.players[s]
        p.tempFuriten = true
        if (p.riichi) p.permFuriten = true
      }
    }
    if (isChankan) { this.reactions = {}; this.phase = 'turn'; return this.completeKakan() }
    for (const t of ['pon', 'minkan'] as const) {
      const s = order.find((x) => this.decisions[x]?.type === t)
      if (s !== undefined) return this.doCall(s, this.decisions[s], tile, from)
    }
    const c = order.find((x) => this.decisions[x]?.type === 'chi')
    if (c !== undefined) return this.doCall(c, this.decisions[c], tile, from)
    this.reactions = {}
    this.nextAfterDiscard()
  }

  private doCall(seat: number, d: Decision, tile: number, from: number) {
    const p = this.players[seat]
    const fp = this.players[from]
    fp.discards[fp.discards.length - 1].called = true
    if (fp.riichiPending) { fp.riichiPending = false; fp.points -= 1000; this.sticks++ } // riichi stands
    this.reactions = {}; this.decisions = {}
    this.anyCall = true
    for (const q of this.players) q.ippatsu = false
    const k = kindOf(tile)
    if (d.type === 'chi') {
      for (const id of d.use) p.hand.splice(p.hand.indexOf(id), 1)
      p.melds.push({ type: 'chi', tiles: sortIds([tile, ...d.use]), from, called: tile })
      this.say(`${p.name} calls chi`)
      p.drawn = null; this.turn = seat; this.afterCall = true; this.rinshan = false; this.phase = 'turn'
    } else if (d.type === 'pon') {
      const use = p.hand.filter((i) => kindOf(i) === k).slice(0, 2)
      for (const id of use) p.hand.splice(p.hand.indexOf(id), 1)
      p.melds.push({ type: 'pon', tiles: [tile, ...use], from, called: tile })
      this.say(`${p.name} calls pon`)
      p.drawn = null; this.turn = seat; this.afterCall = true; this.rinshan = false; this.phase = 'turn'
    } else {
      const use = p.hand.filter((i) => kindOf(i) === k)
      p.hand = p.hand.filter((i) => kindOf(i) !== k)
      p.melds.push({ type: 'minkan', tiles: [tile, ...use], from, called: tile })
      this.afterKan(seat, 'calls kan')
    }
  }

  private nextAfterDiscard() {
    const { from } = this.lastDiscard!
    const fp = this.players[from]
    if (fp.riichiPending) { fp.riichiPending = false; fp.riichi = true; fp.ippatsu = true; fp.points -= 1000; this.sticks++ }
    this.lastDiscard = this.lastDiscard
    this.beginTurn((from + 1) % this.n, false)
  }

  // ---------- results ----------
  private snapshotHands() {
    return this.players.map((p) => ({ hand: p.hand.slice(), melds: p.melds.map((m) => ({ ...m })), flowers: p.flowers.slice() }))
  }

  private declareWin(winner: number, tsumo: boolean, from: number | null, tile?: number, chankan = false, extra: number[] = []) {
    const p = this.players[winner]
    const score = this.checkWin(winner, tsumo, tile, chankan)!
    // a riichi declaration that got ronned does not cost the stick
    for (const q of this.players) if (q.riichiPending) q.riichiPending = false
    const deltas = this.rule.settle(score, { winner, from, dealer: this.dealer, honba: this.honba, lianZhuang: this.lian, n: this.n })
    let sticksWon = 0
    if (this.isRiichi) { sticksWon = this.sticks * 1000; deltas[winner] += sticksWon; this.sticks = 0 }
    const winTile = tsumo ? p.drawn! : tile!
    const hands = this.snapshotHands()
    if (!tsumo) hands[winner].hand.push(tile!)
    const others: NonNullable<HandResult['others']> = []
    for (const w of extra) {
      const sc = this.checkWin(w, false, tile, chankan)!
      const d2 = this.rule.settle(sc, { winner: w, from, dealer: this.dealer, honba: this.honba, lianZhuang: this.lian, n: this.n })
      d2.forEach((x, i) => (deltas[i] += x))
      const h2 = { hand: [...this.players[w].hand, tile!], melds: this.players[w].melds.map((m) => ({ ...m })), flowers: this.players[w].flowers.slice() }
      others.push({ winner: w, score: sc, hand: h2 })
    }
    const ura = this.isRiichi && p.riichi ? this.uraPool.slice(0, this.doraCount) : undefined
    this.finish({ kind: 'win', winner, from, tsumo, score, winTile, deltas, sticksWon, hands, ura, dealerBefore: this.dealer, others: others.length ? others : undefined }, winner === this.dealer || extra.includes(this.dealer))
    this.say(`${p.name} wins${tsumo ? ' by tsumo' : ' by ron'} (${score.label ?? `${score.total}`})`)
  }

  private flowerWin(winner: number) {
    const p = this.players[winner]
    const base = this.rule.id === 'hk' ? hkValue(8) : TW_BASE + TW_PER_TAI * 8
    const score: HandScore = { yaku: [{ name: 'Eight Flowers', zh: '八仙過海', value: 8 }], total: 8, base }
    const deltas = this.rule.settle(score, { winner, from: null, dealer: this.dealer, honba: this.honba, lianZhuang: this.lian, n: this.n })
    this.finish({ kind: 'win', winner, from: null, tsumo: true, score, winTile: p.flowers[p.flowers.length - 1], deltas, hands: this.snapshotHands(), dealerBefore: this.dealer }, winner === this.dealer)
    this.say(`${p.name} collects all eight flowers!`)
  }

  private exhaustiveDraw() {
    const tenpai = this.players.map((p) => this.waitsFor(p.seat, p.hand).length > 0 && (!p.drawn))
    const deltas: number[] = new Array(this.n).fill(0)
    if (this.isRiichi) {
      const t = tenpai.filter(Boolean).length
      if (t > 0 && t < this.n) for (let i = 0; i < this.n; i++) deltas[i] = tenpai[i] ? 3000 / t : -3000 / (this.n - t)
    }
    for (const q of this.players) if (q.riichiPending) q.riichiPending = false
    this.finish({ kind: 'draw', deltas, tenpai, hands: this.snapshotHands(), dealerBefore: this.dealer, label: 'Exhaustive draw' }, this.isRiichi ? tenpai[this.dealer] : true, true)
    this.say('Exhaustive draw')
  }

  private finish(r: HandResult, dealerStays: boolean, isDraw = false) {
    this.players.forEach((p, i) => (p.points += r.deltas[i]))
    this.result = r
    this.phase = 'result'
    if (dealerStays) {
      this.honba++
      if (!isDraw || this.rule.id === 'taiwan') this.lian++
    } else {
      this.dealer = (this.dealer + 1) % this.n
      this.roundIndex++
      this.lian = 0
      this.honba = this.isRiichi && isDraw ? this.honba + 1 : 0
    }
    this.pendingOver = this.roundIndex >= this.opts.rounds * this.n || (this.isRiichi && this.players.some((p) => p.points < 0))
    if (this.pendingOver && this.isRiichi && this.sticks > 0) {
      const top = this.players.reduce((a, b) => (b.points > a.points ? b : a))
      top.points += this.sticks * 1000
      this.sticks = 0
    }
  }

  /** Advance from the result screen. */
  next() {
    if (this.phase !== 'result') return
    if (this.pendingOver) { this.phase = 'over'; return }
    this.startHand()
  }

  standings() {
    return this.players.map((p) => ({ seat: p.seat, name: p.name, points: p.points })).sort((a, b) => b.points - a.points)
  }
}
