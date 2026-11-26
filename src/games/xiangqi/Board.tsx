import { useEffect, useState } from 'react'
import { useLang } from '../../i18n'
import type { BoardProps } from '../frame/types'
import './strings'

/* ---------------------------------------------------------------- Xiangqi */
const XQ_RED = ['', '帥', '仕', '相', '傌', '俥', '炮', '兵'],
  XQ_BLACK = ['', '將', '士', '象', '馬', '車', '砲', '卒']
export function XiangqiBoard({ v, send }: BoardProps) {
  const { t } = useLang()
  const s = v.state as {
    board: number[]
    red: number
    color: 1 | -1 | 0
    toMove: 1 | -1
    last: [number, number] | null
    check: number
    moves: string[]
    targets: Record<string, number[]>
    end: { over: boolean; result: string } | null
  }
  const myTurn = v.status === 'playing' && v.turn === v.you
  const flip = !v.local && s.color === -1
  const [sel, setSel] = useState<number | null>(null)
  const [ask, setAsk] = useState(false)
  useEffect(() => {
    setSel(null)
  }, [s.moves.length, v.game])
  const targets = sel !== null ? (s.targets[sel] ?? []) : []
  const tap = (i: number) => {
    if (!myTurn) return
    if (sel !== null && targets.includes(i)) {
      send({ k: 'act', a: { from: sel, to: i } })
      setSel(null)
      return
    }
    setSel(i in s.targets && i !== sel ? i : null)
  }
  const pad = 0.75
  const X = (f: number) => pad + (flip ? 8 - f : f),
    Y = (r: number) => pad + (flip ? r : 9 - r)
  const side = (c: number) => (c === 1 ? t('xqRed') : t('xqBlack'))
  const pairs: string[] = []
  for (let i = 0; i < s.moves.length; i += 2) pairs.push(`${i / 2 + 1}. ${s.moves[i]}${s.moves[i + 1] ? ' ' + s.moves[i + 1] : ''}`)
  const endKey = s.end
    ? (
        { mate: 'chMate', stalemate: 'chStalemate', repetition: 'chRepetition', norace: 'chFifty', resign: 'chResigned', cap: 'chCap' } as Record<
          string,
          string
        >
      )[s.end.result]
    : ''
  const cells = Array.from({ length: 90 }, (_, i) => i)
  return (
    <div className="ch">
      <div className="gmside">
        {s.color !== 0 && !v.local && (
          <span className="gmchip">
            <i className={'xqdot ' + (s.color === 1 ? 'r' : 'b')} aria-hidden="true" />
            {t('chYouAre', { side: side(s.color) })}
          </span>
        )}
        {v.status === 'playing' && (
          <span className="muted small">
            {t('chToMove', { side: side(s.toMove) })}
            {s.check >= 0 ? ` · ${t('chCheck')}` : ''}
          </span>
        )}
        {endKey && <b>{t(endKey)}</b>}
      </div>
      <svg className="xqboard" viewBox={`0 0 ${8 + pad * 2} ${9 + pad * 2}`} role="grid" aria-label={t('xiangqi')}>
        <rect x="0" y="0" width={8 + pad * 2} height={9 + pad * 2} rx=".5" className="gmwood" />
        {Array.from({ length: 10 }, (_, r) => (
          <line key={'h' + r} x1={pad} x2={pad + 8} y1={pad + r} y2={pad + r} className="gmline" />
        ))}
        {Array.from({ length: 9 }, (_, f) =>
          f === 0 || f === 8 ? (
            <line key={'v' + f} x1={pad + f} x2={pad + f} y1={pad} y2={pad + 9} className="gmline" />
          ) : (
            <g key={'v' + f}>
              <line x1={pad + f} x2={pad + f} y1={pad} y2={pad + 4} className="gmline" />
              <line x1={pad + f} x2={pad + f} y1={pad + 5} y2={pad + 9} className="gmline" />
            </g>
          ),
        )}
        {[0, 7].map((r) => (
          <g key={'p' + r}>
            <line x1={pad + 3} y1={pad + r} x2={pad + 5} y2={pad + r + 2} className="gmline" />
            <line x1={pad + 5} y1={pad + r} x2={pad + 3} y2={pad + r + 2} className="gmline" />
          </g>
        ))}
        <text x={pad + 2} y={pad + 4.62} className="xqriver" textAnchor="middle">
          {t('xqRiver')}
        </text>
        <text x={pad + 6} y={pad + 4.62} className="xqriver" textAnchor="middle">
          {t('xqBorder')}
        </text>
        {cells.map((i) => {
          const f = i % 9,
            r = Math.floor(i / 9),
            x = s.board[i]
          const isTarget = targets.includes(i)
          return (
            <g key={i} onClick={() => tap(i)} className={'xqcell' + (myTurn ? ' live' : '')}>
              <rect x={X(f) - 0.5} y={Y(r) - 0.5} width="1" height="1" fill="transparent" />
              {s.last && (s.last[0] === i || s.last[1] === i) && <circle cx={X(f)} cy={Y(r)} r="0.5" className="xqlast" />}
              {x !== 0 && (
                <g className={'xqp ' + (x > 0 ? 'r' : 'b') + (sel === i ? ' sel' : '') + (s.check === i ? ' check' : '')}>
                  <circle cx={X(f)} cy={Y(r)} r="0.42" className="xqdisc" />
                  <circle cx={X(f)} cy={Y(r)} r="0.34" className="xqring" />
                  <text x={X(f)} y={Y(r) + 0.15} textAnchor="middle" className="xqchar">
                    {(x > 0 ? XQ_RED : XQ_BLACK)[Math.abs(x)]}
                  </text>
                </g>
              )}
              {isTarget && (x ? <circle cx={X(f)} cy={Y(r)} r="0.47" className="xqcap" /> : <circle cx={X(f)} cy={Y(r)} r="0.13" className="xqtgt" />)}
            </g>
          )
        })}
      </svg>
      <div className="chfoot">
        {myTurn && sel === null && <span className="muted small">{t('chSelect')}</span>}
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
