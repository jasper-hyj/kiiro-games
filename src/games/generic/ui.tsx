import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { useLang } from '../../i18n'
import { Hotkeys, isTouchPrimary, Kbd } from '../../ui/components'
import type { PlayViewX } from './client'
import type { GenericGame } from './kinds'
import './gomokuStrings'
import './crazyStrings'
import './yahtzeeStrings'
import './liarsStrings'
import './chessStrings'
import { name as sqName, parseSq } from './chessrules'
import { CATS } from './yahtzee'
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


/* ---------------------------------------------------------------- Yahtzee */
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
function Die({ n, held, live, onClick }: { n: number; held: boolean; live: boolean; onClick(): void }) {
  return (
    <button className={'yzdie' + (held ? ' held' : '') + (live ? ' live' : '')} disabled={!live} onClick={onClick} aria-pressed={held} aria-label={String(n)}>
      {n > 0 && Array.from({ length: 9 }, (_, i) => <i key={i} className={PIPS[n].includes(i) ? 'on' : ''} />)}
    </button>
  )
}
function YahtzeeBoard({ v, send, name }: BoardProps) {
  const { t } = useLang()
  const s = v.state as { dice: number[]; rolls: number; round: number; sheets: (number | null)[][]; totals: { upper: number; bonus: number; yahtzeeBonus: number; total: number }[]; options: Record<string, number>; last: { seat: number; cat: string; points: number } | null; joker: boolean }
  const myTurn = v.status === 'playing' && v.turn === v.you
  const [held, setHeld] = useState<boolean[]>([false, false, false, false, false])
  useEffect(() => { setHeld([false, false, false, false, false]) }, [v.turn, s.rolls === 0, v.game])
  const dice = s.dice.length === 5 ? s.dice : [0, 0, 0, 0, 0]
  const canRoll = myTurn && s.rolls < 3
  const roll = () => { if (canRoll) send({ k: 'act', a: { roll: true, held } }) }
  const toggle = (i: number) => { if (myTurn && s.rolls > 0 && s.rolls < 3) setHeld((h) => h.map((x, k) => (k === i ? !x : x))) }
  const score = (cat: string) => { if (myTurn && s.rolls > 0 && cat in s.options) send({ k: 'act', a: { score: cat } }) }
  const keys: Record<string, (() => void) | undefined> = { r: roll, enter: roll }
  for (let i = 0; i < 5; i++) keys[String(i + 1)] = () => toggle(i)
  const upper = CATS.slice(0, 6), lower = CATS.slice(6)
  const cell = (seat: number, cat: string, idx: number) => {
    const val = s.sheets[seat]?.[idx]
    if (val !== null && val !== undefined) return <td key={seat} className={'yzv' + (seat === v.you ? ' me' : '')}>{val}</td>
    if (seat === v.you && myTurn && cat in s.options) return <td key={seat} className="yzv me opt"><button onClick={() => score(cat)} aria-label={`${t('yz.' + cat)} ${s.options[cat]}`}>{s.options[cat]}</button></td>
    return <td key={seat} className={'yzv' + (seat === v.you ? ' me' : '')} />
  }
  const row = (cat: string, idx: number) => <tr key={cat}><th>{t('yz.' + cat)}</th>{v.seats.map((x) => cell(x.seat, cat, idx))}</tr>
  const last = s.last ? t('yzLast', { name: name(v.seats[s.last.seat].name), n: s.last.points, cat: t('yz.' + s.last.cat) }) : ''
  return (
    <div className="yz">
      <Hotkeys enabled={myTurn} keys={keys} />
      <div className="muted small">{t('yzRound', { n: s.round })}{last ? ` · ${last}` : ''}</div>
      <div className="yzdice k-felt">
        <div className="yzrow">{dice.map((d, i) => <Die key={i} n={d} held={held[i] && s.rolls > 0} live={myTurn && s.rolls > 0 && s.rolls < 3} onClick={() => toggle(i)} />)}</div>
        {v.you >= 0 && (
          <div className="yzctl">
            <button className="hdbtn primary" disabled={!canRoll} onClick={roll}>{t('yzRoll')}<Kbd k="R" /></button>
            <span className="muted small">{myTurn ? (s.rolls === 0 ? t('yzFirst') : s.rolls < 3 ? `${t('yzRollsLeft', { n: 3 - s.rolls })} · ${t('yzHold')}` : t('yzScoreIt')) : ''}</span>
          </div>
        )}
        {myTurn && s.joker && <p className="muted small">{t('yzJoker')}</p>}
      </div>
      <div className="yzsheet"><table>
        <thead><tr><th />{v.seats.map((x) => <th key={x.seat} className={x.me ? 'me' : v.turn === x.seat ? 'turn' : ''}>{name(x.name)}</th>)}</tr></thead>
        <tbody>
          {upper.map((c, i) => row(c, i))}
          <tr className="sub"><th>{t('yzUpper')}</th>{v.seats.map((x) => <td key={x.seat}>{s.totals[x.seat].upper}</td>)}</tr>
          <tr className="sub"><th>{t('yzBonus')}</th>{v.seats.map((x) => <td key={x.seat}>{s.totals[x.seat].bonus || ''}</td>)}</tr>
          {lower.map((c, i) => row(c, i + 6))}
          <tr className="sub"><th>{t('yzYBonus')}</th>{v.seats.map((x) => <td key={x.seat}>{s.totals[x.seat].yahtzeeBonus || ''}</td>)}</tr>
          <tr className="tot"><th>{t('yzTotal')}</th>{v.seats.map((x) => <td key={x.seat}>{s.totals[x.seat].total}</td>)}</tr>
        </tbody>
      </table></div>
    </div>
  )
}


/* ---------------------------------------------------------------- Liar's Dice */
function MiniDie({ n, size = 34 }: { n: number; size?: number }) {
  return <span className="ldmini" style={{ width: size, height: size }} aria-label={String(n)}>{Array.from({ length: 9 }, (_, i) => <i key={i} className={PIPS[n]?.includes(i) ? 'on' : ''} />)}</span>
}
function LiarsBoard({ v, send, name }: BoardProps) {
  const { t } = useLang()
  const s = v.state as { left: number[]; mine: number[]; bid: { seat: number; qty: number; face: number } | null; round: number; reveal: { bid: { seat: number; qty: number; face: number }; caller: number; dice: number[][]; total: number; liar: boolean; loser: number } | null; out: number[]; wild: boolean; total: number; dice: number[][] | null }
  const myTurn = v.status === 'playing' && v.turn === v.you
  const minQty = (face: number) => (!s.bid ? 1 : face > s.bid.face ? s.bid.qty : s.bid.qty + 1)
  const [face, setFace] = useState(2)
  const [qty, setQty] = useState(1)
  const bidKey = s.bid ? `${s.bid.qty}-${s.bid.face}` : 'none'
  // after every bid, offer the smallest raise: the next face up, or one more die when the face is already a six
  useEffect(() => { if (!s.bid) { setFace(2); setQty(1) } else if (s.bid.face < 6) { setFace(s.bid.face + 1); setQty(s.bid.qty) } else { setFace(6); setQty(s.bid.qty + 1) } }, [bidKey, v.game])
  const q = Math.min(s.total, Math.max(qty, minQty(face)))
  const bid = () => { if (myTurn) send({ k: 'act', a: { qty: q, face } }) }
  const liar = () => { if (myTurn && s.bid) send({ k: 'act', a: { liar: true } }) }
  const nm = (seat: number) => name(v.seats[seat].name)
  const rv = s.reveal
  return (
    <div className="ld">
      <Hotkeys enabled={myTurn} keys={{ l: liar, enter: bid, arrowup: () => setQty(q + 1), arrowdown: () => setQty(Math.max(minQty(face), q - 1)) }} />
      <div className="ldplayers">
        {v.seats.map((x) => (
          <div key={x.seat} className={'ldp' + (v.turn === x.seat ? ' turn' : '') + (s.left[x.seat] === 0 ? ' out' : '') + (x.me ? ' me' : '')}>
            <b>{name(x.name)}</b>
            <span className="ldcup">{s.left[x.seat] === 0 ? t('ldOutTag') : Array.from({ length: s.left[x.seat] }, (_, i) => <i key={i} />)}</span>
            <span className="muted small">{t('ldLeft', { n: s.left[x.seat] })}</span>
          </div>
        ))}
      </div>
      <div className="ldbid k-felt" aria-live="polite">
        <span className="muted small">{t('ldRound', { n: s.round })}{s.wild ? ` · ${t('ldWildNote')}` : ''}</span>
        {s.bid ? <div className="ldbidline"><span>{nm(s.bid.seat)}</span><b>{s.bid.qty} ×</b><MiniDie n={s.bid.face} size={44} /></div> : v.status === 'playing' ? <span>{t('ldNoBid')}</span> : null}
      </div>
      {rv && (
        <div className="ldreveal">
          <b>{t('ldRevealTitle')}</b>
          <p className="small">{t('ldReveal', { caller: nm(rv.caller), bidder: nm(rv.bid.seat), qty: rv.bid.qty, face: rv.bid.face, total: rv.total, loser: nm(rv.loser) })}</p>
          <div className="ldrows">{rv.dice.map((d, i) => d.length ? <div key={i} className="ldrow"><span className="small">{nm(i)}</span><span>{d.map((x, k) => <i key={k} className={'ldr' + (x === rv.bid.face || (s.wild && rv.bid.face !== 1 && x === 1) ? ' hit' : '')}><MiniDie n={x} size={26} /></i>)}</span></div> : null)}</div>
        </div>
      )}
      {v.you >= 0 && s.mine.length > 0 && <div className="ldmine"><span className="muted small">{t('ldYourDice')}</span><div className="yzrow">{s.mine.map((d, i) => <MiniDie key={i} n={d} size={46} />)}</div></div>}
      {myTurn && (
        <div className="ldctl">
          <div className="ldqty"><button onClick={() => setQty(Math.max(minQty(face), q - 1))} aria-label="−">−</button><b>{q}</b><button onClick={() => setQty(Math.min(s.total, q + 1))} aria-label="+">+</button></div>
          <div className="ldfaces" role="group" aria-label={t('ldFace')}>{[1, 2, 3, 4, 5, 6].map((f) => <button key={f} className={f === face ? 'on' : ''} onClick={() => { setFace(f); setQty(Math.max(minQty(f), q)) }} aria-pressed={f === face}><MiniDie n={f} size={36} /></button>)}</div>
          <div className="ldbtns"><button className="hdbtn primary" onClick={bid}>{t('ldBid')} {q} × {face}<Kbd k="↵" /></button>{s.bid && <button className="hdbtn" onClick={liar}>{t('ldLiar')}<Kbd k="L" /></button>}</div>
        </div>
      )}
    </div>
  )
}


/* ---------------------------------------------------------------- Chess */
const GLYPH = ['', '♟', '♞', '♝', '♜', '♛', '♚']
function ChessBoard({ v, send }: BoardProps) {
  const { t } = useLang()
  const s = v.state as { board: number[]; white: number; color: 1 | -1 | 0; toMove: 1 | -1; last: [number, number] | null; check: number; moves: string[]; targets: Record<string, string[]>; promos: string[]; end: { over: boolean; result: string } | null }
  const myTurn = v.status === 'playing' && v.turn === v.you
  const flip = s.color === -1
  const [sel, setSel] = useState<string | null>(null)
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null)
  const [ask, setAsk] = useState(false)
  useEffect(() => { setSel(null); setPromo(null) }, [s.moves.length, v.game])
  const targets = sel ? s.targets[sel] ?? [] : []
  const tap = (sq: number) => {
    if (!myTurn) return
    const n = sqName(sq)
    if (sel && targets.includes(n)) {
      if (s.promos.includes(sel + n)) setPromo({ from: sel, to: n })
      else { send({ k: 'act', a: { from: sel, to: n } }); setSel(null) }
      return
    }
    setSel(n in s.targets && n !== sel ? n : null)
  }
  const order = Array.from({ length: 64 }, (_, i) => i).map((i) => { const r = 7 - (i >> 3), f = i & 7; return flip ? (7 - r) * 8 + (7 - f) : r * 8 + f })
  const side = (c: number) => (c === 1 ? t('chWhite') : t('chBlack'))
  const pairs: string[] = []; for (let i = 0; i < s.moves.length; i += 2) pairs.push(`${i / 2 + 1}. ${s.moves[i]}${s.moves[i + 1] ? ' ' + s.moves[i + 1] : ''}`)
  const endText = s.end ? ({ mate: t('chMate'), stalemate: t('chStalemate'), insufficient: t('chInsufficient'), fifty: t('chFifty'), repetition: t('chRepetition'), resign: t('chResigned'), cap: t('chCap') } as Record<string, string>)[s.end.result] : ''
  return (
    <div className="ch">
      <div className="gmside">
        {s.color !== 0 && <span className="gmchip"><i className={'gmstone s' + (s.color === 1 ? 2 : 1)} aria-hidden="true" />{t('chYouAre', { side: side(s.color) })}</span>}
        {v.status === 'playing' && <span className="muted small">{t('chToMove', { side: side(s.toMove) })}{s.check >= 0 ? ` · ${t('chCheck')}` : ''}</span>}
        {endText && <b>{endText}</b>}
      </div>
      <div className="chboard" role="grid" aria-label={t('chess')}>
        {order.map((sq) => {
          const x = s.board[sq], dark = ((sq & 7) + (sq >> 3)) % 2 === 0, n = sqName(sq)
          const cls = 'chsq' + (dark ? ' dark' : '') + (sel === n ? ' sel' : '') + (s.last && (s.last[0] === sq || s.last[1] === sq) ? ' last' : '') + (s.check === sq ? ' check' : '') + (targets.includes(n) ? (x ? ' cap' : ' tgt') : '')
          return <button key={sq} className={cls} onClick={() => tap(sq)} aria-label={n + (x ? ' ' + GLYPH[Math.abs(x)] : '')} disabled={!myTurn}>{x ? <span className={'chp ' + (x > 0 ? 'w' : 'b')}>{GLYPH[Math.abs(x)]}</span> : null}</button>
        })}
      </div>
      <div className="chfoot">
        {myTurn && !sel && <span className="muted small">{t('chSelect')}</span>}
        {v.you >= 0 && v.status === 'playing' && <button className="hdbtn quiet" onClick={() => setAsk(true)}>{t('chResign')}</button>}
      </div>
      {pairs.length > 0 && <div className="chmoves" aria-label={t('chMoves')}>{pairs.map((p, i) => <span key={i}>{p}</span>)}</div>}
      {promo && (
        <div className="acmodal" onClick={() => setPromo(null)}>
          <div className="acbox" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('chPromote')}>
            <h2>{t('chPromote')}</h2>
            <div className="c8suits">{[['q', 5], ['r', 4], ['b', 3], ['n', 2]].map(([k, n]) => <button key={k as string} onClick={() => { send({ k: 'act', a: { from: promo.from, to: promo.to, promo: k } }); setPromo(null); setSel(null) }}>{GLYPH[n as number].replace('♟', '♟')}</button>)}</div>
          </div>
        </div>
      )}
      {ask && (
        <div className="acmodal" onClick={() => setAsk(false)}>
          <div className="acbox" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('chResignAsk')}>
            <h2>{t('chResignAsk')}</h2>
            <div className="acrow"><button className="ghost" onClick={() => setAsk(false)}>{t('chNo')}</button><button className="primary" onClick={() => { send({ k: 'act', a: { resign: true } }); setAsk(false) }}>{t('chYes')}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

export const GAME_UI: Record<GenericGame, GameUI> = {
  chess: { name: 'chess', blurb: 'chessBlurb', settings: (c, t) => [t(c.level === 'easy' ? 'chEasy' : c.level === 'hard' ? 'chHard' : 'chNormal')], help: { title: 'chHow', lines: ['chR1', 'chR2', 'chR3', 'chR4'] }, Board: ChessBoard },
  liarsdice: { name: 'liarsdice', blurb: 'liarsdiceBlurb', settings: (c, t) => [`${c.players}`, c.wild ? t('ldWildOn') : t('ldWildOff')], help: { title: 'ldHow', lines: ['ldR1', 'ldR2', 'ldR3', 'ldR4', 'ldR5'] }, Board: LiarsBoard },
  yahtzee: { name: 'yahtzee', blurb: 'yahtzeeBlurb', settings: (c) => [`${c.players}`], help: { title: 'yzHow', lines: ['yzR1', 'yzR2', 'yzR3', 'yzR4', 'yzR5'] }, Board: YahtzeeBoard },
  crazyeights: { name: 'crazyeights', blurb: 'crazyeightsBlurb', settings: (c, t) => [`${c.players}`, c.action ? t('c8Actions') : t('c8Classic')], help: { title: 'c8How', lines: ['c8R1', 'c8R2', 'c8R3', 'c8R4', 'c8R5'] }, Board: CrazyBoard },
  gomoku: { name: 'gomoku', blurb: 'gomokuBlurb', settings: (c) => [`${c.size} × ${c.size}`], help: { title: 'gmHow', lines: ['gmR1', 'gmR2', 'gmR3', 'gmR4'] }, Board: GomokuBoard },
}
/** the settings each game offers in the room (labels are string keys), taken from the engine's meta */
export { METAS } from './registry'
