import { useMemo, useState } from 'react'
import { useLang } from '../../i18n'
import { isTouchPrimary, Kbd } from '../../ui/components'
import type { BoardProps } from '../frame/types'
import './strings'

/* ---------------------------------------------------------------- Gomoku */
export function GomokuBoard({ v, send }: BoardProps) {
  const { t } = useLang()
  const s = v.state as { size: number; board: number[]; black: number; last: [number, number] | null; win: [number, number][] | null }
  const n = s.size
  const mine = v.you === s.black ? 1 : v.you >= 0 ? 2 : 0
  const myTurn = v.status === 'playing' && v.turn === v.you
  const touch = useMemo(() => isTouchPrimary(), [])
  const [pick, setPick] = useState<[number, number] | null>(null)
  const [hover, setHover] = useState<[number, number] | null>(null)
  const win = useMemo(() => new Set((s.win ?? []).map(([x, y]) => `${x},${y}`)), [s.win])
  const place = (x: number, y: number) => {
    setPick(null)
    send({ k: 'act', a: { x, y } })
  }
  const tap = (x: number, y: number) => {
    if (!myTurn || s.board[y * n + x] !== 0) return
    if (!touch || (pick && pick[0] === x && pick[1] === y)) place(x, y)
    else setPick([x, y])
  }
  const pad = 0.7,
    size = n - 1 + pad * 2
  const stars = n === 19 ? [3, 9, 15] : [3, 7, 11]
  const sideName = (side: number) => (side === 1 ? t('gmBlack') : t('gmWhite'))
  return (
    <div className="gmwrap">
      <div className="gmside" aria-live="polite">
        {mine > 0 && !v.local ? (
          <span className="gmchip">
            <i className={'gmstone s' + mine} aria-hidden="true" />
            {t('gmYouAre', { side: sideName(mine) })}
          </span>
        ) : null}
        {v.status === 'playing' && (
          <span className="muted small">
            <i className={'gmstone s' + (v.turn === s.black ? 1 : 2)} aria-hidden="true" /> {sideName(v.turn === s.black ? 1 : 2)}
          </span>
        )}
      </div>
      <svg className="gmboard" viewBox={`0 0 ${size} ${size}`} role="grid" aria-label={t('gomoku')}>
        <rect x="0" y="0" width={size} height={size} rx="0.6" className="gmwood" />
        {Array.from({ length: n }, (_, i) => (
          <g key={i}>
            <line x1={pad} y1={pad + i} x2={pad + n - 1} y2={pad + i} className="gmline" />
            <line x1={pad + i} y1={pad} x2={pad + i} y2={pad + n - 1} className="gmline" />
          </g>
        ))}
        {stars.flatMap((a) => stars.map((b) => <circle key={`${a}-${b}`} cx={pad + a} cy={pad + b} r="0.12" className="gmstar" />))}
        {s.board.map((c, i) => {
          const x = i % n,
            y = Math.floor(i / n)
          if (!c)
            return (
              <rect
                key={i}
                x={pad + x - 0.5}
                y={pad + y - 0.5}
                width="1"
                height="1"
                className="gmhit"
                onPointerEnter={() => myTurn && setHover([x, y])}
                onPointerLeave={() => setHover(null)}
                onClick={() => tap(x, y)}
              />
            )
          return (
            <g key={i} className={win.has(`${x},${y}`) ? 'gmwin' : ''}>
              <circle cx={pad + x} cy={pad + y} r="0.46" className={'gmst s' + c} />
              {s.last && s.last[0] === x && s.last[1] === y && <circle cx={pad + x} cy={pad + y} r="0.16" className="gmlast" />}
            </g>
          )
        })}
        {pick && <circle cx={pad + pick[0]} cy={pad + pick[1]} r="0.42" className={'gmghost s' + mine} />}
        {!touch && hover && myTurn && s.board[hover[1] * n + hover[0]] === 0 && (
          <circle cx={pad + hover[0]} cy={pad + hover[1]} r="0.4" className={'gmghost s' + mine} />
        )}
      </svg>
      {touch && myTurn && (
        <div className="gmconfirm">
          {pick ? (
            <button className="hdbtn primary" onClick={() => place(pick[0], pick[1])}>
              {t('gmPlace')}
              <Kbd k="↵" />
            </button>
          ) : (
            <span className="muted small">{t('gmTapAgain')}</span>
          )}
        </div>
      )}
    </div>
  )
}
