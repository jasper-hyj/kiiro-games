import { createContext, useContext, type ReactNode } from 'react'
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

function Bird() {
  return (
    <svg viewBox="0 0 24 36" className="pips">
      <path d="M4 24 Q2 29 7 31 L11 26 Z" fill="#1f7a3a" />
      <ellipse cx="12" cy="19" rx="7" ry="7.5" fill="#1f7a3a" />
      <path d="M7 19 Q12 13 17 19 Q12 24 7 19Z" fill="#8fd6a2" />
      <circle cx="15.5" cy="11" r="4" fill="#1f7a3a" />
      <path d="M13 6.5 L14.5 3 L16 6.5Z" fill="#c62828" />
      <path d="M19 10 L23 11.5 L19 13Z" fill="#e08a1e" />
      <circle cx="16.4" cy="10.4" r="1" fill="#f3f0e6" />
      <path d="M10 26 L9 31 M14 26 L15 31" stroke="#c62828" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function Stick({ x, y, red }: { x: number; y: number; red?: boolean }) {
  const c = red ? '#c62828' : '#1f7a3a', d = red ? '#7d1414' : '#0f4a22', l = red ? '#f08a8a' : '#8fd6a2'
  return (
    <g>
      <rect x={x - 2} y={y - 4.4} width="4" height="8.8" rx="1.6" fill={c} />
      <rect x={x - 0.9} y={y - 3.6} width="0.9" height="7.2" fill={l} opacity=".8" />
      <rect x={x - 2} y={y - 0.5} width="4" height="1" fill={d} />
      <rect x={x - 2} y={y - 4.4} width="4" height="0.9" fill={d} />
      <rect x={x - 2} y={y + 3.5} width="4" height="0.9" fill={d} />
    </g>
  )
}

function Pip({ x, y, red, r = 3.5 }: { x: number; y: number; red?: boolean; r?: number }) {
  const c = red ? '#c62828' : '#23272e'
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={c} />
      <circle cx={x} cy={y} r={r * 0.74} fill="#eceae3" />
      <circle cx={x} cy={y} r={r * 0.6} fill="none" stroke={c} strokeWidth={r * 0.14} strokeDasharray={`${r * 0.5} ${r * 0.32}`} />
      <circle cx={x} cy={y} r={r * 0.3} fill={c} />
    </g>
  )
}

// which pips are red for each count (centre pip on odd counts, a few accents on larger ones)
// pip size grows as the count shrinks, like a real set
const PIN_R: Record<number, number> = { 2: 5.2, 3: 4.7, 4: 5, 5: 4.6, 6: 3.7, 7: 3.35, 8: 3.65, 9: 3.4 }
const RED_PIPS: Record<number, number[]> = { 3: [1], 5: [2], 7: [0, 1, 2], 9: [1, 4, 7], 6: [4, 5], 2: [], 4: [], 8: [] }

function Pips({ suit, n }: { suit: 1 | 2; n: number }) {
  const pts = PIPS[n]
  const X = (c: number) => 5 + c * 7
  const Y = (r: number) => 6.6 + r * 7.6
  if (suit === 1 && n === 1) {
    return (
      <svg viewBox="0 0 24 36" className="pips">
        <circle cx="12" cy="18" r="11" fill="#23272e" /><circle cx="12" cy="18" r="9.6" fill="#eceae3" />
        <circle cx="12" cy="18" r="8.2" fill="none" stroke="#23272e" strokeWidth="1.2" strokeDasharray="3 2" />
        <circle cx="12" cy="18" r="5.6" fill="#23272e" /><circle cx="12" cy="18" r="4.3" fill="#eceae3" />
        <circle cx="12" cy="18" r="2.8" fill="#c62828" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 36" className="pips">
      {pts.map(([c, r], i) =>
        suit === 2 ? <Stick key={i} x={X(c)} y={Y(r)} red={n === 5 && c === 1 && r === 1.5} /> : <Pip key={i} x={X(c)} y={Y(r)} r={PIN_R[n]} red={RED_PIPS[n].includes(i)} />,
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
  if (s === 0) return (<><span className="idx">{numOf(kind)}</span><div className="big man">{NUMS[numOf(kind) - 1]}</div><div className="big man" style={{ color: '#c62828' }}>萬</div></>)
  if (s === 1) return <><span className="idx">{numOf(kind)}</span><Pips suit={1} n={numOf(kind)} /></>
  if (s === 2) return <><span className="idx">{numOf(kind)}</span>{numOf(kind) === 1 ? <Bird /> : <Pips suit={2} n={numOf(kind)} />}</>
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
/** Rotated tile (called tile in a meld, riichi discard). `double` stacks two tiles (added kan). */
export function Side({ children, double }: { children: ReactNode; double?: boolean }) {
  return <span className={'sw' + (double ? ' dbl' : '')}>{children}</span>
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
