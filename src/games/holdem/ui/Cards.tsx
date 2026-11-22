import { rankOf, suitOf, RANKS, SUITS } from '../engine/cards'

/** One playing card. `c` is 0..51; omit it (or pass back) for a face-down card. */
export function Card({ c, small, back, hot }: { c?: number; small?: boolean; back?: boolean; hot?: boolean }) {
  if (back || c === undefined) return <span className={'pkcard back' + (small ? ' small' : '')} aria-hidden="true" />
  const red = suitOf(c) === 1 || suitOf(c) === 2
  return (
    <span className={'pkcard' + (small ? ' small' : '') + (red ? ' red' : '') + (hot ? ' hot' : '')} aria-label={RANKS[rankOf(c)] + SUITS[suitOf(c)]}>
      <b>{RANKS[rankOf(c)] === 'T' ? '10' : RANKS[rankOf(c)]}</b><i>{SUITS[suitOf(c)]}</i>
    </span>
  )
}
