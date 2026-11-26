import { useEffect, useState } from 'react'
import { useLang } from '../../i18n'
import type { BoardProps } from '../frame/types'
import { Trick, HandRow, Around } from '../trick/table'
import './strings'

export function HeartsBoard({ v, send, name }: BoardProps) {
  const { t } = useLang()
  const s = v.state as {
    phase: 'pass' | 'play' | 'done'
    dir: number
    hand: number[]
    counts: number[]
    picked: boolean[]
    trick: { seat: number; card: number }[]
    last: { seat: number; card: number }[] | null
    lastWinner: number
    broken: boolean
    taken: number[]
    scores: number[]
    moon: number
    legal: number[]
    tricks: number
  }
  const myTurn = v.status === 'playing' && v.turn === v.you
  const [sel, setSel] = useState<number[]>([])
  useEffect(() => {
    setSel([])
  }, [s.phase, s.tricks, v.game])
  const passing = s.phase === 'pass' && v.status === 'playing' && v.you >= 0 && !s.picked[v.you]
  const waiting = s.phase === 'pass' && v.you >= 0 && s.picked[v.you]
  const toggle = (c: number) => setSel((a) => (a.includes(c) ? a.filter((x) => x !== c) : a.length < 3 ? [...a, c] : a))
  const dirKey = ['htLeft', 'htRight', 'htAcross', 'htKeep'][s.dir]
  const showTrick = s.trick.length ? s.trick : (s.last ?? [])
  return (
    <div className="tk">
      <div className="tkinfo muted small">
        {s.broken ? t('htBroken') : ''}
        {s.phase === 'pass' ? `${s.broken ? ' · ' : ''}${t('htPass', { to: t(dirKey) })}` : ''}
      </div>
      <div className="tktable k-felt">
        <Around v={v} name={name} extra={(seat) => t('htPoints', { n: s.phase === 'done' ? s.scores[seat] : s.taken[seat] })} />
        <div className="tkmid">
          {s.phase === 'pass' ? <span className="tkhint">{t(waiting ? 'htWaiting' : 'htPick')}</span> : <Trick v={v} cards={showTrick} you={v.you} />}
        </div>
      </div>
      {s.phase === 'play' && s.trick.length === 0 && s.last && (
        <p className="muted small tkcenter">{t('htLast', { name: name(v.seats[s.lastWinner].name) })}</p>
      )}
      {s.phase === 'done' && s.moon >= 0 && (
        <p className="tkcenter">
          <b>{t('htMoon', { name: name(v.seats[s.moon].name) })}</b>
        </p>
      )}
      {v.you >= 0 && (
        <div className="tkmine">
          <HandRow
            hand={s.hand}
            legal={passing ? null : new Set(s.legal)}
            enabled={passing || (myTurn && s.phase === 'play')}
            picked={sel}
            onTap={(c) => (passing ? toggle(c) : send({ k: 'act', a: { card: c } }))}
          />
          {passing && (
            <button className="hdbtn primary" disabled={sel.length !== 3} onClick={() => send({ k: 'act', a: { pass: sel } })}>
              {t('htPass', { to: t(dirKey) })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
