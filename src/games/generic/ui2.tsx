import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../../i18n'
import { isTouchPrimary, Kbd } from '../../ui/components'
import type { BoardProps } from './ui'
import './moreStrings'
import { Card } from '../holdem/ui/Cards'
import { HOLES } from './chinesecheckers'

const idxOf = (n: number, x: number, y: number) => y * n + x

/** the "Resign" button with its confirmation (the texts are Chess's) */
function Resign({ send }: { send(a: Record<string, unknown>): void }) {
  const { t } = useLang()
  const [ask, setAsk] = useState(false)
  return (
    <>
      <button className="hdbtn quiet" onClick={() => setAsk(true)}>
        {t('chResign')}
      </button>
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
    </>
  )
}

/* ---------------------------------------------------------------- Reversi */
export function ReversiBoard({ v, send }: BoardProps) {
  const { t } = useLang()
  const s = v.state as { board: number[]; black: number; last: number; passed: boolean; counts: [number, number]; legal: number[] }
  const mine = v.you < 0 ? 0 : v.you === s.black ? 1 : 2
  const myTurn = v.status === 'playing' && v.turn === v.you
  const ok = new Set(myTurn ? s.legal : [])
  const side = (c: number) => (c === 1 ? t('rvBlack') : t('rvWhite'))
  return (
    <div className="gmwrap">
      <div className="gmside" aria-live="polite">
        {mine > 0 && (!v.local || v.status === 'playing') && (
          <span className="gmchip">
            <i className={'gmstone s' + mine} aria-hidden="true" />
            {t(v.local ? 'chToMove' : 'rvYouAre', { side: side(mine) })}
          </span>
        )}
        <span className="gmchip">
          <i className="gmstone s1" aria-hidden="true" />
          {s.counts[0]}
        </span>
        <span className="gmchip">
          <i className="gmstone s2" aria-hidden="true" />
          {s.counts[1]}
        </span>
      </div>
      <div className="rvboard" role="grid" aria-label={t('reversi')}>
        {s.board.map((c, i) => {
          const x = i % 8,
            y = Math.floor(i / 8)
          return (
            <button
              key={i}
              className={'rvsq' + (ok.has(i) ? ' ok' : '') + (s.last === i ? ' last' : '')}
              disabled={!ok.has(i)}
              onClick={() => send({ k: 'act', a: { x, y } })}
              aria-label={`${x + 1},${y + 1}`}
            >
              {c > 0 && <i className={'rvdisc s' + c} />}
            </button>
          )
        })}
      </div>
      {s.passed && v.status === 'playing' && <p className="muted small">{t('rvPassed')}</p>}
    </div>
  )
}

/* ---------------------------------------------------------------- Checkers */
export function CheckersBoard({ v, send }: BoardProps) {
  const { t } = useLang()
  const s = v.state as {
    board: number[]
    first: number
    last: number[] | null
    moves: { from: number; to: number; via: number[]; caps: number[] }[]
    quiet: number
  }
  const side = v.you < 0 ? 0 : v.you === s.first ? 0 : 1
  const myTurn = v.status === 'playing' && v.turn === v.you
  const [sel, setSel] = useState<number | null>(null)
  useEffect(() => {
    setSel(null)
  }, [s.board.join(''), v.game])
  const froms = new Set(myTurn ? s.moves.map((m) => m.from) : [])
  const dests = sel === null ? [] : s.moves.filter((m) => m.from === sel)
  const flip = !v.local && side === 1
  const order = Array.from({ length: 64 }, (_, i) => (flip ? 63 - i : i))
  const tap = (i: number) => {
    if (!myTurn) return
    const hit = dests.find((m) => m.to === i)
    if (hit) {
      send({ k: 'act', a: { from: hit.from, to: hit.to, via: hit.via } })
      setSel(null)
      return
    }
    setSel(froms.has(i) && i !== sel ? i : null)
  }
  const mustCapture = myTurn && s.moves.some((m) => m.caps.length > 0)
  return (
    <div className="gmwrap">
      <div className="gmside" aria-live="polite">
        {v.you >= 0 && (!v.local || v.status === 'playing') && (
          <span className="gmchip">
            <i className={'ckdot p' + (side === 0 ? 1 : 3)} aria-hidden="true" />
            {t(v.local ? 'chToMove' : 'ckYouAre', { side: side === 0 ? t('ckRed') : t('ckIvory') })}
          </span>
        )}
        {mustCapture && <b>{t('ckMust')}</b>}
      </div>
      <div className="ckboard" role="grid" aria-label={t('checkers')}>
        {order.map((i) => {
          const x = i % 8,
            y = Math.floor(i / 8),
            dark = (x + y) % 2 === 1,
            p = s.board[i]
          const last = s.last && (s.last[0] === i || s.last[s.last.length - 1] === i)
          const isDest = dests.some((m) => m.to === i)
          return (
            <button
              key={i}
              className={
                'cksq' + (dark ? ' dark' : '') + (sel === i ? ' sel' : '') + (last ? ' last' : '') + (isDest ? ' tgt' : '') + (froms.has(i) ? ' mv' : '')
              }
              disabled={!dark || !myTurn}
              onClick={() => tap(i)}
              aria-label={`${x + 1},${y + 1}`}
            >
              {p > 0 && <i className={'ckp p' + p}>{p === 2 || p === 4 ? '♛' : ''}</i>}
            </button>
          )
        })}
      </div>
      <div className="chfoot">
        {myTurn && !sel && <span className="muted small">{t('ckSelect')}</span>}
        {v.you >= 0 && v.status === 'playing' && <Resign send={send} />}
      </div>
    </div>
  )
}

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

/* ---------------------------------------------------------------- Hearts and Spades share one table */
const SUITCH = '♠♥♦♣'
function Trick({ v, cards, you }: { v: BoardProps['v']; cards: { seat: number; card: number }[]; you: number }) {
  const at = (rel: number) => cards.find((c) => (c.seat - Math.max(0, you) + 4) % 4 === rel)
  return (
    <div className="tkcross">
      {[2, 1, 3, 0].map((rel) => (
        <div key={rel} className={'tkslot r' + rel}>
          {at(rel) ? <Card c={at(rel)!.card} /> : <span className="pkslot" aria-hidden="true" />}
        </div>
      ))}
      <span hidden>{v.game}</span>
    </div>
  )
}
function HandRow({
  hand,
  legal,
  enabled,
  onTap,
  picked,
}: {
  hand: number[]
  legal: Set<number> | null
  enabled: boolean
  onTap(c: number): void
  picked?: number[]
}) {
  return (
    <div className="tkhand">
      {hand.map((c) => {
        const ok = enabled && (legal ? legal.has(c) : true)
        return (
          <button
            key={c}
            className={'tkcard' + (ok ? ' ok' : enabled ? ' dim' : '') + (picked?.includes(c) ? ' sel' : '')}
            disabled={!ok}
            onClick={() => onTap(c)}
          >
            <Card c={c} />
          </button>
        )
      })}
    </div>
  )
}
function Around({ v, name, extra }: { v: BoardProps['v']; name: BoardProps['name']; extra(seat: number): string }) {
  const you = Math.max(0, v.you)
  const pos = ['tkb', 'tkl', 'tkt', 'tkr']
  return (
    <>
      {[2, 1, 3].map((rel) => {
        const seat = (you + rel) % 4
        return (
          <div key={rel} className={'tkseat ' + pos[rel] + (v.turn === seat ? ' turn' : '')}>
            <b>{name(v.seats[seat].name)}</b>
            <span>{extra(seat)}</span>
          </div>
        )
      })}
    </>
  )
}

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
  const passing = s.phase === 'pass' && myTurn
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
        <div className="tkmid">{s.phase === 'pass' ? <span className="tkhint">{t('htPick')}</span> : <Trick v={v} cards={showTrick} you={v.you} />}</div>
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
      <span hidden>{SUITCH}</span>
    </div>
  )
}
export { idxOf }
