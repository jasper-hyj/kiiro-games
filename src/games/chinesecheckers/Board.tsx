import { useEffect, useState } from 'react'
import { useLang } from '../../i18n'
import { HOLES } from './engine'
import type { BoardProps } from '../frame/types'
import './strings'
import './styles.css'

/* ---------------------------------------------------------------- Chinese Checkers */
const CC_COLOURS = ['#b5523a', '#d9a73c', '#4f6d8f', '#8a5a83', '#34363f', '#f1e6cb']
const CC_KEYS = ['ccBrick', 'ccOchre', 'ccBlue', 'ccPlum', 'ccInk', 'ccIvory']
// pixel position of every hole: x and y are the first two cube coordinates, laid out on a hexagonal grid
const PX = HOLES.map(([x, y]) => [Math.sqrt(3) * (x + y / 2), 1.5 * y] as const)
const MINX = Math.min(...PX.map((p) => p[0])),
  MAXX = Math.max(...PX.map((p) => p[0])),
  MINY = Math.min(...PX.map((p) => p[1])),
  MAXY = Math.max(...PX.map((p) => p[1]))
export function ChineseCheckersBoard({ v, send, name }: BoardProps) {
  const { t } = useLang()
  const s = v.state as {
    cells: number[]
    n: number
    camps: number[]
    last: [number, number] | null
    moves: number
    winner: number
    dests: Record<string, number[]>
  }
  const myTurn = v.status === 'playing' && v.turn === v.you
  const [sel, setSel] = useState<number | null>(null)
  useEffect(() => {
    setSel(null)
  }, [s.moves, v.game])
  const colourOf = (seat: number) => CC_COLOURS[s.camps[seat]]
  const dests = sel === null ? [] : (s.dests[sel] ?? [])
  const tap = (i: number) => {
    if (!myTurn) return
    if (sel !== null && dests.includes(i)) {
      send({ k: 'act', a: { from: sel, to: i } })
      setSel(null)
      return
    }
    setSel(s.cells[i] === v.you && s.dests[i] && i !== sel ? i : null)
  }
  const pad = 0.8
  const vb = `${MINX - pad} ${MINY - pad} ${MAXX - MINX + pad * 2} ${MAXY - MINY + pad * 2}`
  const home = (seat: number) => {
    const target = (s.camps[seat] + 3) % 6
    return HOLES.reduce((a, h, i) => a + (s.cells[i] === seat && inCamp(h, target) ? 1 : 0), 0)
  }
  return (
    <div className="gmwrap">
      <div className="ccseats" aria-live="polite">
        {v.seats.map((st) => (
          <span key={st.seat} className={'gmchip' + (v.turn === st.seat ? ' turn' : '')}>
            <i className="ccdot" style={{ background: colourOf(st.seat) }} aria-hidden="true" />
            {name(st.name)}
            {st.me ? ` (${t('plYou')})` : ''} <small>{t('ccHome', { n: home(st.seat) })}</small>
          </span>
        ))}
      </div>
      <svg className="ccboard" viewBox={vb} role="grid" aria-label={t('chinesecheckers')}>
        {HOLES.map((_, i) => {
          const [px, py] = PX[i],
            c = s.cells[i]
          const campOwner = s.camps.findIndex((cm) => inCamp(HOLES[i], cm))
          const live = myTurn && ((c === v.you && !!s.dests[i]) || dests.includes(i))
          return (
            <g key={i} onClick={() => tap(i)} className={live ? 'cclive' : ''}>
              <circle cx={px} cy={py} r="0.62" className="cchole" style={campOwner >= 0 ? { fill: CC_COLOURS[campOwner] + '40' } : undefined} />
              {c >= 0 && (
                <circle
                  cx={px}
                  cy={py}
                  r="0.5"
                  className={'ccmarble' + (s.camps[c] === 5 ? ' light' : '') + (sel === i ? ' sel' : '')}
                  style={{ fill: colourOf(c) }}
                />
              )}
              {dests.includes(i) && <circle cx={px} cy={py} r="0.28" className="ccdest" />}
              {s.last && s.last[1] === i && <circle cx={px} cy={py} r="0.16" className="gmlast" />}
              <circle cx={px} cy={py} r="0.86" fill="transparent" />
            </g>
          )
        })}
      </svg>
      <div className="chfoot">
        {myTurn && sel === null && <span className="muted small">{t('ccSelect')}</span>}
        {v.you >= 0 && !v.local && <span className="muted small">{t('ccYou', { colour: t(CC_KEYS[s.camps[v.you]]) })}</span>}
      </div>
    </div>
  )
}
const CAMP_TEST: ((h: readonly number[]) => boolean)[] = [
  (h) => h[0] >= 5,
  (h) => h[2] <= -5,
  (h) => h[1] >= 5,
  (h) => h[0] <= -5,
  (h) => h[2] >= 5,
  (h) => h[1] <= -5,
]
const inCamp = (h: readonly number[], camp: number) => CAMP_TEST[camp](h)
