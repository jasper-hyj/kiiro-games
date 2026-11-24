import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { useLang } from '../../i18n'
import { Hotkeys, isTouchPrimary, Kbd } from '../../ui/components'
import type { PlayViewX } from './client'
import type { GenericGame } from './kinds'
import './gomokuStrings'
import './crazyStrings'
import { Card } from '../holdem/ui/Cards'
import { rankOf, suitOf, SUITS } from '../holdem/engine/cards'

export interface BoardProps { v: PlayViewX; send(a: Record<string, unknown>): void; name(n: string): string }
export interface GameUI { name: string; blurb: string; /** short chips describing the settings of this table */ settings(cfg: Record<string, any>, t: (k: string) => string): string[]; help: { title: string; lines: string[] }; Board: ComponentType<BoardProps> }

/* ---------------------------------------------------------------- Gomoku */
function GomokuBoard({ v, send }: BoardProps) {
  const { t } = useLang()
  const s = v.state as { size: number; board: number[]; black: number; last: [number, number] | null; win: [number, number][] | null }
  const n = s.size
  const mine = v.you === s.black ? 1 : v.you >= 0 ? 2 : 0
  const myTurn = v.status === 'playing' && v.turn === v.you
  const touch = useMemo(() => isTouchPrimary(), [])
  const [pick, setPick] = useState<[number, number] | null>(null)
  const [hover, setHover] = useState<[number, number] | null>(null)
  const win = useMemo(() => new Set((s.win ?? []).map(([x, y]) => `${x},${y}`)), [s.win])
  const place = (x: number, y: number) => { setPick(null); send({ k: 'act', a: { x, y } }) }
  const tap = (x: number, y: number) => {
    if (!myTurn || s.board[y * n + x] !== 0) return
    if (!touch || (pick && pick[0] === x && pick[1] === y)) place(x, y)
    else setPick([x, y])
  }
  const pad = 1, size = n - 1 + pad * 2
  const stars = n === 19 ? [3, 9, 15] : [3, 7, 11]
  const sideName = (side: number) => (side === 1 ? t('gmBlack') : t('gmWhite'))
  return (
    <div className="gmwrap">
      <div className="gmside" aria-live="polite">
        {mine > 0 ? <span className="gmchip"><i className={'gmstone s' + mine} aria-hidden="true" />{t('gmYouAre', { side: sideName(mine) })}</span> : null}
        {v.status === 'playing' && <span className="muted small"><i className={'gmstone s' + (v.turn === s.black ? 1 : 2)} aria-hidden="true" /> {sideName(v.turn === s.black ? 1 : 2)}</span>}
      </div>
      <svg className="gmboard" viewBox={`0 0 ${size} ${size}`} role="grid" aria-label={t('gomoku')}>
        <rect x="0" y="0" width={size} height={size} rx="0.6" className="gmwood" />
        {Array.from({ length: n }, (_, i) => <g key={i}><line x1={pad} y1={pad + i} x2={pad + n - 1} y2={pad + i} className="gmline" /><line x1={pad + i} y1={pad} x2={pad + i} y2={pad + n - 1} className="gmline" /></g>)}
        {stars.flatMap((a) => stars.map((b) => <circle key={`${a}-${b}`} cx={pad + a} cy={pad + b} r="0.12" className="gmstar" />))}
        {s.board.map((c, i) => {
          const x = i % n, y = Math.floor(i / n)
          if (!c) return <rect key={i} x={pad + x - 0.5} y={pad + y - 0.5} width="1" height="1" className="gmhit" onPointerEnter={() => myTurn && setHover([x, y])} onPointerLeave={() => setHover(null)} onClick={() => tap(x, y)} />
          return <g key={i} className={win.has(`${x},${y}`) ? 'gmwin' : ''}><circle cx={pad + x} cy={pad + y} r="0.46" className={'gmst s' + c} />{s.last && s.last[0] === x && s.last[1] === y && <circle cx={pad + x} cy={pad + y} r="0.16" className="gmlast" />}</g>
        })}
        {pick && <circle cx={pad + pick[0]} cy={pad + pick[1]} r="0.42" className={'gmghost s' + mine} />}
        {!touch && hover && myTurn && s.board[hover[1] * n + hover[0]] === 0 && <circle cx={pad + hover[0]} cy={pad + hover[1]} r="0.4" className={'gmghost s' + mine} />}
      </svg>
      {touch && myTurn && <div className="gmconfirm">{pick ? <button className="hdbtn primary" onClick={() => place(pick[0], pick[1])}>{t('gmPlace')}<Kbd k="↵" /></button> : <span className="muted small">{t('gmTapAgain')}</span>}</div>}
    </div>
  )
}


/* ---------------------------------------------------------------- Crazy Eights */
const SUIT_RED = [false, true, true, false]
function CrazyBoard({ v, send, name }: BoardProps) {
  const { t } = useLang()
  const s = v.state as { hand: number[]; counts: number[]; top: number; suit: number; dir: 1 | -1; drawCount: number; drew: boolean; playable: number[]; last: { seat: number; what: string; card?: number } | null; winner: number; hands: number[][] | null }
  const myTurn = v.status === 'playing' && v.turn === v.you
  const [choose, setChoose] = useState<number | null>(null)
  useEffect(() => { setChoose(null) }, [v.turn, v.game])
  const hand = useMemo(() => [...s.hand].sort((a, b) => suitOf(a) - suitOf(b) || rankOf(a) - rankOf(b)), [s.hand])
  const ok = new Set(s.playable)
  const canDraw = myTurn && !s.drew
  const mustPass = myTurn && s.drew && s.playable.length === 0
  const play = (c: number) => { if (!myTurn || !ok.has(c)) return; if (rankOf(c) === 6) setChoose(c); else send({ k: 'act', a: { card: c } }) }
  const draw = () => { if (canDraw) send({ k: 'act', a: { draw: true } }) }
  const pass = () => { if (mustPass) send({ k: 'act', a: { pass: true } }) }
  const last = s.last ? (s.last.what === 'play' ? <>{t('c8LastPlay', { name: name(v.seats[s.last.seat].name) })} <Card c={s.last.card} small /></> : s.last.what === 'draw' ? t('c8LastDraw', { name: name(v.seats[s.last.seat].name) }) : t('c8LastPass', { name: name(v.seats[s.last.seat].name) })) : null
  return (
    <div className="c8">
      <Hotkeys enabled={myTurn} keys={{ d: draw, p: pass }} />
      <div className="c8others">
        {v.seats.filter((x) => !x.me).map((x) => <div key={x.seat} className={'c8opp' + (v.turn === x.seat ? ' turn' : '')}><b>{name(x.name)}</b><span className="c8fan">{Array.from({ length: Math.min(s.counts[x.seat], 9) }, (_, i) => <i key={i} className="pkcard back small" />)}</span><span className="muted small">{s.counts[x.seat] === 1 ? t('c8Card1') : t('c8Cards', { n: s.counts[x.seat] })}</span></div>)}
      </div>
      <div className="c8table k-felt">
        <button className={'c8pile' + (canDraw ? ' live' : '')} disabled={!canDraw} onClick={draw} aria-label={t('c8Draw')}>
          <Card back /><span className="c8count">{s.drawCount}</span><span className="c8lbl">{t('c8Draw')}<Kbd k="D" /></span>
        </button>
        <div className="c8top"><Card c={s.top} /><span className={'c8suit' + (SUIT_RED[s.suit] ? ' red' : '')} title={t('c8Suit')}>{SUITS[s.suit]}</span><span className="c8lbl">{t('c8Top')}</span></div>
        <div className="c8dir" title={t('c8Dir')} aria-hidden="true">{s.dir === 1 ? '↻' : '↺'}</div>
      </div>
      <div className="c8last muted small" aria-live="polite">{last}</div>
      {v.you >= 0 && (
        <>
          <div className="c8msg">{myTurn ? (mustPass ? t('c8DrewNone') : t('c8Playable')) : ''}{mustPass && <button className="hdbtn primary" onClick={pass}>{t('c8Pass')}<Kbd k="P" /></button>}</div>
          <div className="c8hand" role="group" aria-label={t('c8Hand')}>
            {hand.map((c) => <button key={c} className={'c8card' + (ok.has(c) && myTurn ? ' ok' : '') + (myTurn && !ok.has(c) ? ' dim' : '')} disabled={!myTurn || !ok.has(c)} onClick={() => play(c)}><Card c={c} /></button>)}
          </div>
        </>
      )}
      {choose !== null && (
        <div className="acmodal" onClick={() => setChoose(null)}>
          <div className="acbox" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('c8Choose')}>
            <h2>{t('c8Choose')}</h2>
            <div className="c8suits">{[0, 1, 2, 3].map((u) => <button key={u} className={SUIT_RED[u] ? 'red' : ''} onClick={() => { send({ k: 'act', a: { card: choose, suit: u } }); setChoose(null) }}>{SUITS[u]}</button>)}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export const GAME_UI: Record<GenericGame, GameUI> = {
  crazyeights: { name: 'crazyeights', blurb: 'crazyeightsBlurb', settings: (c, t) => [`${c.players}`, c.action ? t('c8Actions') : t('c8Classic')], help: { title: 'c8How', lines: ['c8R1', 'c8R2', 'c8R3', 'c8R4', 'c8R5'] }, Board: CrazyBoard },
  gomoku: { name: 'gomoku', blurb: 'gomokuBlurb', settings: (c) => [`${c.size} × ${c.size}`], help: { title: 'gmHow', lines: ['gmR1', 'gmR2', 'gmR3', 'gmR4'] }, Board: GomokuBoard },
}
/** the settings each game offers in the room (labels are string keys), taken from the engine's meta */
export { METAS } from './registry'
