import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../../i18n'
import { isTouchPrimary, Kbd } from '../../ui/components'
import { Resign } from '../frame/Resign'
import type { BoardProps } from '../frame/types'
import './strings'

/* ---------------------------------------------------------------- Go */
export function GoBoard({ v, send, name }: BoardProps) {
  const { t } = useLang()
  const s = v.state as {
    n: number
    board: number[]
    black: number
    caps: [number, number]
    last: number
    passes: number
    moves: number
    komi: number
    score: { b: number; w: number; terr: number[] } | null
    resigned: number
  }
  const n = s.n
  const mine = v.you < 0 ? 0 : v.you === s.black ? 1 : 2
  const myTurn = v.status === 'playing' && v.turn === v.you
  const touch = useMemo(() => isTouchPrimary(), [])
  const [pick, setPick] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => {
    setPick(null)
  }, [s.moves, v.game])
  const place = (i: number) => {
    setPick(null)
    send({ k: 'act', a: { x: i % n, y: Math.floor(i / n) } })
  }
  const tap = (i: number) => {
    if (!myTurn || s.board[i] !== 0) return
    if (!touch || pick === i) place(i)
    else setPick(i)
  }
  const pad = 0.7,
    size = n - 1 + pad * 2
  const stars = n === 19 ? [3, 9, 15] : n === 13 ? [3, 6, 9] : [2, 4, 6]
  const colourName = (c: number) => (c === 1 ? t('goBlack') : t('goWhite'))
  const lastPass = v.status === 'playing' && s.passes > 0 && s.last < 0 && s.moves > 0
  const blackSeat = s.black,
    whiteSeat = 1 - s.black
  const ended = v.status === 'over'
  return (
    <div className="gmwrap">
      <div className="gmside" aria-live="polite">
        {mine > 0 && (!v.local || v.status === 'playing') && (
          <span className="gmchip">
            <i className={'gmstone s' + mine} aria-hidden="true" />
            {t(v.local ? 'chToMove' : 'goYouAre', { side: colourName(mine) })}
          </span>
        )}
        <span className="muted small">
          <i className="gmstone s1" aria-hidden="true" /> {t('goCaptured', { n: s.caps[blackSeat] })} · <i className="gmstone s2" aria-hidden="true" />{' '}
          {t('goCaptured', { n: s.caps[whiteSeat] })} · {t('goKomi', { n: s.komi })}
        </span>
      </div>
      <svg className="gmboard" viewBox={`0 0 ${size} ${size}`} role="grid" aria-label={t('go')}>
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
          if (!c) {
            const owner = ended && s.score ? s.score.terr[i] : 0
            return (
              <g key={i}>
                {owner > 0 && <rect x={pad + x - 0.18} y={pad + y - 0.18} width="0.36" height="0.36" className={'gomark s' + owner} />}
                <rect
                  x={pad + x - 0.5}
                  y={pad + y - 0.5}
                  width="1"
                  height="1"
                  className="gmhit"
                  onPointerEnter={() => myTurn && setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => tap(i)}
                />
              </g>
            )
          }
          return (
            <g key={i}>
              <circle cx={pad + x} cy={pad + y} r="0.47" className={'gmst s' + c} />
              {s.last === i && <circle cx={pad + x} cy={pad + y} r="0.16" className="gmlast" />}
            </g>
          )
        })}
        {pick !== null && <circle cx={pad + (pick % n)} cy={pad + Math.floor(pick / n)} r="0.42" className={'gmghost s' + mine} />}
        {!touch && hover !== null && myTurn && s.board[hover] === 0 && (
          <circle cx={pad + (hover % n)} cy={pad + Math.floor(hover / n)} r="0.4" className={'gmghost s' + mine} />
        )}
      </svg>
      {lastPass && <p className="muted small">{t('goPassed', { name: name(v.seats[1 - v.turn].name) })}</p>}
      {ended && s.score && <p className="muted small">{t('goCount', { b: s.score.b, w: s.score.w, k: s.komi })}</p>}
      <div className="gmconfirm chfoot">
        {myTurn &&
          touch &&
          (pick !== null ? (
            <button className="hdbtn primary" onClick={() => place(pick)}>
              {t('goPlace')}
              <Kbd k="↵" />
            </button>
          ) : (
            <span className="muted small">{t('goTapAgain')}</span>
          ))}
        {myTurn && (
          <button className="hdbtn" onClick={() => send({ k: 'act', a: { pass: true } })}>
            {t('goPass')}
          </button>
        )}
        {v.you >= 0 && v.status === 'playing' && <Resign send={send} />}
      </div>
    </div>
  )
}
