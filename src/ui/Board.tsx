import { useEffect, useMemo, useState } from 'react'
import type { TableView, PlayerView } from '../engine/table'
import type { Meld } from '../engine/game'
import { kindOf } from '../engine/tiles'
import type { ClientMsg } from '../net/protocol'
import { Tile } from './Tile'
import { ResultModal } from './ResultModal'

const WINDS = ['E', 'S', 'W', 'N']
const WIND_FULL = ['East', 'South', 'West', 'North']

function MeldView({ m }: { m: Meld }) {
  const tiles = m.type === 'ankan' ? [0, 1, 2, 3].map((i) => ({ id: m.tiles[i], back: i === 0 || i === 3 })) : m.tiles.map((id) => ({ id, back: false }))
  return (
    <div className="meld">
      {tiles.map((t, i) => <Tile key={i} id={t.id} back={t.back} hot={m.called === t.id} />)}
    </div>
  )
}

function Chip({ p, v }: { p: PlayerView; v: NonNullable<TableView['game']> }) {
  const turn = v.phase === 'turn' && v.turn === p.seat
  return (
    <div className={'chip' + (turn ? ' turn' : '')}>
      <span className={'wind' + (p.seat === v.dealer ? ' dealer' : '')}>{WINDS[p.seatWind]}</span>
      <span>{p.name}{!p.connected && p.human ? ' (away)' : ''}</span>
      <span className="pts">{p.points}</span>
      {p.riichi && <span className="riichi-stick" title="Riichi" />}
    </div>
  )
}

function Pond({ p, v, rel }: { p: PlayerView; v: NonNullable<TableView['game']>; rel: number }) {
  return (
    <div className={`pond p${rel}`}>
      {p.discards.map((d, i) => {
        const last = v.lastDiscard?.from === p.seat && i === p.discards.length - 1 && v.phase !== 'turn'
        return <Tile key={i} id={d.tile} riichi={d.riichi} className={(d.called ? 'called ' : '') + (last ? 'last' : '')} />
      })}
    </div>
  )
}

function Opp({ p, v, pos }: { p: PlayerView; v: NonNullable<TableView['game']>; pos: 'top' | 'left' | 'right' }) {
  const extra = v.phase === 'turn' && v.turn === p.seat && p.hand === null ? 1 : 0
  return (
    <div className={`seat ${pos}`}>
      <Chip p={p} v={v} />
      <div className="backs">
        {p.hand
          ? [...p.hand.map((id) => <Tile key={id} id={id} />), ...(p.drawn !== null ? [<span key="g" className="gap" />, <Tile key="d" id={p.drawn} />] : [])]
          : [...Array(p.handCount)].map((_, i) => <Tile key={i} back />)}
        {extra ? <><span className="gap" /><Tile back /></> : null}
      </div>
      <div className="melds">{p.melds.map((m, i) => <MeldView key={i} m={m} />)}</div>
      {(p.flowers.length > 0 || p.nuki.length > 0) && <div className="flowers">{[...p.flowers, ...p.nuki].map((f) => <Tile key={f} id={f} />)}</div>}
    </div>
  )
}

export function Board({ view, send, hints, setHints, onLeave }: {
  view: TableView; send: (m: ClientMsg) => void; hints: boolean; setHints: (b: boolean) => void; onLeave: () => void
}) {
  const v = view.game!
  const you = Math.max(0, view.you)
  const n = v.players.length
  const rel = (r: number) => v.players[(you + r) % n]
  const sanma = n === 3
  const me = rel(0)
  const [sel, setSel] = useState<number | null>(null)
  const [riichiMode, setRiichiMode] = useState(false)
  const o = v.turnOptions
  useEffect(() => { setSel(null); setRiichiMode(false) }, [v.handNo, v.turn, v.phase, me.drawn, me.hand?.length])

  // ----- Mahjong Soul style automation -----
  const [auto, setAutoState] = useState<{ win: boolean; discard: boolean; skip: boolean }>(() => {
    try { if (new URLSearchParams(location.search).has('auto')) throw 0; return JSON.parse(localStorage.getItem('kiiro-auto') ?? '') } catch { return { win: true, discard: new URLSearchParams(location.search).has('auto'), skip: false } }
  })
  const setAuto = (k: 'win' | 'discard' | 'skip') => {
    const n = { ...auto, [k]: !auto[k] }
    setAutoState(n)
    try { localStorage.setItem('kiiro-auto', JSON.stringify(n)) } catch { /* ignore */ }
  }
  const reaction = v.reaction
  useEffect(() => {
    let a: ClientMsg | null = null
    let delay = 350
    if (o?.tsumo && auto.win) a = { t: 'act', a: { type: 'tsumo' } }
    else if (reaction?.ron && auto.win) a = { t: 'decide', d: { type: 'ron' } }
    else if (reaction && !reaction.ron && auto.skip) a = { t: 'decide', d: { type: 'pass' } }
    else if (reaction && reaction.ron && auto.skip && !auto.win) a = null
    else if (o && !o.tsumo && auto.discard && me.drawn !== null && o.discard.includes(me.drawn)) { a = { t: 'act', a: { type: 'discard', tile: me.drawn } }; delay = 500 }
    if (!a) return
    const t = setTimeout(() => send(a!), delay)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.phase, v.turn, me.drawn, reaction, o?.tsumo, auto.win, auto.discard, auto.skip, v.handNo])

  const discardOk = useMemo(() => new Set(o?.discard ?? []), [o])
  const riichiOk = useMemo(() => new Set(o?.riichi ?? []), [o])
  const clickTile = (id: number) => {
    if (!o || !discardOk.has(id)) return
    if (riichiMode && !riichiOk.has(id)) return
    if (sel === id) send({ t: 'act', a: { type: 'discard', tile: id, riichi: riichiMode } })
    else setSel(id)
  }

  const tenpaiKinds = v.hint?.discardWaits ?? {}
  const selWaits = sel !== null ? tenpaiKinds[kindOf(sel)] : undefined
  const ruleId = v.rule.id
  const roundName = `${WIND_FULL[v.roundWind]} ${(v.roundIndex % n) + 1}`
  const dealerName = v.players[v.dealer].name

  const handTiles = me.hand ?? []
  let status = ''
  if (v.phase === 'turn' && v.turn !== you) status = `${v.players[v.turn].name}'s turn`
  else if (v.phase === 'turn' && o) status = o.discard.length ? 'Your turn — click a tile twice to discard' : ''
  else if (v.phase === 'reaction' && !reaction) status = 'Waiting for other players…'

  return (
    <div className="board">
      {sanma ? <div className="seat top" /> : <Opp p={rel(2)} v={v} pos="top" />}
      <Opp p={sanma ? rel(2) : rel(3)} v={v} pos="left" />
      <div className="center">
        {!sanma && <Pond p={rel(2)} v={v} rel={2} />}
        <Pond p={sanma ? rel(2) : rel(3)} v={v} rel={3} />
        <div className="info">
          <div className="rnd">{roundName}</div>
          <div className="muted">{v.rule.name}{sanma ? ' · 3 players' : ''}</div>
          <div>Wall <b>{v.wallLeft}</b> · Dealer {dealerName}</div>
          {ruleId === 'riichi' ? (
            <>
              <div className="doras">{[0, 1, 2, 3, 4].map((i) => (v.dora[i] !== undefined ? <Tile key={i} id={v.dora[i]} /> : <Tile key={i} back />))}</div>
              <div>{v.honba > 0 && <>Honba {v.honba} · </>}Riichi sticks {v.sticks}</div>
            </>
          ) : (
            <div>{v.lian > 0 ? `Dealer streak ×${v.lian}` : 'Dealer streak —'}</div>
          )}
          <div className="toggles">
            <button className={'tg' + (auto.win ? ' on' : '')} onClick={() => setAuto('win')} title="Automatically declare ron / tsumo when you can win">Auto-win</button>
            <button className={'tg' + (auto.discard ? ' on' : '')} onClick={() => setAuto('discard')} title="Automatically discard the tile you draw (unless you can win)">Auto-discard</button>
            <button className={'tg' + (auto.skip ? ' on' : '')} onClick={() => setAuto('skip')} title="Automatically pass on chi / pon / kan">Skip calls</button>
            <button className={'tg' + (hints ? ' on' : '')} onClick={() => setHints(!hints)} title="Show waits and shanten">Hints</button>
          </div>
        </div>
        <Pond p={rel(1)} v={v} rel={1} />
        <Pond p={me} v={v} rel={0} />
      </div>
      <Opp p={rel(1)} v={v} pos="right" />
      <div className="seat me">
        <div className="mebar">
          <Chip p={me} v={v} />
          <div className="melds">{me.melds.map((m, i) => <MeldView key={i} m={m} />)}</div>
          {(me.flowers.length > 0 || me.nuki.length > 0) && <div className="flowers">{[...me.flowers, ...me.nuki].map((f) => <Tile key={f} id={f} />)}</div>}
        </div>
        <div className="actions">
          {o?.abort && <button className="btn alt" onClick={() => send({ t: 'act', a: { type: 'abort' } })}>Abort draw (九種九牌)</button>}
          {o?.nuki && <button className="btn" onClick={() => send({ t: 'act', a: { type: 'nuki' } })}>Nuki 北</button>}
          {o?.tsumo && <button className="btn gold" onClick={() => send({ t: 'act', a: { type: 'tsumo' } })}>Tsumo (自摸)</button>}
          {o && o.riichi.length > 0 && (
            <button className={'btn ' + (riichiMode ? 'red' : '')} onClick={() => { setRiichiMode(!riichiMode); setSel(null) }}>{riichiMode ? 'Cancel Riichi' : 'Riichi'}</button>
          )}
          {o?.ankan.map((k) => <button key={'a' + k} className="btn" onClick={() => send({ t: 'act', a: { type: 'ankan', kind: k } })}>Kan <Tile kind={k} className="inline" /></button>)}
          {o?.kakan.map((id) => <button key={'k' + id} className="btn" onClick={() => send({ t: 'act', a: { type: 'kakan', tile: id } })}>Add Kan</button>)}
          {reaction && (
            <>
              {reaction.ron && <button className="btn gold" onClick={() => send({ t: 'decide', d: { type: 'ron' } })}>Ron (胡)</button>}
              {reaction.pon && <button className="btn" onClick={() => send({ t: 'decide', d: { type: 'pon' } })}>Pon (碰)</button>}
              {reaction.minkan && <button className="btn" onClick={() => send({ t: 'decide', d: { type: 'minkan' } })}>Kan (槓)</button>}
              {reaction.chi.map((c, i) => (
                <button key={i} className="chi-btn" onClick={() => send({ t: 'decide', d: { type: 'chi', use: c } })}>
                  Chi (吃) <Tile id={c[0]} /><Tile id={v.lastDiscard!.tile} hot /><Tile id={c[1]} />
                </button>
              ))}
              <button className="btn alt" onClick={() => send({ t: 'decide', d: { type: 'pass' } })}>Pass</button>
            </>
          )}
          {!o && !reaction && <span className="muted">{status}</span>}
          {o && <span className="muted">{status}</span>}
        </div>
        <div className="hint">
          {hints && v.hint && (
            <>
              <span>{v.hint.shanten < 0 ? 'Complete!' : v.hint.shanten === 0 ? 'Tenpai' : `${v.hint.shanten}-shanten`}</span>
              {v.hint.waits.length > 0 && <>waits: {v.hint.waits.map((k) => <Tile key={k} kind={k} />)}</>}
              {selWaits && <>discard → waits: {selWaits.map((k) => <Tile key={k} kind={k} />)}</>}
            </>
          )}
        </div>
        <div className="handrow">
          {handTiles.map((id) => {
            const can = !!o && discardOk.has(id) && (!riichiMode || riichiOk.has(id))
            return (
              <Tile key={id} id={id} selected={sel === id} onClick={can ? () => clickTile(id) : undefined}
                dim={!!o && (!discardOk.has(id) || (riichiMode && !riichiOk.has(id)))}
                mark={hints && !!o && !!tenpaiKinds[kindOf(id)]} />
            )
          })}
          {me.drawn !== null && (
            <>
              <span className="hand-extra" />
              <Tile id={me.drawn} selected={sel === me.drawn} onClick={o && discardOk.has(me.drawn) && (!riichiMode || riichiOk.has(me.drawn)) ? () => clickTile(me.drawn!) : undefined}
                dim={!!o && (!discardOk.has(me.drawn) || (riichiMode && !riichiOk.has(me.drawn)))}
                mark={hints && !!o && !!tenpaiKinds[kindOf(me.drawn)]} />
            </>
          )}
        </div>
      </div>
      <div className="logbox">{v.log.map((l, i) => <div key={i}>{l}</div>)}</div>
      {(v.phase === 'result' || v.phase === 'over') && <ResultModal view={view} send={send} onLeave={onLeave} />}
    </div>
  )
}
