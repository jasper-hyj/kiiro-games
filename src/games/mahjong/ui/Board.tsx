import { useEffect, useMemo, useRef, useState } from 'react'
import type { TableView, PlayerView } from '../engine/table'
import type { Meld } from '../engine/game'
import { doraFrom, isRedFive, kindOf, numOf, suitOf } from '../engine/tiles'
import type { ClientMsg } from '../net/protocol'
import type { ReactNode } from 'react'
import { Side, Tile } from './Tile'
import { ChatFeed } from './ChatFeed'
import { ResultModal } from './ResultModal'
import { useLang } from '../../../i18n'
import { setSetting, useSettings } from '../settings'
import { RulesHelp } from './RulesHelp'
import { Stage } from './Stage'
import { HistoryModal, ShortcutsModal } from './Panels'

const WINDS: Record<'en' | 'zh', string[]> = { en: ['E', 'S', 'W', 'N'], zh: ['東', '南', '西', '北'] }
const wk = (l: string): 'en' | 'zh' => (l === 'en' ? 'en' : 'zh')

export function MeldView({ m, owner, n }: { m: Meld; owner: number; n: number }) {
  if (m.type === 'ankan') {
    return <div className="meld">{m.tiles.map((id, i) => <Tile key={i} id={id} back={i === 0 || i === 3} />)}</div>
  }
  const called = m.called ?? m.tiles[0]
  const rest = m.tiles.filter((t) => t !== called)
  // where the sideways tile sits: from the player on your left -> leftmost, across -> middle, right -> rightmost
  const rel = (m.from - owner + n) % n
  const pos = m.type === 'chi' ? 0 : rel === n - 1 ? 0 : rel === 1 ? (m.type === 'pon' || m.type === 'kakan' ? 2 : 3) : 1
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
  const rr = v.phase === 'result' ? v.result : null
  const isWinner = !!rr && rr.kind === 'win' && (rr.winner === p.seat || !!rr.others?.some((x) => x.winner === p.seat))
  const { lang, t } = useLang()
  const turn = v.phase === 'turn' && v.turn === p.seat
  return (
    <div className={'chip' + (turn ? ' turn' : '') + (p.human && !p.connected ? ' away' : '') + (isWinner ? ' winner' : '')}>
      <span className={'wind' + (p.seat === v.dealer ? ' dealer' : '')}>{WINDS[wk(lang)][p.seatWind]}</span>
      <span className="nm">{p.name}{!p.connected && p.human ? ` (${t('away')})` : ''}</span>
      <span className="pts">{p.points}</span>
      {p.voidSuit !== null && p.voidSuit !== undefined && <span className="voidtag" title={t('voidTip')}>{lang === 'zh' ? '缺' : lang === 'ja' ? '欠' : '✕'}{'萬筒索'[p.voidSuit]}</span>}
      {p.human && p.connected && p.idle && <span className={'idletag ' + p.idle} title={t(p.idle === 'auto' ? 'tagAutoTip' : 'tagSlowTip')}>{t(p.idle === 'auto' ? 'tagAuto' : 'tagSlow')}</span>}
      {p.out && <span className="wintag">{t('won')} {p.winOrder}</span>}
    </div>
  )
}

function Pond({ p, v, rel }: { p: PlayerView; v: NonNullable<TableView['game']>; rel: number }) {
  const { lang } = useLang()
  return (
    <div className={`pond p${rel}`}>
      <span className={'pondtag' + (p.seat === v.dealer ? ' dealer' : '') + (v.phase === 'turn' ? (v.turn === p.seat ? ' on' : '') : v.phase === 'reaction' && v.waiting.includes(p.seat) ? ' on' : '')}>{WINDS[wk(lang)][p.seatWind]} {p.name}</span>
      <div className="pondin">
        {p.discards.map((d, i) => {
          const last = v.lastDiscard?.from === p.seat && i === p.discards.length - 1 && v.phase !== 'turn'
          const tile = <Tile key={i} id={d.tile} className={(d.called ? 'called ' : '') + (last ? 'last' : '')} />
          return d.riichi ? <Side key={i}>{tile}</Side> : tile
        })}
      </div>
    </div>
  )
}

function Opp({ p, v, pos }: { p: PlayerView; v: NonNullable<TableView['game']>; pos: 'top' | 'left' | 'right' }) {
  // a freshly drawn tile sits apart from the hand. After a chi / pon nothing was drawn (the player already holds the tile to discard),
  // so the extra tile only shows when the concealed count is one more than a multiple of three (13 or 16 tiles before a draw)
  const extra = v.phase === 'turn' && v.turn === p.seat && p.hand === null && p.handCount % 3 === 1 ? 1 : 0
  const rr = v.phase === 'result' ? v.result : null
  const wonHere = !!rr && rr.kind === 'win' && (rr.winner === p.seat || !!rr.others?.some((x) => x.winner === p.seat) || !!rr.sc?.wins.some((x) => x.winner === p.seat))
  return (
    <div className={`seat ${pos}${wonHere ? ' winseat' : ''}`}>
      <Chip p={p} v={v} />
      <div className="backs">
        {p.hand
          ? [...p.hand.map((id) => <Tile key={id} id={id} />), ...(p.drawn !== null ? [<span key="g" className="gap" />, <Tile key="d" id={p.drawn} />] : [])]
          : [...Array(p.handCount)].map((_, i) => <Tile key={i} back />)}
        {extra ? <><span className="gap" /><Tile back /></> : null}
      </div>
      {(p.melds.length > 0 || p.flowers.length > 0 || p.nuki.length > 0) && (
        <div className="extras">
          {p.melds.length > 0 && <div className="melds">{p.melds.map((m, i) => <MeldView key={i} m={m} owner={p.seat} n={v.players.length} />)}</div>}
          {(p.flowers.length > 0 || p.nuki.length > 0) && <div className="flowers">{[...p.flowers, ...p.nuki].map((f) => pos === 'top' ? <Tile key={f} id={f} /> : <Side key={f} ccw={pos === 'right'}><Tile id={f} /></Side>)}</div>}
        </div>
      )}
    </div>
  )
}

function coachText(c: NonNullable<TableView['game']>['coach'] & object, t: (k: string, v?: Record<string, string | number>) => string): string {
  const extra = (...keys: (string | undefined)[]) => keys.filter(Boolean).map((k) => t(k!)).join(' ')
  switch (c.kind) {
    case 'tsumo': return t('coach.tsumo')
    case 'ron': return t('coach.ron')
    case 'riichi': return [t('coach.riichi'), extra(c.why && 'coachwhy.' + c.why, c.plan && 'coachplan.' + c.plan, c.furi ? 'coachstate.furi' : 'coachstate.tenpai')].filter(Boolean).join(' ')
    case 'discard': return [(c.threat ? t('coach.threat') + ' ' : '') + ((c.n ?? 1) <= 0 ? t('coach.discard0') : t('coach.discardN', { n: (c.n ?? 1) + 0 })), extra(c.why && 'coachwhy.' + c.why, c.plan && 'coachplan.' + c.plan, (c.n ?? 1) <= 0 ? (c.furi ? 'coachstate.furi' : 'coachstate.tenpai') : undefined)].filter(Boolean).join(' ')
    case 'call': return [t('coach.call', { call: t(c.call === 'minkan' ? 'kan' : c.call ?? 'pass'), n: c.n ?? 0 }), extra(c.why && 'coachwhy.' + c.why)].filter(Boolean).join(' ')
    case 'pass': return t('coach.pass')
    case 'nuki': return t('coach.nuki')
    case 'kan': return t('coach.kan')
  }
  return ''
}

export function Board({ view, send, hints, setHints, onLeave, online, room, status: conn }: {
  room?: string | null; status?: string;
  view: TableView; send: (m: ClientMsg) => void; hints: boolean; setHints: (b: boolean) => void; onLeave: () => void; online?: boolean
}) {
  const { t, lang, setLang, simplified, setSimplified } = useLang()
  const settings = useSettings()
  const v = view.game!
  const you = Math.max(0, view.you)
  const n = v.players.length
  const rel = (r: number) => v.players[(you + r) % n]
  const sanma = n === 3
  const me = rel(0)
  const furiSet = new Set(v.riichiFuriten ?? []) // riichi candidates that would leave a furiten hand
  const coachOk = view.config.coach !== false // the host can turn the coach and hints off for the whole room
  const recv = useRef(Date.now())
  useMemo(() => { recv.current = Date.now() }, [view]) // eslint-disable-line react-hooks/exhaustive-deps
  const [now, setNow] = useState(Date.now())
  useEffect(() => { if (v.timeLeft == null) return; const i = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(i) }, [v.timeLeft])
  const secs = v.timeLeft == null ? null : Math.max(0, Math.ceil((v.timeLeft - (now - recv.current)) / 1000))
  const [sel, setSel] = useState<number | null>(null)
  const [riichiMode, setRiichiMode] = useState(false)
  const [swapSel, setSwapSel] = useState<number[]>([])
  const autosRef = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => { const d = autosRef.current; if (d?.open && !d.contains(e.target as Node)) d.open = false }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close as never)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close as never) }
  }, [])
  useEffect(() => {
    const hb = document.querySelector('.handbar') as HTMLElement | null
    if (!hb) return
    const set = () => document.documentElement.style.setProperty('--hbh', hb.offsetHeight + 'px')
    set()
    const ro = new ResizeObserver(set); ro.observe(hb)
    return () => ro.disconnect()
  }, [])
  // a win is announced on the table for a moment before the result card opens
  const [announce, setAnnounce] = useState(false)
  const announced = useRef(-1)
  useEffect(() => {
    if (v.phase === 'result' && v.result?.kind === 'win' && announced.current !== v.handNo) {
      announced.current = v.handNo
      setAnnounce(true)
      const id = setTimeout(() => setAnnounce(false), 2400)
      return () => clearTimeout(id)
    }
    if (v.phase !== 'result') setAnnounce(false)
  }, [v.phase, v.handNo]) // eslint-disable-line react-hooks/exhaustive-deps
  const winning = v.phase === 'result' && v.result?.kind === 'win'
  const iWon = winning && (v.result!.winner === you || !!v.result!.others?.some((x) => x.winner === you) || !!v.result!.sc?.wins.some((x) => x.winner === you))
  const [panel, setPanel] = useState<null | 'history' | 'keys' | 'chat' | 'rules'>(null)
  const o = v.turnOptions
  useEffect(() => { setSel(null); setRiichiMode(false) }, [v.handNo, v.turn, v.phase, me.drawn, me.hand?.length])
  useEffect(() => { setSwapSel([]) }, [v.handNo, v.phase])

  // ----- Mahjong Soul style automation -----
  // automation: everything starts OFF except organising the hand
  type Auto = { win: boolean; discard: boolean; skip: boolean; sort: boolean; coach: boolean }
  const [auto, setAutoState] = useState<Auto>(() => {
    const dflt: Auto = { win: false, discard: new URLSearchParams(location.search).has('auto'), skip: false, sort: true, coach: new URLSearchParams(location.search).has('tutorial') }
    try { if (new URLSearchParams(location.search).has('auto')) return dflt; return { ...dflt, ...JSON.parse(localStorage.getItem('kiiro-auto2') ?? '{}') } } catch { return dflt }
  })
  const setAuto = (k: keyof Auto) => {
    const n = { ...auto, [k]: !auto[k] }
    setAutoState(n)
    try { localStorage.setItem('kiiro-auto2', JSON.stringify(n)) } catch { /* ignore */ }
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
  const keyHandler = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null
    if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const k = e.key.toLowerCase()
    const act = (m: ClientMsg) => { e.preventDefault(); send(m) }
    if (v.phase === 'result') { if (!announce && (k === 'enter' || k === ' ')) act({ t: 'ack' }); return }
    if (panel) { if (k === 'escape') setPanel(null); return }
    if (online && (k === '/' || (k === 'enter' && !(o && sel !== null) && !reaction))) { e.preventDefault(); setPanel('chat'); return }
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
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandler(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const tenpaiKinds = v.hint?.discardWaits ?? {}
  const selWaits = sel !== null ? tenpaiKinds[kindOf(sel)] : undefined
  const ruleId = v.rule.id
  const ruleLabel = lang === 'zh' ? { taiwan: '台灣麻將', hk: '香港麻雀', riichi: '日本麻雀', mcr: '國標麻將', sichuan: '四川麻將' }[ruleId] : lang === 'ja' ? t(ruleId + '.name') : v.rule.name
  const ruleDetail =
    ruleId === 'taiwan' ? t('ind.tiles', { n: 16 }) :
    ruleId === 'hk' ? (sanma ? t('ind.sanma') + ' · ' : '') + t('ind.minFan', { n: view.config.minFan }) :
    ruleId === 'mcr' ? t('ind.minFan', { n: view.config.minFan }) :
    ruleId === 'riichi' ? (sanma ? t('ind.sanma') : view.config.aka ? t('ind.aka') : t('ind.noAka')) : t('ind.sichuan')
  const roundName = t('roundName', { wind: t('wind.' + v.roundWind), n: (v.roundIndex % n) + 1 })
  // with "organise my hand" off, tiles stay where they were: new tiles join the end instead of being sorted in
  const orderRef = useRef<{ hand: number; ids: number[] }>({ hand: -1, ids: [] })
  let handTiles = me.hand ?? []
  if (!auto.sort) {
    if (orderRef.current.hand !== v.handNo) orderRef.current = { hand: v.handNo, ids: [] }
    const have = new Set(handTiles)
    const kept = orderRef.current.ids.filter((i) => have.has(i))
    const fresh = handTiles.filter((i) => !kept.includes(i))
    orderRef.current.ids = [...kept, ...fresh]
    handTiles = orderRef.current.ids
  }
  // dora: what the indicators point at, and how many dora tiles I hold (dora + red fives + set-aside norths)
  const doraKinds = ruleId === 'riichi' ? v.dora.map((i) => doraFrom(kindOf(i), sanma)) : []
  const doraOf = (id: number) => doraKinds.filter((k) => k === kindOf(id)).length
  const akaOn = ruleId === 'riichi' && view.config.aka
  const doraInHand = ruleId !== 'riichi' ? 0
    : [...handTiles, ...(me.drawn !== null ? [me.drawn] : []), ...me.melds.flatMap((m) => m.tiles)].reduce((a, id) => a + doraOf(id) + (akaOn && isRedFive(id) ? 1 : 0), 0) + me.nuki.length

  // one clear line that always says what is happening / what to do
  let status = ''
  let mine = false
  if (v.phase === 'swap') { status = v.pick.swap[you] ? t('swapWaiting') : t('swapStatus'); mine = !v.pick.swap[you] }
  else if (v.phase === 'void') { status = v.pick.void[you] ? t('voidWaiting') : t('voidStatus'); mine = !v.pick.void[you] }
  else if (me.out) status = t('youWon')
  else if (reaction) { status = t('choose'); mine = true }
  else if (v.phase === 'turn' && v.turn === you && o?.discard.length) { status = t('yourTurn'); mine = true }
  else if (v.phase === 'turn') status = t('turnOf', { name: v.players[v.turn].name })
  else if (v.phase === 'reaction') status = t('waitingOthers')

  // static direction bars: light the side of whoever's turn it is (or who the table is waiting on)
  const activeSeats = v.phase === 'turn' ? [v.turn] : v.phase === 'reaction' || v.phase === 'swap' || v.phase === 'void' ? v.waiting : []
  const dirOn = (r: number) => activeSeats.some((sd) => (sd - you + n) % n === r)
  const dirs: [string, number][] = sanma ? [['bottom', 0], ['right', 1], ['left', 2]] : [['bottom', 0], ['right', 1], ['top', 2], ['left', 3]]

  const closeDock = () => { if (autosRef.current) autosRef.current.open = false }
  const autoMenu = (
    <details className="dock" ref={autosRef}>
      <summary aria-label={t('auto')}><span className="burger" aria-hidden="true"><i /><i /><i /></span></summary>
      <div className="dockpanel">
        {room && <div className="dockroom"><span className={'status-dot ' + (conn ?? '')} />{t('room')} <b>{room}</b></div>}
        <div className="dockrulename">{lang === 'zh' ? { taiwan: '台灣麻將', hk: '香港麻雀', riichi: '日本麻雀', mcr: '國標麻將', sichuan: '四川麻將' }[ruleId] : lang === 'ja' ? t(ruleId + '.name') : v.rule.name}</div>
        <button className="menuitem rulesbtn" onClick={() => { setPanel('rules'); closeDock() }}>{t('rulesRef')}</button>
        <div className={'auditline' + (v.audit.ok ? ' ok' : ' bad')} title={v.audit.problems.join('\n')}>{v.audit.ok ? t('auditOk', { n: v.audit.checks }) : t('auditBad')}</div>
        <div className="dockrule" />
        <div className="dockgroup">{t('auto')}</div>
        {([['sort', 'autoSort', auto.sort], ...(coachOk ? [['coach', 'coachSwitch', auto.coach] as const] : []), ['win', 'autoWin', auto.win], ['discard', 'autoDiscard', auto.discard], ['skip', 'skipCalls', auto.skip]] as const).map(([k, label, on]) => (
          <label key={k} className="switch" title={t(label + 'Tip')}><input type="checkbox" checked={on} onChange={() => setAuto(k)} /><span className="knob" />{t(label)}</label>
        ))}
        {!coachOk && <p className="muted small">{t('coachOffRoom')}</p>}
        {coachOk && <label className="switch" title={t('hintsTip')}><input type="checkbox" checked={hints} onChange={() => setHints(!hints)} /><span className="knob" />{t('hints')}</label>}
        <label className="switch"><input type="checkbox" checked={settings.showIndex} onChange={() => setSetting('showIndex', !settings.showIndex)} /><span className="knob" />{t('showIndex')}</label>
        <div className="tilestyle"><span>{t('tileSet')}</span>
          <div className="seg">{(['auto', 'chinese', 'japanese'] as const).map((k) => <button key={k} className={settings.tileStyle === k ? 'on' : ''} onClick={() => setSetting('tileStyle', k)}>{t({ auto: 'tileAuto', chinese: 'tileCn', japanese: 'tileJp' }[k])}</button>)}</div>
        </div>
        <div className="dockrule" />
        {online && <button className="menuitem" onClick={() => { setPanel('chat'); closeDock() }}>{t('chatTitle')}</button>}
        <button className="menuitem" onClick={() => { setPanel('history'); closeDock() }}>{t('history')}</button>
        <button className="menuitem" onClick={() => { setPanel('keys'); closeDock() }}>{t('shortcuts')}</button>
        <div className="dockrule" />
        <div className="seg langsw">
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
          <button className={lang === 'zh' && !simplified ? 'on' : ''} onClick={() => { setLang('zh'); setSimplified(false) }}>繁中</button>
          <button className={lang === 'zh' && simplified ? 'on' : ''} onClick={() => { setLang('zh'); setSimplified(true) }}>简中</button>
              <button className={lang === 'ja' ? 'on' : ''} onClick={() => setLang('ja')}>日本語</button>
        </div>
        <button className="btn alt leavebtn" onClick={onLeave}>{t('leave')}</button>
      </div>
    </details>
  )
  const swapping = v.phase === 'swap' && !v.pick.swap[you]
  const swapSuit = swapSel.length ? suitOf(kindOf(swapSel[0])) : -1
  const toggleSwap = (id: number) => setSwapSel((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 3 && (cur.length === 0 || suitOf(kindOf(id)) === suitOf(kindOf(cur[0]))) ? [...cur, id] : cur)
  const tileDim = (id: number) => swapping ? swapSuit >= 0 && suitOf(kindOf(id)) !== swapSuit : !!o && (!discardOk.has(id) || (riichiMode && !riichiOk.has(id)))
  const tileFlick = (id: number) => (swapping ? undefined : o && discardOk.has(id) && (!riichiMode || riichiOk.has(id)) ? () => send({ t: 'act', a: { type: 'discard', tile: id, riichi: riichiMode } }) : undefined)
  const tileClick = (id: number) => (swapping ? () => toggleSwap(id) : o && discardOk.has(id) && (!riichiMode || riichiOk.has(id)) ? () => clickTile(id) : undefined)

  // tell the table when someone drops out or comes back
  const prevConn = useRef<Record<number, boolean>>({})
  const [note, setNote] = useState('')
  useEffect(() => {
    let msg = ''
    for (const p of v.players) {
      if (!p.human || p.seat === you) continue
      const was = prevConn.current[p.seat]
      if (was === true && !p.connected) msg = t('playerDropped', { name: p.name })
      else if (was === false && p.connected) msg = t('playerBack', { name: p.name })
      prevConn.current[p.seat] = p.connected
    }
    if (!msg) return
    setNote(msg)
    const id = setTimeout(() => setNote(''), 4000)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.players.map((p) => (p.connected ? 1 : 0)).join('')])
  const [, setOrderTick] = useState(0)
  // drag a tile sideways to put it where you want (only when "organise my hand" is off)
  const dragTile = (id: number, x: number) => {
    const ids = orderRef.current.ids
    if (!ids.includes(id)) return
    const els = [...document.querySelectorAll<HTMLElement>('.handrow .tile')].slice(0, ids.length)
    const centers = els.map((e, i) => ({ id: ids[i], c: e.getBoundingClientRect().left + e.getBoundingClientRect().width / 2 })).filter((o) => o.id !== id)
    const idx = centers.filter((o) => o.c < x).length
    const rest = ids.filter((i) => i !== id)
    rest.splice(idx, 0, id)
    if (rest.join() !== ids.join()) { orderRef.current.ids = rest; setOrderTick((n) => n + 1) }
  }
  // selecting a tile lights up every tile of that kind on the table (hand, rivers, melds)
  const [hoverKind, setHoverKind] = useState<number | null>(null) // pointing at a tile (mouse only) lights up the same tile everywhere, like a selection
  const hlKind = sel !== null ? kindOf(sel) : swapSel.length ? kindOf(swapSel[swapSel.length - 1]) : hoverKind
  useEffect(() => {
    document.querySelectorAll('.tile.hl').forEach((e) => e.classList.remove('hl'))
    if (hlKind === null) return
    document.querySelectorAll<HTMLElement>(`.gamecol .tile[data-kind="${hlKind}"]`).forEach((e) => e.classList.add('hl'))
  })
  // guided practice game: one short tip the first time each situation comes up
  const tutorial = typeof location !== 'undefined' && new URLSearchParams(location.search).has('tutorial')
  const [tutSeen, setTutSeen] = useState<string[]>([])
  const [tutOpen, setTutOpen] = useState<string | null>(null)
  const tutKey = !tutorial || v.phase === 'result' || v.phase === 'over' ? null
    : reaction ? 'reaction'
      : v.phase === 'turn' && v.turn === you && o?.discard.length ? (me.discards.length === 0 ? 'first' : v.coach?.n === 0 ? 'tenpai' : 'turn')
        : v.phase === 'turn' ? 'others' : null
  useEffect(() => {
    if (tutKey && !tutSeen.includes(tutKey)) { setTutOpen(tutKey); setTutSeen((x) => [...x, tutKey]) }
  }, [tutKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const [help, setHelp] = useState('')
  useEffect(() => { setHelp('') }, [v.phase, v.turn])
  const barRef = useRef<HTMLDivElement>(null)
  const [barW, setBarW] = useState(0)
  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const measure = () => setBarW(el.clientWidth)
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  // the hand is drawn at real size across the full width: as large as fits, never huge
  const usable = Math.max(200, barW - 24)
  // The hand tile size depends only on the screen width and the ruleset (never on how many tiles are in the hand right now),
  // so tiles do not change size while drawing, discarding or calling. Melds sit in the room freed by the tiles they replace.
  const slots = v.rule.nSets === 5 ? 17 : 14
  const fitTw = (usable - 3 * slots) / (slots + 0.45 + 0.6)
  // very narrow screens (portrait phones): two rows of tiles instead of tiny ones
  const twoRows = fitTw < 32
  const perRow = Math.ceil(slots / 2)
  // a phone held sideways is only ~390 px tall: smaller hand tiles leave room for the rivers and the other players' hands
  const shortScreen = typeof window !== 'undefined' && window.innerHeight <= 520 && window.innerWidth > window.innerHeight
  const tw = twoRows ? Math.max(24, Math.min(60, Math.floor((usable - 3 * perRow) / (perRow + 0.2)))) : Math.max(20, Math.min(shortScreen ? 40 : 76, Math.floor(fitTw)))
  // Pon / Kan / Chi buttons show no tiles: pointing at (or focusing / touching) a button lights up the tiles it would use in your hand, and the discard it takes
  const [callHl, setCallHl] = useState<{ ids: number[]; discard: boolean } | null>(null)
  const handIdsOfKind = (k: number, n: number) => [...(me.hand ?? []), ...(me.drawn !== null ? [me.drawn] : [])].filter((i) => kindOf(i) === k).slice(0, n)
  // on a touch screen there is no hover: the first tap on a call button arms it (its tiles light up, like selecting a tile), the second tap confirms
  const [callArm, setCallArm] = useState<string | null>(null)
  const hlProps = (key: string, ids: number[], discard: boolean, tip: string, go: () => void) => ({
    onMouseEnter: () => { setCallHl({ ids, discard }); setHelp(t(tip)) },
    onMouseLeave: () => { if (!callArm) setCallHl(null) },
    onFocus: () => { setCallHl({ ids, discard }); setHelp(t(tip)) },
    onBlur: () => { if (!callArm) setCallHl(null) },
    onClick: () => {
      const touch = typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches
      if (!touch || callArm === key) { setCallArm(null); setCallHl(null); go() } else { setCallArm(key); setCallHl({ ids, discard }); setHelp(t('tapAgain')) }
    },
    'data-armed': callArm === key ? '1' : undefined,
  })
  const shortKind = (k: number) => (suitOf(k) < 3 ? `${numOf(k)}${lang === 'en' ? 'mps'[suitOf(k)] : '萬筒索'[suitOf(k)]}` : '')
  useEffect(() => {
    document.querySelectorAll('.tile.callhl').forEach((e) => e.classList.remove('callhl'))
    if (!callHl) return
    for (const id of callHl.ids) document.querySelectorAll(`.gamecol .handrow .tile[data-id="${id}"]`).forEach((e) => e.classList.add('callhl'))
    if (callHl.discard) document.querySelectorAll('.gamecol .pond .tile.last').forEach((e) => e.classList.add('callhl'))
  })
  useEffect(() => { setCallArm(null); if (!reaction && !o) setCallHl(null) }, [reaction, o, v.turn, v.phase])
  const popOpen = (v.phase === 'swap' && !v.pick.swap[you]) || (v.phase === 'void' && !v.pick.void[you]) || !!reaction || (!!o && (o.tsumo || o.riichi.length > 0 || o.ankan.length > 0 || o.kakan.length > 0 || o.nuki || o.abort))

  return (
    <div className={'gamecol' + (winning ? ' winning' + (iWon ? ' iwon' : '') : '')}
      onMouseOver={(e) => { const el = (e.target as HTMLElement).closest?.('.tile[data-kind]') as HTMLElement | null; const k = el && !el.classList.contains('back') && matchMedia('(hover: hover)').matches ? Number(el.dataset.kind) : null; setHoverKind((cur) => (cur === k ? cur : k)) }}
      onMouseLeave={() => setHoverKind(null)}
      onPointerDownCapture={(e) => { if (callArm && !(e.target as HTMLElement).closest?.('.actionpop .cbtn')) { setCallArm(null); setCallHl(null) } }}>
      {me.human && me.idle && v.phase !== 'over' && (
        <div className="overlay idleover" role="alertdialog">
          <div className={'modal idlemodal ' + me.idle}>
            <h2>{t('idleTitle')}</h2>
            <p>{t(me.idle === 'auto' ? 'idleAuto' : 'idleSlow')}</p>
            <button className="btn gold big" onClick={() => send({ t: 'here' })}>{t('imBack')}</button>
          </div>
        </div>
      )}
      <div className="toprow">
        <button className="rulechip" onClick={() => setPanel('rules')} title={t('ind.open')} aria-label={t('ind.open')}>
          <b>{ruleLabel}</b><span>{ruleDetail}</span><i aria-hidden="true">i</i>
        </button>
        {room && <span className="roomchip" title={t('room')}><span className="rl">{t('room')}</span> <b>{room}</b></span>}
      </div>
      <Stage allowRotate={false}>
    <div className="board" style={{ ['--hand' as string]: v.rule.nSets === 5 ? 17 : 14 }}>
      {sanma ? <div className="seat top" /> : <Opp p={rel(2)} v={v} pos="top" />}
      <Opp p={sanma ? rel(2) : rel(3)} v={v} pos="left" />
      <div className="center"><div className={'cgrid' + (v.rule.id === 'riichi' ? ' jp' : '')} style={{ ['--rows' as string]: Math.min(5, Math.max(3, Math.ceil(Math.max(0, ...v.players.map((q) => q.discards.length)) / 6))) }}>
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
          {dirs.map(([name, r]) => dirOn(r) ? <span key={'b' + name} className={`dirbar db-${name}`} /> : null)}
          {dirs.map(([name, r]) => rel(r).riichi ? <span key={'r' + name} className={`rstick rs-${name}`} title={`${rel(r).name}: ${t('riichi')}`} /> : null)}
          {dirs.map(([name, r]) => <span key={name} className={`cw cw-${name}` + (dirOn(r) ? ' on' : '') + (rel(r).seat === v.dealer ? ' east' : '')}><b>{WINDS[lang === 'en' ? 'en' : 'zh'][rel(r).seatWind]}</b></span>)}
          <div className="rnd">{roundName}</div>
          <div className="infolines">{[
            `${t('wall')} ${v.wallLeft}`,
            ruleId === 'riichi' && v.honba > 0 ? t('honbaShort', { n: v.honba }) : '',
            ruleId === 'riichi' && v.sticks > 0 ? t('sticksShort', { n: v.sticks }) : '',
            ruleId !== 'riichi' && v.lian > 0 ? t('streakShort', { n: v.lian }) : '',
          ].filter(Boolean).map((x) => <div key={x} className="muted">{x}</div>)}</div>
        </div>
        <Pond p={rel(1)} v={v} rel={1} />
        <Pond p={me} v={v} rel={0} />
      </div></div>
      <Opp p={rel(1)} v={v} pos="right" />
      </div>
      </Stage>
      <div className={'handbar' + (popOpen ? ' acting' : '')} ref={barRef} style={{ ['--hw' as string]: tw + 'px' }}>
        {popOpen && (
          <div className="actionpop">
            {v.phase === 'swap' && !v.pick.swap[you] && (
              <div className="apbtns">
                <span className="pickhint">{t('swapHint', { n: swapSel.length })}</span>
                <button className="cbtn call" disabled={swapSel.length !== 3} onClick={() => send({ t: 'swap', tiles: swapSel })}><b>{t('confirm')}</b></button>
              </div>
            )}
            {v.phase === 'void' && !v.pick.void[you] && (
              <div className="apbtns">
                <span className="pickhint">{t('voidHint')}</span>
                {[0, 1, 2].map((su) => {
                  const have = [...handTiles, ...(me.drawn !== null ? [me.drawn] : [])].filter((i) => suitOf(kindOf(i)) === su).length
                  return <button key={su} className="cbtn call" onClick={() => send({ t: 'void', suit: su })}><b>{t('suit.' + su)}</b><span className="mini muted">{have}</span></button>
                })}
              </div>
            )}
            <div className="apbtns">
              {reaction && v.lastDiscard && (<>
                {reaction.ron && <button className={'cbtn ron' + (auto.coach && v.coach?.kind === 'ron' ? ' coachpick' : '')} title={t('tip.ron')} onMouseEnter={() => setHelp(t('tip.ron'))} onFocus={() => setHelp(t('tip.ron'))} onClick={() => send({ t: 'decide', d: { type: 'ron' } })}><b>{t('ron')}</b></button>}
                {reaction.pon && (
                  <button className={'cbtn call' + (auto.coach && v.coach?.call === 'pon' ? ' coachpick' : '')} title={t('tip.pon')} {...hlProps('b1-' + (handIdsOfKind(kindOf(v.lastDiscard!.tile), 2)).join(','), handIdsOfKind(kindOf(v.lastDiscard!.tile), 2), true, 'tip.pon', () => send({ t: 'decide', d: { type: 'pon' } }))} >
                    <b>{t('pon')}</b>
                  </button>
                )}
                {reaction.minkan && (
                  <button className={'cbtn call' + (auto.coach && v.coach?.call === 'minkan' ? ' coachpick' : '')} title={t('tip.kan')} {...hlProps('b2-' + (handIdsOfKind(kindOf(v.lastDiscard!.tile), 3)).join(','), handIdsOfKind(kindOf(v.lastDiscard!.tile), 3), true, 'tip.kan', () => send({ t: 'decide', d: { type: 'minkan' } }))} >
                    <b>{t('kan')}</b>
                  </button>
                )}
                {reaction.chi.map((c, i) => (
                  <button key={i} className={'cbtn call' + (auto.coach && v.coach?.call === 'chi' ? ' coachpick' : '')} title={t('tip.chi')} {...hlProps('b3-' + (c).join(','), c, true, 'tip.chi', () => send({ t: 'decide', d: { type: 'chi', use: c } }))} >
                    <b>{t('chi')}</b>{reaction.chi.length > 1 && <span className="sfx">{c.map((id) => numOf(kindOf(id))).sort((x, y) => x - y).join('·')}</span>}
                  </button>
                ))}
              </>)}
              {reaction && <button className={'cbtn pass' + (auto.coach && v.coach?.kind === 'pass' ? ' coachpick' : '')} title={t('tip.pass')} onMouseEnter={() => setHelp(t('tip.pass'))} onFocus={() => setHelp(t('tip.pass'))} onClick={() => send({ t: 'decide', d: { type: 'pass' } })}><b>{t('pass')}</b></button>}
            {o?.tsumo && <button className={'cbtn ron' + (auto.coach && v.coach?.kind === 'tsumo' ? ' coachpick' : '')} title={t('tip.tsumo')} onMouseEnter={() => setHelp(t('tip.tsumo'))} onFocus={() => setHelp(t('tip.tsumo'))} onClick={() => send({ t: 'act', a: { type: 'tsumo' } })}>{t('tsumo')}</button>}
            {o && o.riichi.length > 0 && (
              <button className={'cbtn ' + (riichiMode ? 'ron' : 'call') + (auto.coach && v.coach?.kind === 'riichi' ? ' coachpick' : '')} title={t('tip.riichi')} onMouseEnter={() => setHelp(t('tip.riichi'))} onFocus={() => setHelp(t('tip.riichi'))} onClick={() => { setRiichiMode(!riichiMode); setSel(null) }}>{riichiMode ? t('cancelRiichi') : t('riichi')}</button>
            )}
            {o?.nuki && <button className="cbtn call" onClick={() => send({ t: 'act', a: { type: 'nuki' } })}><b>{t('nuki')}</b></button>}
            {o?.ankan.map((k) => <button key={'a' + k} className="cbtn call" title={t('tip.ankan')} {...hlProps('b4-' + (handIdsOfKind(k, 4)).join(','), handIdsOfKind(k, 4), false, 'tip.ankan', () => send({ t: 'act', a: { type: 'ankan', kind: k } }))} ><b>{t('kan')}</b>{o.ankan.length > 1 && <span className="sfx">{shortKind(k)}</span>}</button>)}
            {o?.kakan.map((id) => <button key={'k' + id} className="cbtn call" title={t('tip.addKan')} {...hlProps('b5-' + ([id]).join(','), [id], false, 'tip.addKan', () => send({ t: 'act', a: { type: 'kakan', tile: id } }))} ><b>{t('addKan')}</b>{o.kakan.length > 1 && <span className="sfx">{shortKind(kindOf(id))}</span>}</button>)}
            {o?.abort && <button className="cbtn pass" onClick={() => send({ t: 'act', a: { type: 'abort' } })}><b>{t('abortDraw')}</b></button>}
            </div>
            {secs !== null && mine && <span className={'calltimer' + (secs <= 8 ? ' low' : '')}>{secs}s</span>}
          </div>
        )}
        <div className="notes">
          {!popOpen && hints && v.hint && (
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
                        <span className="wmeta"><b>{t('leftTiles', { n: left })}</b><span title={val ? '' : t('noValue')} className={val ? '' : 'nowin'}>{val ? `${val.label ? t('label.' + val.label) !== 'label.' + val.label ? t('label.' + val.label) : val.label : `${val.total} ${t(ruleId === 'riichi' ? 'han' : ruleId === 'hk' || ruleId === 'mcr' ? 'fan' : 'tai')}`}${val.riichi ? ' ' + t('withRiichi') : ''}` : (v.hint!.why?.[k] ? t('why.' + v.hint!.why[k].code, { n: v.hint!.why[k].n ?? 0, need: v.hint!.why[k].need ?? 0 }) : '—')}</span></span>
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
          {help && popOpen && <div className="callhelp">{help}</div>}
          {riichiMode && furiSet.size > 0 && <div className={'callhelp furiwarn' + (sel !== null && furiSet.has(sel) ? ' on' : '')} role="alert">{t('furiWarn')}</div>}
        {auto.coach && v.coach && (
          <div className="coachcard" role="note">
            <span className="cicon" aria-hidden="true">?</span>
            {v.coach.tile !== undefined && <span className="nbtile"><Tile id={v.coach.tile} /></span>}
            <span>{coachText(v.coach, t)}</span>
          </div>
        )}
        {v.notice && (
          <div className="noticebar" role="alert">
            <span className="nbicon" aria-hidden="true">!</span>
            {v.notice.tile !== undefined && <span className="nbtile"><Tile id={v.notice.tile} /></span>}
            <span>{t('notice.' + v.notice.code, { n: v.notice.n ?? 0, need: v.notice.need ?? 0, suit: v.notice.suit !== undefined ? t('suit.' + v.notice.suit) : '' })}</span>
          </div>
        )}
        </div>
        <div className="infoline">
          <div className="infoleft">
          <Chip p={me} v={v} />
          {doraInHand > 0 && <span className="dorapill" title={t('doraInHand')}>★ {doraInHand}</span>}
          {(me.flowers.length > 0 || me.nuki.length > 0) && <div className="flowers">{[...me.flowers, ...me.nuki].map((f) => <Tile key={f} id={f} />)}</div>}
        </div>
          <div className={'statusbar' + (mine ? ' mine' : '')}>
            {reaction && v.lastDiscard ? t('discarded', { name: v.players[v.lastDiscard.from].name }) : status}
            {secs !== null && mine && <span className="timer"> · {t('timeLeft', { s: secs })}</span>}
          </div>
        
        </div>
        <div className={'handrow' + (mine ? ' mine' : '') + (twoRows ? ' two' : '')} style={{ ['--tw' as string]: tw + 'px' }}>
          {handTiles.map((id) => (
            <Tile key={id} id={id} className={auto.coach && v.coach?.tile === id && (v.coach.kind === 'discard' || v.coach.kind === 'riichi') ? 'coachpick' : ''} dora={doraOf(id) || undefined} badge={riichiMode && furiSet.has(id) ? t('furiBadge') : undefined} selected={sel === id || swapSel.includes(id)} onClick={tileClick(id)} onFlick={tileFlick(id)} onDrag={!auto.sort ? (x) => dragTile(id, x) : undefined} dim={tileDim(id)} mark={hints && !!o && !!tenpaiKinds[kindOf(id)]} />
          ))}
          {me.drawn !== null && (
            <>
              <span className="hand-extra" />
              <Tile id={me.drawn} className={'drawn ' + (auto.coach && v.coach?.tile === me.drawn && (v.coach.kind === 'discard' || v.coach.kind === 'riichi') ? 'coachpick' : '')} dora={doraOf(me.drawn) || undefined} selected={sel === me.drawn} onClick={tileClick(me.drawn)} onFlick={tileFlick(me.drawn)} dim={tileDim(me.drawn)} mark={hints && !!o && !!tenpaiKinds[kindOf(me.drawn)]} />
            </>
          )}
          {me.melds.length > 0 && <div className="melds mymelds">{me.melds.map((m, i) => <MeldView key={i} m={m} owner={me.seat} n={n} />)}</div>}
        </div>
      </div>
      {autoMenu}
      {announce && v.result && (
        <div className="winannounce" role="status" aria-live="assertive">
          <div className="wa-title">{t('winTitle', { name: v.players[v.result.winner!].name })}</div>
          <div className="wa-sub">{v.result.tsumo ? t('selfDraw') : t('winsFrom', { from: v.players[v.result.from!].name })}</div>
          {v.result.winTile !== undefined && <div className="wa-tile"><Tile id={v.result.winTile} /></div>}
        </div>
      )}
    {tutorial && tutOpen && (
      <div className="tutcard" role="dialog">
        <b>{t('tut.title')}</b>
        <p>{t('tut.' + tutOpen)}</p>
        <button className="btn sm gold" onClick={() => setTutOpen(null)}>{t('tut.ok')}</button>
      </div>
    )}
      {note && <div className="toast" role="status">{note}</div>}
      {online && <ChatFeed v={v} send={send} open={panel === 'chat'} onClose={() => setPanel(null)} onOpen={() => setPanel('chat')} />}
      {panel === 'rules' && <RulesHelp initial={ruleId} onClose={() => setPanel(null)} />}
      {panel === 'history' && <HistoryModal v={v} you={you} onClose={() => setPanel(null)} />}
      {panel === 'keys' && <ShortcutsModal onClose={() => setPanel(null)} />}
      {(v.phase === 'over' || (v.phase === 'result' && !announce)) && <ResultModal view={view} send={send} onLeave={onLeave} />}
    </div>
  )
}
