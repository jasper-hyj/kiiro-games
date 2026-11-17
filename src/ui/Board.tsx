import { useEffect, useMemo, useRef, useState } from 'react'
import type { TableView, PlayerView } from '../engine/table'
import type { Meld } from '../engine/game'
import { kindOf } from '../engine/tiles'
import type { ClientMsg } from '../net/protocol'
import type { ReactNode } from 'react'
import { Side, Tile } from './Tile'
import { ResultModal } from './ResultModal'
import { useLang } from '../i18n'

const WINDS: Record<'en' | 'zh', string[]> = { en: ['E', 'S', 'W', 'N'], zh: ['東', '南', '西', '北'] }

function MeldView({ m, owner, n }: { m: Meld; owner: number; n: number }) {
  if (m.type === 'ankan') {
    return <div className="meld">{m.tiles.map((id, i) => <Tile key={i} id={id} back={i === 0 || i === 3} />)}</div>
  }
  const called = m.called ?? m.tiles[0]
  const rest = m.tiles.filter((t) => t !== called)
  // where the sideways tile sits: from the player on your left -> leftmost, across -> middle, right -> rightmost
  const rel = (m.from - owner + n) % n
  const pos = m.type === 'chi' ? 0 : rel === n - 1 ? 0 : rel === 1 ? (m.type === 'pon' ? 2 : 3) : 1
  const kakanExtra = m.type === 'kakan' ? rest.pop() : undefined
  const body = m.type === 'kakan' ? rest : rest
  const items: ReactNode[] = []
  const all = m.type === 'kakan' ? m.tiles.filter((t) => t !== called && t !== kakanExtra) : body
  let k = 0
  const slots = m.type === 'kakan' || m.type === 'pon' || m.type === 'chi' ? 3 : 4
  for (let i = 0; i < slots; i++) {
    if (i === pos) {
      items.push(
        <Side key={'s' + i} double={m.type === 'kakan'}>
          <Tile id={called} hot />
          {kakanExtra !== undefined && <Tile id={kakanExtra} />}
        </Side>,
      )
    } else items.push(<Tile key={i} id={all[k++]} />)
  }
  return <div className="meld">{items}</div>
}

function Chip({ p, v }: { p: PlayerView; v: NonNullable<TableView['game']> }) {
  const { lang, t } = useLang()
  const turn = v.phase === 'turn' && v.turn === p.seat
  return (
    <div className={'chip' + (turn ? ' turn' : '')}>
      <span className={'wind' + (p.seat === v.dealer ? ' dealer' : '')}>{WINDS[lang][p.seatWind]}</span>
      <span className="nm">{p.name}{!p.connected && p.human ? ` (${t('away')})` : ''}</span>
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
        const tile = <Tile key={i} id={d.tile} className={(d.called ? 'called ' : '') + (last ? 'last' : '')} />
        return d.riichi ? <Side key={i}>{tile}</Side> : tile
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
      <div className="melds">{p.melds.map((m, i) => <MeldView key={i} m={m} owner={p.seat} n={v.players.length} />)}</div>
      {(p.flowers.length > 0 || p.nuki.length > 0) && <div className="flowers">{[...p.flowers, ...p.nuki].map((f) => <Tile key={f} id={f} />)}</div>}
    </div>
  )
}

export function Board({ view, send, hints, setHints, onLeave }: {
  view: TableView; send: (m: ClientMsg) => void; hints: boolean; setHints: (b: boolean) => void; onLeave: () => void
}) {
  const { t } = useLang()
  const v = view.game!
  const you = Math.max(0, view.you)
  const n = v.players.length
  const rel = (r: number) => v.players[(you + r) % n]
  const sanma = n === 3
  const me = rel(0)
  const recv = useRef(Date.now())
  useMemo(() => { recv.current = Date.now() }, [view]) // eslint-disable-line react-hooks/exhaustive-deps
  const [now, setNow] = useState(Date.now())
  useEffect(() => { if (v.timeLeft == null) return; const i = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(i) }, [v.timeLeft])
  const secs = v.timeLeft == null ? null : Math.max(0, Math.ceil((v.timeLeft - (now - recv.current)) / 1000))
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
  const roundName = t('roundName', { wind: t('wind.' + v.roundWind), n: (v.roundIndex % n) + 1 })
  const handTiles = me.hand ?? []

  // one clear line that always says what is happening / what to do
  let status = ''
  let mine = false
  if (reaction) { status = t('choose'); mine = true }
  else if (v.phase === 'turn' && v.turn === you && o?.discard.length) { status = t('yourTurn'); mine = true }
  else if (v.phase === 'turn') status = t('turnOf', { name: v.players[v.turn].name })
  else if (v.phase === 'reaction') status = t('waitingOthers')

  // static direction bars: light the side of whoever's turn it is (or who the table is waiting on)
  const activeSeats = v.phase === 'turn' ? [v.turn] : v.phase === 'reaction' ? v.waiting : []
  const dirOn = (r: number) => activeSeats.some((sd) => (sd - you + n) % n === r)
  const dirs: [string, number][] = sanma ? [['bottom', 0], ['right', 1], ['left', 2]] : [['bottom', 0], ['right', 1], ['top', 2], ['left', 3]]

  const tileDim = (id: number) => !!o && (!discardOk.has(id) || (riichiMode && !riichiOk.has(id)))
  const tileClick = (id: number) => (o && discardOk.has(id) && (!riichiMode || riichiOk.has(id)) ? () => clickTile(id) : undefined)

  return (
    <div className="board" style={{ ['--hand' as string]: v.rule.nSets === 5 ? 17 : 14 }}>
      {sanma ? <div className="seat top" /> : <Opp p={rel(2)} v={v} pos="top" />}
      <Opp p={sanma ? rel(2) : rel(3)} v={v} pos="left" />
      <div className="center">
        {!sanma && <Pond p={rel(2)} v={v} rel={2} />}
        <Pond p={sanma ? rel(2) : rel(3)} v={v} rel={3} />
        <div className="info">
          {dirs.map(([name, r]) => <span key={name} className={`dir d-${name}` + (dirOn(r) ? ' on' : '')} />)}
          <div className="rnd">{roundName}</div>
          <div className="muted">{t('wall')} {v.wallLeft}</div>
          {ruleId === 'riichi' && (
            <>
              <div className="doras">{[0, 1, 2, 3, 4].map((i) => (v.dora[i] !== undefined ? <Tile key={i} id={v.dora[i]} /> : <Tile key={i} back />))}</div>
              {(v.honba > 0 || v.sticks > 0) && <div className="muted">{v.honba > 0 && <>{t('honba')} {v.honba}</>}{v.honba > 0 && v.sticks > 0 && ' · '}{v.sticks > 0 && <>{t('sticks')} {v.sticks}</>}</div>}
            </>
          )}
          {ruleId !== 'riichi' && v.lian > 0 && <div className="muted">{t('streak')} ×{v.lian}</div>}
        </div>
        <Pond p={rel(1)} v={v} rel={1} />
        <Pond p={me} v={v} rel={0} />
      </div>
      <Opp p={rel(1)} v={v} pos="right" />
      <div className="seat me">
        <div className="mebar">
          <Chip p={me} v={v} />
          <div className="melds">{me.melds.map((m, i) => <MeldView key={i} m={m} owner={me.seat} n={n} />)}</div>
          {(me.flowers.length > 0 || me.nuki.length > 0) && <div className="flowers">{[...me.flowers, ...me.nuki].map((f) => <Tile key={f} id={f} />)}</div>}
        </div>
        {reaction && v.lastDiscard && (
          <div className="callbar">
            <div className="callhead">{t('discarded', { name: v.players[v.lastDiscard.from].name })} <Tile id={v.lastDiscard.tile} hot /></div>
            <div className="callbtns">
              {reaction.ron && <button className="cbtn ron" onClick={() => send({ t: 'decide', d: { type: 'ron' } })}><b>{t('ron')}</b></button>}
              {reaction.pon && (
                <button className="cbtn call" onClick={() => send({ t: 'decide', d: { type: 'pon' } })}>
                  <b>{t('pon')}</b><span className="mini"><Tile id={v.lastDiscard.tile} hot /><Tile kind={kindOf(v.lastDiscard.tile)} /><Tile kind={kindOf(v.lastDiscard.tile)} /></span>
                </button>
              )}
              {reaction.minkan && (
                <button className="cbtn call" onClick={() => send({ t: 'decide', d: { type: 'minkan' } })}>
                  <b>{t('kan')}</b><span className="mini"><Tile id={v.lastDiscard.tile} hot /><Tile kind={kindOf(v.lastDiscard.tile)} /><Tile kind={kindOf(v.lastDiscard.tile)} /><Tile kind={kindOf(v.lastDiscard.tile)} /></span>
                </button>
              )}
              {reaction.chi.map((c, i) => (
                <button key={i} className="cbtn call" onClick={() => send({ t: 'decide', d: { type: 'chi', use: c } })}>
                  <b>{t('chi')}</b>
                  <span className="mini">{[...c, v.lastDiscard!.tile].sort((x, y) => kindOf(x) - kindOf(y)).map((id) => <Tile key={id} id={id} hot={id === v.lastDiscard!.tile} />)}</span>
                </button>
              ))}
              <button className="cbtn pass" onClick={() => send({ t: 'decide', d: { type: 'pass' } })}><b>{t('pass')}</b></button>
            </div>
          </div>
        )}
        {!reaction && <div className={'statusbar' + (mine ? ' mine' : '')}>
          {status}
          {secs !== null && mine && <span className="timer"> · {t('timeLeft', { s: secs })}</span>}
        </div>}
        <div className="actions">
          {o && sel !== null && (
            <button className="cbtn call" disabled={riichiMode && !riichiOk.has(sel)} onClick={() => send({ t: 'act', a: { type: 'discard', tile: sel, riichi: riichiMode } })}>
              <b>{riichiMode ? t('riichi') + ' · ' : ''}{t('discard')}</b><span className="mini"><Tile id={sel} /></span>
            </button>
          )}
          {o?.tsumo && <button className="cbtn ron" onClick={() => send({ t: 'act', a: { type: 'tsumo' } })}>{t('tsumo')}</button>}
          {o && o.riichi.length > 0 && (
            <button className={'btn ' + (riichiMode ? 'red' : '')} onClick={() => { setRiichiMode(!riichiMode); setSel(null) }}>{riichiMode ? t('cancelRiichi') : t('riichi')}</button>
          )}
          {o?.nuki && <button className="btn" onClick={() => send({ t: 'act', a: { type: 'nuki' } })}>{t('nuki')}</button>}
          {o?.ankan.map((k) => <button key={'a' + k} className="btn" onClick={() => send({ t: 'act', a: { type: 'ankan', kind: k } })}>{t('kan')} <Tile kind={k} className="inline" /></button>)}
          {o?.kakan.map((id) => <button key={'k' + id} className="btn" onClick={() => send({ t: 'act', a: { type: 'kakan', tile: id } })}>{t('addKan')}</button>)}
          {o?.abort && <button className="btn alt" onClick={() => send({ t: 'act', a: { type: 'abort' } })}>{t('abortDraw')}</button>}
        </div>
        {hints && v.hint && (
          <div className="hint">
            <span>{v.hint.shanten < 0 ? t('complete') : v.hint.shanten === 0 ? t('tenpai') : t('shanten', { n: v.hint.shanten })}</span>
            {v.hint.waits.length > 0 && <>{t('waits')} {v.hint.waits.map((k) => <Tile key={k} kind={k} />)}</>}
            {selWaits && <>{t('discardWaits')} {selWaits.map((k) => <Tile key={k} kind={k} />)}</>}
          </div>
        )}
        <div className={'handrow' + (mine ? ' mine' : '')}>
          {handTiles.map((id) => (
            <Tile key={id} id={id} selected={sel === id} onClick={tileClick(id)} dim={tileDim(id)} mark={hints && !!o && !!tenpaiKinds[kindOf(id)]} />
          ))}
          {me.drawn !== null && (
            <>
              <span className="hand-extra" />
              <Tile id={me.drawn} className="drawn" selected={sel === me.drawn} onClick={tileClick(me.drawn)} dim={tileDim(me.drawn)} mark={hints && !!o && !!tenpaiKinds[kindOf(me.drawn)]} />
            </>
          )}
        </div>
        <details className="autos">
          <summary>⚙ {t('auto')}</summary>
          <div className="autopanel">
            {([['win', 'autoWin', auto.win], ['discard', 'autoDiscard', auto.discard], ['skip', 'skipCalls', auto.skip]] as const).map(([k, label, on]) => (
              <label key={k} title={t(label + 'Tip')}><input type="checkbox" checked={on} onChange={() => setAuto(k)} /> {t(label)}</label>
            ))}
            <label title={t('hintsTip')}><input type="checkbox" checked={hints} onChange={() => setHints(!hints)} /> {t('hints')}</label>
          </div>
        </details>
      </div>
      {(v.phase === 'result' || v.phase === 'over') && <ResultModal view={view} send={send} onLeave={onLeave} />}
    </div>
  )
}
