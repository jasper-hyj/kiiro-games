import { createContext, useContext, type ReactNode } from 'react'
import { isRedFive, kindOf, numOf, suitOf } from '../engine/tiles'

export const AkaCtx = createContext(false)

const NUMS = '一二三四五六七八九'
// Pip layouts are drawn in a 24 x 36 box and spread to fill the whole tile face (no empty band below).
type Pt = [number, number]
const PIN: Record<number, { pts: Pt[]; r: number; red: number[] }> = {
  2: { pts: [[12, 10], [12, 26]], r: 5.4, red: [] },
  3: { pts: [[6, 8], [12, 18], [18, 28]], r: 4.9, red: [1] },
  4: { pts: [[6, 9], [18, 9], [6, 27], [18, 27]], r: 5.2, red: [] },
  5: { pts: [[6, 9], [18, 9], [12, 18], [6, 27], [18, 27]], r: 4.8, red: [2] },
  6: { pts: [[7, 8], [17, 8], [7, 18], [17, 18], [7, 28], [17, 28]], r: 4.4, red: [4, 5] },
  7: { pts: [[5, 6], [12, 10], [19, 14], [7, 23], [17, 23], [7, 31], [17, 31]], r: 3.5, red: [0, 1, 2] },
  8: { pts: [[7, 6], [17, 6], [7, 14], [17, 14], [7, 22], [17, 22], [7, 30], [17, 30]], r: 3.8, red: [] },
  9: { pts: [[5, 8], [12, 8], [19, 8], [5, 18], [12, 18], [19, 18], [5, 28], [12, 28], [19, 28]], r: 3.5, red: [3, 4, 5] },
}
const SOU: Record<number, { pts: Pt[]; h: number; w: number; red: number[] }> = {
  2: { pts: [[12, 10], [12, 26]], h: 14, w: 5, red: [] },
  3: { pts: [[12, 9], [7, 26], [17, 26]], h: 13, w: 4.8, red: [] },
  4: { pts: [[7, 10], [17, 10], [7, 26], [17, 26]], h: 14, w: 4.8, red: [] },
  5: { pts: [[6, 9], [18, 9], [12, 18], [6, 27], [18, 27]], h: 12, w: 4.6, red: [2] },
  6: { pts: [[7, 8], [17, 8], [7, 18], [17, 18], [7, 28], [17, 28]], h: 9.4, w: 4.4, red: [] },
  7: { pts: [[12, 6], [5, 17], [12, 17], [19, 17], [5, 29], [12, 29], [19, 29]], h: 9.4, w: 4.2, red: [0] },
  8: { pts: [[7, 6], [17, 6], [7, 14], [17, 14], [7, 22], [17, 22], [7, 30], [17, 30]], h: 7.6, w: 4.4, red: [] },
  9: { pts: [[5, 8], [12, 8], [19, 8], [5, 18], [12, 18], [19, 18], [5, 28], [12, 28], [19, 28]], h: 9.4, w: 4.2, red: [3, 4, 5] },
}

function Bird() {
  return (
    <svg viewBox="0 0 24 36" className="pips">
      <path d="M3 27 Q1 33 7 34 L11 28 Z" fill="#1f7a3a" />
      <ellipse cx="12" cy="21" rx="7.5" ry="8.5" fill="#1f7a3a" />
      <path d="M6.5 21 Q12 14 17.5 21 Q12 27 6.5 21Z" fill="#8fd6a2" />
      <circle cx="15.5" cy="11" r="4.4" fill="#1f7a3a" />
      <path d="M12.8 6.2 L14.6 2 L16.4 6.2Z" fill="#c62828" />
      <path d="M19.4 10 L23.5 11.6 L19.4 13.2Z" fill="#e08a1e" />
      <circle cx="16.5" cy="10.3" r="1.1" fill="#f3f0e6" />
      <path d="M10 29 L9 35 M14 29 L15 35" stroke="#c62828" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function Stick({ x, y, h, w, red }: { x: number; y: number; h: number; w: number; red?: boolean }) {
  const c = red ? '#c62828' : '#1f7a3a', d = red ? '#7d1414' : '#0f4a22', l = red ? '#f08a8a' : '#8fd6a2'
  const t = y - h / 2
  const joints = h > 11 ? [0.33, 0.66] : [0.5]
  return (
    <g>
      <rect x={x - w / 2} y={t} width={w} height={h} rx={w * 0.4} fill={c} />
      <rect x={x - w * 0.28} y={t + 0.8} width={w * 0.2} height={h - 1.6} fill={l} opacity=".8" />
      {joints.map((j, i) => <rect key={i} x={x - w / 2} y={t + h * j - 0.45} width={w} height="0.9" fill={d} />)}
      <rect x={x - w / 2} y={t} width={w} height="0.9" fill={d} />
      <rect x={x - w / 2} y={t + h - 0.9} width={w} height="0.9" fill={d} />
    </g>
  )
}

function Pip({ x, y, red, r }: { x: number; y: number; red?: boolean; r: number }) {
  const c = red ? '#c62828' : '#23272e'
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={c} />
      <circle cx={x} cy={y} r={r * 0.76} fill="#eceae3" />
      <circle cx={x} cy={y} r={r * 0.6} fill="none" stroke={c} strokeWidth={r * 0.16} strokeDasharray={`${r * 0.5} ${r * 0.3}`} />
      <circle cx={x} cy={y} r={r * 0.3} fill={c} />
    </g>
  )
}

function Pips({ suit, n, allRed }: { suit: 1 | 2; n: number; allRed?: boolean }) {
  if (suit === 1 && n === 1) {
    return (
      <svg viewBox="0 0 24 36" className="pips">
        <circle cx="12" cy="18" r="11.4" fill="#23272e" /><circle cx="12" cy="18" r="10" fill="#eceae3" />
        <circle cx="12" cy="18" r="8.6" fill="none" stroke="#23272e" strokeWidth="1.2" strokeDasharray="3 2" />
        <circle cx="12" cy="18" r="5.9" fill="#23272e" /><circle cx="12" cy="18" r="4.5" fill="#eceae3" />
        <circle cx="12" cy="18" r="2.9" fill="#c62828" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 36" className="pips">
      {suit === 1
        ? PIN[n].pts.map(([x, y], i) => <Pip key={i} x={x} y={y} r={PIN[n].r} red={allRed || PIN[n].red.includes(i)} />)
        : SOU[n].pts.map(([x, y], i) => <Stick key={i} x={x} y={y} h={SOU[n].h} w={SOU[n].w} red={allRed || SOU[n].red.includes(i)} />)}
    </svg>
  )
}

export function Face({ kind, red }: { kind: number; red?: boolean }) {
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
  if (s === 0) return (<><span className="idx">{numOf(kind)}</span><div className="big man" style={red ? { color: '#d01f1f' } : undefined}>{NUMS[numOf(kind) - 1]}</div><div className="big man" style={{ color: '#c62828' }}>萬</div></>)
  if (s === 1) return <><span className="idx">{numOf(kind)}</span><Pips suit={1} n={numOf(kind)} allRed={red} /></>
  if (s === 2) return <><span className="idx">{numOf(kind)}</span>{numOf(kind) === 1 ? <Bird /> : <Pips suit={2} n={numOf(kind)} allRed={red} />}</>
  const h = kind - 27
  if (h < 4) return <div className="big">{'東南西北'[h]}</div>
  if (kind === 31) return <div className="white-dragon" />
  if (kind === 32) return <div className="big" style={{ color: '#1f7a3a' }}>發</div>
  return <div className="big" style={{ color: '#c62828' }}>中</div>
}

interface Props {
  id?: number; kind?: number; back?: boolean; dora?: number
  onClick?: () => void; selected?: boolean; dim?: boolean; mark?: boolean; riichi?: boolean; hot?: boolean; title?: string
  className?: string
}
/** Rotated tile (called tile in a meld, riichi discard). `double` stacks two tiles (added kan). */
export function Side({ children, double }: { children: ReactNode; double?: boolean }) {
  return <span className={'sw' + (double ? ' dbl' : '')}>{children}</span>
}

export function Tile({ id, kind, back, dora, onClick, selected, dim, mark, riichi, hot, title, className }: Props) {
  const aka = useContext(AkaCtx)
  const k = kind ?? (id !== undefined ? kindOf(id) : 0)
  const red = aka && id !== undefined && isRedFive(id)
  const cls = ['tile', back ? 'back' : '', selected ? 'sel' : '', dim ? 'dim' : '', riichi ? 'riichi-t' : '', hot ? 'hot' : '', onClick ? 'clickable' : '', red ? 'aka' : '', className ?? ''].join(' ')
  return (
    <div className={cls} onClick={onClick} title={title}>
      {!back && <Face kind={k} red={red} />}
      {red && <span className="aka-dot" />}
      {!back && dora ? <span className="dora-badge" title="dora">★{dora > 1 ? dora : ''}</span> : null}
      {mark && <span className="mark" />}
    </div>
  )
}
