/**
 * The seat / buy-in / cash-out contract shared by the chip games (Hold'em, Blackjack).
 * The room server only talks to this interface, so a new table game needs its engine and a client, not new server plumbing.
 */
export interface HandRecord {
  handNo: number
  /** shown in match history, e.g. "25/50" or "min 10" */
  rule: string
  seats: { seat: number; id: string | null; name: string }[]
  /** chips won or lost by each seat in this hand */
  net: number[]
  summary: unknown
}
export interface CashGame {
  config: { casual: boolean }
  minBuyin: number
  maxBuyin: number
  /** the free temporary stack on casual tables */
  casualStack: number
  graceMs: number
  members: Set<string>
  onChange(fn: () => void): () => boolean
  onCashout: ((id: string, stack: number, buyin: number) => void) | null
  onHand: ((rec: HandRecord) => void) | null
  admit(id: string, create: boolean): 'ok' | 'code_taken' | 'room_not_found'
  join(id: string): void
  disconnect(id: string): void
  hasPlayers(): boolean
  seatOf(id: string): number
  canSit(id: string, amount: number): string | null
  sit(id: string, name: string, amount: number): { ok: true; seat: number } | { ok: false; error: string }
  rebuy(id: string, amount: number): boolean
  rebuyRoom(id: string): number
  standUp(id: string): void
  setOut(id: string, out: boolean): void
  /** a game-specific action; returns an error code or null */
  act(id: string, a: unknown): string | null
  sweep(): number
  view(id: string): unknown
  serialize(): string
  restore(json: string): void
  dispose(): void
}
