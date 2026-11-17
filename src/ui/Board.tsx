import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TableView, PlayerView } from '../engine/table'
import type { Meld } from '../engine/game'
import { doraFrom, isRedFive, kindOf } from '../engine/tiles'
import type { ClientMsg } from '../net/protocol'
import type { ReactNode } from 'react'
import { Side, Tile } from './Tile'
import { ResultModal } from './ResultModal'
import { useLang } from '../i18n'
import { ChatPicker, EMOJI, HistoryModal, ShortcutsModal } from './Panels'

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

function Chip({ p, v, bubble }: { p: PlayerView; v: NonNullable<TableView['game']>; bubble?: string }) {
  const { lang, t } = useLang()
  const turn = v.phase === 'turn' && v.turn === p.seat
  return (
    <div className={'chip' + (turn ? ' turn' : '')}>
      {bubble && <span className="bubble">{bubble}</span>}
      <span className={'wind' + (p.seat === v.dealer ? ' dealer' : '')}>{WINDS[lang][p.seatWind]}</span>
      <span className="nm">{p.name}{!p.connected && p.human ? ` (${t('away')})` : ''}</span>
      <span className="pts">{p.points}</span>
      {p.riichi && <span className="riichi-stick" title="Riichi" />}
    </div>
  )
}

function Pond({ p, v, rel }: { p: PlayerView; v: NonNullable<TableView['game']>; rel: number }) {
  const { lang } = useLang()
  return (
    <div className={`pond p${rel}`}>
      <span className={'pondtag' + (p.seat === v.dealer ? ' dealer' : '') + (v.phase === 'turn' ? (v.turn === p.seat ? ' on' : '') : v.phase === 'reaction' && v.waiting.includes(p.seat) ? ' on' : '')}>{WINDS[lang][p.seatWind]} {p.name}</span>
      {p.discards.map((d, i) => {
        const last = v.lastDiscard?.from === p.seat && i === p.discards.length - 1 && v.phase !== 'turn'
        const tile = <Tile key={i} id={d.tile} className={(d.called ? 'called ' : '') + (last ? 'last' : '')} />
        return d.riichi ? <Side key={i}>{tile}</Side> : tile
      })}
    </div>
  )
}

function Opp({ p, v, pos, bubble }: { p: PlayerView; v: NonNullable<TableView['game']>; pos: 'top' | 'left' | 'right'; bubble?: string }) {
  const extra = v.phase === 'turn' && v.turn === p.seat && p.hand === null ? 1 : 0
  return (
    <div className={`seat ${pos}`}>
      <Chip p={p} v={v} bubble={bubble} />
      <div className="backs">
        {p.hand
          ? [...p.hand.map((id) => <Tile key={id} id={id} />), ...(p.drawn !== null ? [<span key="g" className="gap" />, <Tile key="d" id={p.drawn} />] : [])]
          : [...Array(p.handCount)].map((_, i) => <Tile key={i} back />)}
        {extra ? <><span className="gap" /><Tile back /></> : null}
      </div>
      {(p.melds.length > 0 || p.flowers.length > 0 || p.nuki.length > 0) && (
        <div className="extras">
          {p.melds.length > 0 && <div className="melds">{p.melds.map((m, i) => <MeldView key={i} m={m} owner={p.seat} n={v.players.length} />)}</div>}
          {(p.flowers.length > 0 || p.nuki.length > 0) && <div className="flowers">{[...p.flowers, ...p.nuki].map((f) => <Tile key={f} id={f} />)}</div>}
        </div>
      )}
    </div>
  )
}

export function Board({ view, send, hints, setHints, onLeave, online }: {
  view: TableView; send: (m: ClientMsg) => void; hints: boolean; setHints: (b: boolean) => void; onLeave: () => void; online?: boolean
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
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const autosRef = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    setSlot(document.getElementById('topbar-slot'))
    const close = (e: MouseEvent) => { const d = autosRef.current; if (d?.open && !d.contains(e.target as Node)) d.open = false }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close as never)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close as never) }
  }, [])
  const [panel, setPanel] = useState<null | 'history' | 'keys' | 'chat'>(null)
  const [bubbles, setBubbles] = useState<Record<number, { text: string; until: number }>>({})
  const seenChat = useRef(0)
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    for (const c of v.chat ?? []) {
      if (c.n <= seenChat.current) continue
      seenChat.current = c.n
      const key = c.key
      setBubbles((b) => ({ ...b, [c.seat]: { text: EMOJI[key] ?? t('chat.' + key), until: Date.now() + 4500 } }))
      timers.push(setTimeout(() => setBubbles((b) => { const x = { ...b }; if (x[c.seat] && x[c.seat].until <= Date.now() + 50) delete x[c.seat]; return x }), 4600))
    }
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.chat])
  const bub = (seat: number) => bubbles[seat]?.text
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

  // ----- keyboard shortcuts -----
  const kb = useRef<() => void>(() => {})
  const keyHandler = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null
    if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const k = e.key.toLowerCase()
    const act = (m: ClientMsg) => { e.preventDefault(); send(m) }
    if (v.phase === 'result') { if (k === 'enter' || k === ' ') act({ t: 'ack' }); return }
    if (panel) { if (k === 'escape') setPanel(null); return }
    if (reaction) {
      if (k === 'r' && reaction.ron) act({ t: 'decide', d: { type: 'ron' } })
      else if (k === 'p' && reaction.pon) act({ t: 'decide', d: { type: 'pon' } })
      else if (k === 'k' && reaction.minkan) act({ t: 'decide', d: { type: 'minkan' } })
      else if (k === 'c' && reaction.chi.length) act({ t: 'decide', d: { type: 'chi', use: reaction.chi[0] } })
      else if (/^[1-3]$/.test(k) && reaction.chi[+k - 1]) act({ t: 'decide', d: { type: 'chi', use: reaction.chi[+k - 1] } })
      else if (k === ' ' || k === 'escape') act({ t: 'decide', d: { type: 'pass' } })
      return
    }
    if (!o) return
    const order = [...(me.hand ?? []), ...(me.drawn !== null ? [me.drawn] : [])]
    if (k === 't' && o.tsumo) act({ t: 'act', a: { type: 'tsumo' } })
    else if (k === 'i' && o.riichi.length) { e.preventDefault(); setRiichiMode((x) => !x); setSel(null) }
    else if (k === 'd' && me.drawn !== null && discardOk.has(me.drawn)) act({ t: 'act', a: { type: 'discard', tile: me.drawn } })
    else if (k === 'enter' && sel !== null) act({ t: 'act', a: { type: 'discard', tile: sel, riichi: riichiMode } })
    else if (k === 'arrowleft' || k === 'arrowright') {
      e.preventDefault()
      const i = sel === null ? order.length : order.indexOf(sel)
      const j = Math.min(order.length - 1, Math.max(0, i + (k === 'arrowleft' ? -1 : 1)))
      if (order[j] !== undefined) setSel(order[j])
    }
  }
  kb.current = () => {}
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandler(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const tenpaiKinds = v.hint?.discardWaits ?? {}
  const selWaits = sel !== null ? tenpaiKinds[kindOf(sel)] : undefined
  const ruleId = v.rule.id
  const roundName = t('roundName', { wind: t('wind.' + v.roundWind), n: (v.roundIndex % n) + 1 })
  const handTiles = me.hand ?? []
  // dora: what the indicators point at, and how many dora tiles I hold (dora + red fives + set-aside norths)
  const doraKinds = ruleId === 'riichi' ? v.dora.map((i) => doraFrom(kindOf(i), sanma)) : []
  const doraOf = (id: number) => doraKinds.filter((k) => k === kindOf(id)).length
  const akaOn = ruleId === 'riichi' && view.config.aka
  const doraInHand = ruleId !== 'riichi' ? 0
    : [...handTiles, ...(me.drawn !== null ? [me.drawn] : []), ...me.melds.flatMap((m) => m.tiles)].reduce((a, id) => a + doraOf(id) + (akaOn && isRedFive(id) ? 1 : 0), 0) + me.nuki.length

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

  const autoMenu = (
    <details className="autos" ref={autosRef}>
          <summary>⚙ {t('auto')}</summary>
          <div className="autopanel">
            {([['win', 'autoWin', auto.win], ['discard', 'autoDiscard', auto.discard], ['skip', 'skipCalls', auto.skip]] as const).map(([k, label, on]) => (
              <label key={k} title={t(label + 'Tip')}><input type="checkbox" checked={on} onChange={() => setAuto(k)} /> {t(label)}</label>
            ))}
            <label title={t('hintsTip')}><input type="checkbox" checked={hints} onChange={() => setHints(!hints)} /> {t('hints')}</label>
            <hr />
            <button className="menuitem" onClick={() => setPanel('history')}>{t('history')}</button>
            <button className="menuitem" onClick={() => setPanel('keys')}>{t('shortcuts')}</button>
          </div>
    </details>
  )
  const tileDim = (id: number) => !!o && (!discardOk.has(id) || (riichiMode && !riichiOk.has(id)))
  const tileClick = (id: number) => (o && discardOk.has(id) && (!riichiMode || riichiOk.has(id)) ? () => clickTile(id) : undefined)

  return (
    <div className="board" style={{ ['--hand' as string]: v.rule.nSets === 5 ? 17 : 14 }}>
      {sanma ? <div className="seat top" /> : <Opp p={rel(2)} v={v} pos="top" bubble={bub(rel(2).seat)} />}
      <Opp p={sanma ? rel(2) : rel(3)} v={v} pos="left" bubble={bub((sanma ? rel(2) : rel(3)).seat)} />
      <div className="center"><div className={'cgrid' + (v.rule.id === 'riichi' ? ' jp' : '')}>
        {!sanma && <Pond p={rel(2)} v={v} rel={2} />}
        <Pond p={sanma ? rel(2) : rel(3)} v={v} rel={3} />
        {ruleId === 'riichi' && (
          <div className="dorapanel">
              <div className="dorabox">
                <div className="dlabel">{t('doraInd')} <span className="muted">{v.dora.length}/5</span></div>
                <div className="drow">
                  {[0, 1, 2, 3, 4].map((i) => v.dora[i] !== undefined ? (
                    <div className="dpair" key={i}><Tile id={v.dora[i]} /><span className="darrow">▼</span><Tile kind={doraFrom(kindOf(v.dora[i]), sanma)} /></div>
                  ) : <div className="dpair hidden" key={i}><Tile back /></div>)}
                </div>
              </div>
          </div>
        )}
        <div className="info">
          {dirs.map(([name, r]) => <span key={name} className={`dir d-${name}` + (dirOn(r) ? ' on' : '')} />)}
          <div className="rnd">{roundName}</div>
          <div className="muted">{t('wall')} {v.wallLeft}</div>
          {ruleId === 'riichi' && (
            <>
              {(v.honba > 0 || v.sticks > 0) && <div className="muted">{v.honba > 0 && <>{t('honba')} {v.honba}</>}{v.honba > 0 && v.sticks > 0 && ' · '}{v.sticks > 0 && <>{t('sticks')} {v.sticks}</>}</div>}
            </>
          )}
          {ruleId !== 'riichi' && v.lian > 0 && <div className="muted">{t('streak')} ×{v.lian}</div>}
        </div>
        <Pond p={rel(1)} v={v} rel={1} />
        <Pond p={me} v={v} rel={0} />
      </div></div>
      <Opp p={rel(1)} v={v} pos="right" bubble={bub(rel(1).seat)} />
      <div className="seat me">
        <div className="memain">
        <div className="mebar">
          <Chip p={me} v={v} bubble={bub(me.seat)} />
          {doraInHand > 0 && <span className="dorapill" title={t('doraInHand')}>★ {doraInHand}</span>}
          {online && (
            <div className="chatwrap">
              <button className="chatopen" aria-label={t('chatTitle')} onClick={() => setPanel(panel === 'chat' ? null : 'chat')}>💬</button>
              {panel === 'chat' && <ChatPicker onPick={(k) => { send({ t: 'chat', key: k }); setPanel(null) }} />}
            </div>
          )}
          <div className="melds">{me.melds.map((m, i) => <MeldView key={i} m={m} owner={me.seat} n={n} />)}</div>
          {(me.flowers.length > 0 || me.nuki.length > 0) && <div className="flowers">{[...me.flowers, ...me.nuki].map((f) => <Tile key={f} id={f} />)}</div>}
        </div>
          <div className={'statusbar' + (mine ? ' mine' : '')}>
            {reaction && v.lastDiscard ? t('discarded', { name: v.players[v.lastDiscard.from].name }) : status}
            {secs !== null && mine && <span className="timer"> · {t('timeLeft', { s: secs })}</span>}
          </div>
        {hints && v.hint && (
          <div className="hint">
            <span className="hstat">{v.hint.shanten < 0 ? t('complete') : v.hint.shanten === 0 ? t('tenpai') : t('shanten', { n: v.hint.shanten })}</span>
            {v.hint.furiten && <span className="tag warn">{t('furiten')}</span>}
            {v.hint.waits.length > 0 && (
              <span className="waitlist">
                {v.hint.waits.map((k) => {
                  const left = v.hint!.left[k] ?? 0
                  const val = v.hint!.values[k]
                  return (
                    <span key={k} className={'waitchip' + (left === 0 ? ' none' : '')}>
                      <Tile kind={k} />
                      <span className="wmeta"><b>{t('leftTiles', { n: left })}</b><span title={val ? '' : t('noValue')}>{val ? `${val.label ? t('label.' + val.label) !== 'label.' + val.label ? t('label.' + val.label) : val.label : `${val.total} ${t(ruleId === 'riichi' ? 'han' : ruleId === 'hk' ? 'fan' : 'tai')}`}` : '—'}</span></span>
                    </span>
                  )
                })}
              </span>
            )}
            {selWaits && (
              <span className="waitlist">
                <span className="muted">{t('discardWaits')}</span>
                {selWaits.map((k) => (
                  <span key={k} className={'waitchip' + ((v.hint!.left[k] ?? 0) === 0 ? ' none' : '')}>
                    <Tile kind={k} /><span className="wmeta"><b>{t('leftTiles', { n: v.hint!.left[k] ?? 0 })}</b></span>
                  </span>
                ))}
              </span>
            )}
          </div>
        )}
        <div className={'handrow' + (mine ? ' mine' : '')}>
          {handTiles.map((id) => (
            <Tile key={id} id={id} dora={doraOf(id) || undefined} selected={sel === id} onClick={tileClick(id)} dim={tileDim(id)} mark={hints && !!o && !!tenpaiKinds[kindOf(id)]} />
          ))}
          {me.drawn !== null && (
            <>
              <span className="hand-extra" />
              <Tile id={me.drawn} className="drawn" dora={doraOf(me.drawn) || undefined} selected={sel === me.drawn} onClick={tileClick(me.drawn)} dim={tileDim(me.drawn)} mark={hints && !!o && !!tenpaiKinds[kindOf(me.drawn)]} />
            </>
          )}
        </div>
        </div>
        <div className="actionpanel">
          {reaction && v.lastDiscard && (
            <div className="callhead"><Tile id={v.lastDiscard.tile} hot /></div>
          )}
          <div className="apbtns">
            {reaction && v.lastDiscard && (<>
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
            </>)}
            {reaction && <button className="cbtn pass" onClick={() => send({ t: 'decide', d: { type: 'pass' } })}><b>{t('pass')}</b></button>}
          {o?.tsumo && <button className="cbtn ron" onClick={() => send({ t: 'act', a: { type: 'tsumo' } })}>{t('tsumo')}</button>}
          {o && o.riichi.length > 0 && (
            <button className={'cbtn ' + (riichiMode ? 'ron' : 'call')} onClick={() => { setRiichiMode(!riichiMode); setSel(null) }}>{riichiMode ? t('cancelRiichi') : t('riichi')}</button>
          )}
          {o?.nuki && <button className="cbtn call" onClick={() => send({ t: 'act', a: { type: 'nuki' } })}><b>{t('nuki')}</b></button>}
          {o?.ankan.map((k) => <button key={'a' + k} className="cbtn call" onClick={() => send({ t: 'act', a: { type: 'ankan', kind: k } })}><b>{t('kan')}</b><span className="mini"><Tile kind={k} /><Tile kind={k} /><Tile kind={k} /><Tile kind={k} /></span></button>)}
          {o?.kakan.map((id) => <button key={'k' + id} className="cbtn call" onClick={() => send({ t: 'act', a: { type: 'kakan', tile: id } })}><b>{t('addKan')}</b><span className="mini"><Tile id={id} /></span></button>)}
          {o?.abort && <button className="cbtn pass" onClick={() => send({ t: 'act', a: { type: 'abort' } })}><b>{t('abortDraw')}</b></button>}
          </div>
        </div>
      </div>
      {slot ? createPortal(autoMenu, slot) : autoMenu}
      {panel === 'history' && <HistoryModal v={v} you={you} onClose={() => setPanel(null)} />}
      {panel === 'keys' && <ShortcutsModal onClose={() => setPanel(null)} />}
      {(v.phase === 'result' || v.phase === 'over') && <ResultModal view={view} send={send} onLeave={onLeave} />}
    </div>
  )
}
