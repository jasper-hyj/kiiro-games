import { createContext, useContext } from 'react'
import { isRedFive, kindOf, numOf, suitOf } from '../engine/tiles'

export const AkaCtx = createContext(false)

const NUMS = '一二三四五六七八九'
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1.5]],
  2: [[1, 0.5], [1, 2.5]],
  3: [[0, 0.5], [1, 1.5], [2, 2.5]],
  4: [[0, 0.5], [2, 0.5], [0, 2.5], [2, 2.5]],
  5: [[0, 0.5], [2, 0.5], [1, 1.5], [0, 2.5], [2, 2.5]],
  6: [[0, 0.4], [2, 0.4], [0, 1.5], [2, 1.5], [0, 2.6], [2, 2.6]],
  7: [[0, 0], [1, 0.5], [2, 1], [0, 2.1], [2, 2.1], [0, 3], [2, 3]],
  8: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2], [0, 3], [2, 3]],
  9: [[0, 0.5], [1, 0.5], [2, 0.5], [0, 1.5], [1, 1.5], [2, 1.5], [0, 2.5], [1, 2.5], [2, 2.5]],
}
const PIN_COL = ['#1b5fa8', '#c62828', '#2e7d32']

function Pips({ suit, n }: { suit: 1 | 2; n: number }) {
  const pts = PIPS[n]
  const X = (c: number) => 5 + c * 7
  const Y = (r: number) => 6 + r * 8.5
  if (suit === 1 && n === 1) {
    return (
      <svg viewBox="0 0 24 34" className="pips">
        <circle cx="12" cy="17" r="9" fill="#1b5fa8" /><circle cx="12" cy="17" r="6" fill="#f7f3e6" />
        <circle cx="12" cy="17" r="4" fill="#c62828" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 34" className="pips">
      {pts.map(([c, r], i) =>
        suit === 1 ? (
          <g key={i}>
            <circle cx={X(c)} cy={Y(r)} r="3.3" fill={PIN_COL[(c + Math.floor(r)) % 3]} />
            <circle cx={X(c)} cy={Y(r)} r="1.3" fill="#f7f3e6" />
          </g>
        ) : (
          <g key={i}>
            <rect x={X(c) - 1.8} y={Y(r) - 4} width="3.6" height="8" rx="1.6" fill={n === 1 || (n === 5 && c === 1 && r === 1.5) ? '#c62828' : '#1f7a3a'} />
            <rect x={X(c) - 1.8} y={Y(r) - 0.4} width="3.6" height="0.9" fill="#f7f3e6" />
          </g>
        ),
      )}
    </svg>
  )
}

export function Face({ kind }: { kind: number }) {
  const s = suitOf(kind)
  if (kind >= 34) {
    const n = (kind - 34) % 4
    const season = kind >= 38
    const ch = season ? '春夏秋冬'[n] : '梅蘭菊竹'[n]
    return (
      <>
        <div className="big" style={{ color: season ? '#b8541a' : '#2e7d32' }}>{ch}</div>
        <div className="sm" style={{ color: '#777' }}>{n + 1}</div>
      </>
    )
  }
  if (s === 0) return (<><div className="big">{NUMS[numOf(kind) - 1]}</div><div className="sm" style={{ color: '#c62828' }}>萬</div></>)
  if (s === 1) return <Pips suit={1} n={numOf(kind)} />
  if (s === 2) return numOf(kind) === 1 ? <div className="big" style={{ color: '#1f7a3a' }}>🀐</div> : <Pips suit={2} n={numOf(kind)} />
  const h = kind - 27
  if (h < 4) return <div className="big">{'東南西北'[h]}</div>
  if (kind === 31) return <div className="white-dragon" />
  if (kind === 32) return <div className="big" style={{ color: '#1f7a3a' }}>發</div>
  return <div className="big" style={{ color: '#c62828' }}>中</div>
}

interface Props {
  id?: number; kind?: number; back?: boolean
  onClick?: () => void; selected?: boolean; dim?: boolean; mark?: boolean; riichi?: boolean; hot?: boolean; title?: string
  className?: string
}
export function Tile({ id, kind, back, onClick, selected, dim, mark, riichi, hot, title, className }: Props) {
  const aka = useContext(AkaCtx)
  const k = kind ?? (id !== undefined ? kindOf(id) : 0)
  const red = aka && id !== undefined && isRedFive(id)
  const cls = ['tile', back ? 'back' : '', selected ? 'sel' : '', dim ? 'dim' : '', riichi ? 'riichi-t' : '', hot ? 'hot' : '', onClick ? 'clickable' : '', red ? 'aka' : '', className ?? ''].join(' ')
  return (
    <div className={cls} onClick={onClick} title={title}>
      {!back && <Face kind={k} />}
      {red && <span className="aka-dot" />}
      {mark && <span className="mark" />}
    </div>
  )
}
