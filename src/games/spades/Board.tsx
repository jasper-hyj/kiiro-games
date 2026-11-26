import { useLang } from '../../i18n'
import type { BoardProps } from '../frame/types'
import { Trick, HandRow, Around } from '../trick/table'
import './strings'

export function SpadesBoard({ v, send, name }: BoardProps) {
  const { t } = useLang()
  const s = v.state as {
    phase: 'bid' | 'play' | 'done'
    hand: number[]
    counts: number[]
    bids: (number | null)[]
    trick: { seat: number; card: number }[]
    last: { seat: number; card: number }[] | null
    lastWinner: number
    broken: boolean
    won: number[]
    legal: number[]
    team: [number, number]
    detail: { team: number; bid: number; made: number; score: number; nil: number }[]
    tricks: number
  }
  const myTurn = v.status === 'playing' && v.turn === v.you
  const showTrick = s.trick.length ? s.trick : (s.last ?? [])
  const you = Math.max(0, v.you)
  const bidText = (seat: number) =>
    s.bids[seat] === null
      ? '…'
      : s.phase === 'bid'
        ? s.bids[seat] === 0
          ? t('spNil')
          : String(s.bids[seat])
        : t('spBids', { b: s.bids[seat] === 0 ? t('spNil') : s.bids[seat]!, w: s.won[seat] })
  return (
    <div className="tk">
      <div className="tkinfo muted small">
        {s.broken ? t('spBroken') : ''}
        {v.you >= 0 ? `${s.broken ? ' · ' : ''}${t('spTeam', { p: name(v.seats[(you + 2) % 4].name), a: bidText(you) })}` : ''}
      </div>
      <div className="tktable k-felt">
        <Around v={v} name={name} extra={bidText} />
        <div className="tkmid">{s.phase === 'bid' ? <span className="tkhint">{t('spBid')}</span> : <Trick v={v} cards={showTrick} you={v.you} />}</div>
      </div>
      {s.phase === 'done' && (
        <div className="tkcenter muted small">
          {s.detail.map((d) => (
            <div key={d.team}>
              {t('spResult', { t: d.team + 1, b: d.bid, m: d.made, s: d.score })}
              {d.nil ? ` · ${d.nil > 0 ? t('spNilWon') : t('spNilLost')}` : ''}
            </div>
          ))}
        </div>
      )}
      {s.phase === 'bid' && myTurn && (
        <div className="tkbids" role="group" aria-label={t('spBid')}>
          {Array.from({ length: 14 }, (_, b) => (
            <button key={b} className="hdbtn" onClick={() => send({ k: 'act', a: { bid: b } })}>
              {b === 0 ? t('spNil') : b}
            </button>
          ))}
        </div>
      )}
      {v.you >= 0 && (
        <div className="tkmine">
          <HandRow hand={s.hand} legal={new Set(s.legal)} enabled={myTurn && s.phase === 'play'} onTap={(c) => send({ k: 'act', a: { card: c } })} />
        </div>
      )}
    </div>
  )
}
