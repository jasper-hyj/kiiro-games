import { Card } from '../holdem/ui/Cards'
import type { BoardProps } from '../frame/types'
import './styles.css'

/* ---------------------------------------------------------------- Hearts and Spades share one table */
export function Trick({ v, cards, you }: { v: BoardProps['v']; cards: { seat: number; card: number }[]; you: number }) {
  const at = (rel: number) => cards.find((c) => (c.seat - Math.max(0, you) + 4) % 4 === rel)
  return (
    <div className="tkcross">
      {[2, 1, 3, 0].map((rel) => (
        <div key={rel} className={'tkslot r' + rel}>
          {at(rel) ? <Card c={at(rel)!.card} /> : <span className="pkslot" aria-hidden="true" />}
        </div>
      ))}
      <span hidden>{v.game}</span>
    </div>
  )
}
export function HandRow({
  hand,
  legal,
  enabled,
  onTap,
  picked,
}: {
  hand: number[]
  legal: Set<number> | null
  enabled: boolean
  onTap(c: number): void
  picked?: number[]
}) {
  return (
    <div className="tkhand">
      {hand.map((c) => {
        const ok = enabled && (legal ? legal.has(c) : true)
        return (
          <button
            key={c}
            className={'tkcard' + (ok ? ' ok' : enabled ? ' dim' : '') + (picked?.includes(c) ? ' sel' : '')}
            disabled={!ok}
            onClick={() => onTap(c)}
          >
            <Card c={c} />
          </button>
        )
      })}
    </div>
  )
}
export function Around({ v, name, extra }: { v: BoardProps['v']; name: BoardProps['name']; extra(seat: number): string }) {
  const you = Math.max(0, v.you)
  const pos = ['tkb', 'tkl', 'tkt', 'tkr']
  return (
    <>
      {[2, 1, 3].map((rel) => {
        const seat = (you + rel) % 4
        return (
          <div key={rel} className={'tkseat ' + pos[rel] + (v.turn === seat ? ' turn' : '')}>
            <b>{name(v.seats[seat].name)}</b>
            <span>{extra(seat)}</span>
          </div>
        )
      })}
    </>
  )
}
