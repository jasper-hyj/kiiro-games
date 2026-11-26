import { useEffect, useState } from 'react'
import { useLang } from '../../i18n'
import { name as sqName } from './rules'
import type { BoardProps } from '../frame/types'
import './strings'

/* ---------------------------------------------------------------- Chess */
const GLYPH = ['', '♟', '♞', '♝', '♜', '♛', '♚']
export function ChessBoard({ v, send }: BoardProps) {
  const { t } = useLang()
  const s = v.state as {
    board: number[]
    white: number
    color: 1 | -1 | 0
    toMove: 1 | -1
    last: [number, number] | null
    check: number
    moves: string[]
    targets: Record<string, string[]>
    promos: string[]
    end: { over: boolean; result: string } | null
  }
  const myTurn = v.status === 'playing' && v.turn === v.you
  const flip = !v.local && s.color === -1
  const [sel, setSel] = useState<string | null>(null)
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null)
  const [ask, setAsk] = useState(false)
  useEffect(() => {
    setSel(null)
    setPromo(null)
  }, [s.moves.length, v.game])
  const targets = sel ? (s.targets[sel] ?? []) : []
  const tap = (sq: number) => {
    if (!myTurn) return
    const n = sqName(sq)
    if (sel && targets.includes(n)) {
      if (s.promos.includes(sel + n)) setPromo({ from: sel, to: n })
      else {
        send({ k: 'act', a: { from: sel, to: n } })
        setSel(null)
      }
      return
    }
    setSel(n in s.targets && n !== sel ? n : null)
  }
  const order = Array.from({ length: 64 }, (_, i) => i).map((i) => {
    const r = 7 - (i >> 3),
      f = i & 7
    return flip ? (7 - r) * 8 + (7 - f) : r * 8 + f
  })
  const side = (c: number) => (c === 1 ? t('chWhite') : t('chBlack'))
  const pairs: string[] = []
  for (let i = 0; i < s.moves.length; i += 2) pairs.push(`${i / 2 + 1}. ${s.moves[i]}${s.moves[i + 1] ? ' ' + s.moves[i + 1] : ''}`)
  const endText = s.end
    ? (
        {
          mate: t('chMate'),
          stalemate: t('chStalemate'),
          insufficient: t('chInsufficient'),
          fifty: t('chFifty'),
          repetition: t('chRepetition'),
          resign: t('chResigned'),
          cap: t('chCap'),
        } as Record<string, string>
      )[s.end.result]
    : ''
  return (
    <div className="ch">
      <div className="gmside">
        {s.color !== 0 && !v.local && (
          <span className="gmchip">
            <i className={'gmstone s' + (s.color === 1 ? 2 : 1)} aria-hidden="true" />
            {t('chYouAre', { side: side(s.color) })}
          </span>
        )}
        {v.status === 'playing' && (
          <span className="muted small">
            {t('chToMove', { side: side(s.toMove) })}
            {s.check >= 0 ? ` · ${t('chCheck')}` : ''}
          </span>
        )}
        {endText && <b>{endText}</b>}
      </div>
      <div className="chboard" role="grid" aria-label={t('chess')}>
        {order.map((sq) => {
          const x = s.board[sq],
            dark = ((sq & 7) + (sq >> 3)) % 2 === 0,
            n = sqName(sq)
          const cls =
            'chsq' +
            (dark ? ' dark' : '') +
            (sel === n ? ' sel' : '') +
            (s.last && (s.last[0] === sq || s.last[1] === sq) ? ' last' : '') +
            (s.check === sq ? ' check' : '') +
            (targets.includes(n) ? (x ? ' cap' : ' tgt') : '')
          return (
            <button key={sq} className={cls} onClick={() => tap(sq)} aria-label={n + (x ? ' ' + GLYPH[Math.abs(x)] : '')} disabled={!myTurn}>
              {x ? <span className={'chp ' + (x > 0 ? 'w' : 'b')}>{GLYPH[Math.abs(x)]}</span> : null}
            </button>
          )
        })}
      </div>
      <div className="chfoot">
        {myTurn && !sel && <span className="muted small">{t('chSelect')}</span>}
        {v.you >= 0 && v.status === 'playing' && (
          <button className="hdbtn quiet" onClick={() => setAsk(true)}>
            {t('chResign')}
          </button>
        )}
      </div>
      {pairs.length > 0 && (
        <div className="chmoves" aria-label={t('chMoves')}>
          {pairs.map((p, i) => (
            <span key={i}>{p}</span>
          ))}
        </div>
      )}
      {promo && (
        <div className="acmodal" onClick={() => setPromo(null)}>
          <div className="acbox" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('chPromote')}>
            <h2>{t('chPromote')}</h2>
            <div className="c8suits">
              {[
                ['q', 5],
                ['r', 4],
                ['b', 3],
                ['n', 2],
              ].map(([k, n]) => (
                <button
                  key={k as string}
                  onClick={() => {
                    send({ k: 'act', a: { from: promo.from, to: promo.to, promo: k } })
                    setPromo(null)
                    setSel(null)
                  }}
                >
                  {GLYPH[n as number].replace('♟', '♟')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {ask && (
        <div className="acmodal" onClick={() => setAsk(false)}>
          <div className="acbox" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('chResignAsk')}>
            <h2>{t('chResignAsk')}</h2>
            <div className="acrow">
              <button className="ghost" onClick={() => setAsk(false)}>
                {t('chNo')}
              </button>
              <button
                className="primary"
                onClick={() => {
                  send({ k: 'act', a: { resign: true } })
                  setAsk(false)
                }}
              >
                {t('chYes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
