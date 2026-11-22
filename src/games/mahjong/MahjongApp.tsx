import { AccountChip } from '../../account/Panels'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_CONFIG, type RoomConfig, type TableView } from './engine/table'
import { connectLocal, connectRemote, getClientId, type Conn, type Handlers, type Status } from './net/client'
import type { ClientMsg } from './net/protocol'
import { Menu, RoomLobby } from './ui/Lobby'
import { Board } from './ui/Board'
import { AkaCtx } from './ui/Tile'
import { useLang } from '../../i18n'
import './strings'
import { TileGallery } from './ui/TileGallery'
import { stressView } from './ui/stress'
import { RulesHelp } from './ui/RulesHelp'
import { Guide } from './ui/Guide'
import { ConnBadge } from './ui/ConnBadge'

const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d } catch { return d } }
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }
const makeCode = () => String(Math.floor(Math.random() * 9000) + 1000) // four digits, never starts with 0

export default function MahjongApp() {
  const { lang, setLang, simplified, setSimplified, t } = useLang()
  const [rulesOpen, setRulesOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [name, setName] = useState(() => load('kiiro-name', 'Player'))
  const [config, setConfig] = useState<RoomConfig>(() => load('kiiro-config', DEFAULT_CONFIG))
  const [hints, setHints] = useState(() => load('kiiro-hints', false))
  const stress = new URLSearchParams(location.search).get('stress')
  const [view, setView] = useState<TableView | null>(() => (stress ? stressView(stress, Number(new URLSearchParams(location.search).get('players') ?? 4), new URLSearchParams(location.search).get('rule') ?? 'taiwan') : null))
  // bots are named "Bot 1…" by the engine; show them in the player's language
  const shown = useMemo(() => {
    if (!view) return view
    const loc = (n: string) => { const m = /^Bot (\d+)$/.exec(n); return m ? t('botName', { n: m[1] }) : n }
    return { ...view, seats: view.seats.map((x) => ({ ...x, name: loc(x.name) })), game: view.game ? { ...view.game, players: view.game.players.map((p) => ({ ...p, name: loc(p.name) })), standings: view.game.standings?.map((x) => ({ ...x, name: loc(x.name) })) } : view.game } as typeof view
  }, [view, t])
  // the page takes the accent colour of the game being set up or played (see the [data-rule] block in parlour.css)
  useEffect(() => { document.documentElement.dataset.rule = (view?.config.rule ?? config.rule) as string }, [view?.config.rule, config.rule])
  const [room, setRoom] = useState<string | null>(() => (new URLSearchParams(location.search).get('stress') ? '4829' : null))
  const [status, setStatus] = useState<Status>('closed')
  const [error, setError] = useState('')
  const [joinError, setJoinError] = useState('')
  const [latency, setLatency] = useState<number | null>(null)
  const [active, setActive] = useState(!!stress)
  const conn = useRef<Conn | null>(null)
  const viewRef = useRef<TableView | null>(null)
  viewRef.current = view
  const id = useRef(getClientId())

  useEffect(() => save('kiiro-name', name), [name])
  useEffect(() => save('kiiro-config', config), [config])
  useEffect(() => save('kiiro-hints', hints), [hints])

  const pendingCfg = useRef<RoomConfig | null>(null) // the rules picked in the menu, sent to a room the moment it is created
  const failTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leave = useCallback(() => {
    seq.current++; pendingCfg.current = null; if (failTimer.current) { clearTimeout(failTimer.current); failTimer.current = null }
    try { conn.current?.send({ t: 'bye' }) } catch { /* ignore */ } // a deliberate leave: a bot takes the seat straight away
    conn.current?.close(); conn.current = null
    setView(null); setRoom(null); setActive(false); setStatus('closed'); setJoinError('')
    try { localStorage.removeItem('kiiro-last-room') } catch { /* ignore */ }
    history.replaceState(null, '', location.pathname)
  }, [])

  const seq = useRef(0) // every connection gets a number; once the player leaves or starts another one, the old one can no longer touch the UI
  const guard = <H extends Handlers>(h: H, mine: number): H => ({ ...h, onView: (v: TableView) => { if (seq.current === mine) h.onView(v) }, onStatus: (st: Status) => { if (seq.current === mine) h.onStatus(st) }, onError: (m: string) => { if (seq.current === mine) h.onError(m) }, onLatency: (ms: number) => { if (seq.current === mine) h.onLatency?.(ms) } })
  const handlers = { onView: setView, onStatus: (st: Status) => { setStatus(st); if (st !== 'open') setLatency(null) }, onLatency: setLatency, onError: (m: string) => { setError(m); setJoinError(m); setTimeout(() => setError(''), 4000) } }
  const solo = () => {
    const q = new URLSearchParams(location.search) // debug overrides: ?rule=riichi&players=3
    const cfg = { ...config, ...(q.get('rule') ? { rule: q.get('rule') as RoomConfig['rule'] } : {}), ...(q.get('players') ? { players: Number(q.get('players')) as 3 | 4 } : {}) }
    setActive(true); conn.current = connectLocal(id.current, name || 'Player', cfg, guard(handlers, ++seq.current))
  }
  const tutorial = () => {
    // a guided practice game: easy bots, the coach switched on, tips that explain each moment
    history.replaceState(null, '', '?tutorial=1')
    setActive(true)
    conn.current = connectLocal(id.current, name || 'Player', { ...config, botLevel: 'easy', rounds: 1 }, guard(handlers, ++seq.current))
  }
  const joinRoom = useCallback((code: string, create = false, attempt = 0) => {
    const c = code.toUpperCase()
    conn.current?.close(); conn.current = null // never two connections at once
    setView(null); setJoinError('')
    try { localStorage.setItem('kiiro-last-room', c) } catch { /* ignore */ }
    setRoom(c); setActive(true)
    const dbg = new URLSearchParams(location.search).has('debug')
    history.replaceState(null, '', `?room=${c}${dbg ? '&debug=1' : ''}`)
    if (!create) pendingCfg.current = null
    const roomHandlers = {
      ...handlers,
      onView: (v: TableView) => {
        if (pendingCfg.current && v.host && v.status === 'lobby') { // a freshly created room starts with the default rules: apply what the player chose
          const { rule, rounds, aka, minFan, players, botLevel, swap } = pendingCfg.current
          pendingCfg.current = null
          conn.current?.send({ t: 'config', config: { rule, rounds, aka, minFan, players, botLevel, swap } })
        }
        handlers.onView(v)
      },
      onError: (m: string) => {
        if (create && m === 'code_taken' && attempt < 8) { conn.current?.close(); joinRoom(makeCode(), true, attempt + 1); return } // that code is already in use: pick another
        if (m === 'room_not_found' || m === 'room_full' || m === 'code_taken') { // forget the stale room so a refresh does not try it again
          try { localStorage.removeItem('kiiro-last-room') } catch { /* ignore */ }
          history.replaceState(null, '', location.pathname)
        }
        handlers.onError(m)
      },
    }
    const mine = ++seq.current
    conn.current = connectRemote(c, id.current, name || 'Player', guard(roomHandlers, mine), create)
    if (dbg) (window as unknown as { __kiiroConn?: Conn }).__kiiroConn = conn.current // test hook
    // give up with a clear message if the server never answers
    if (failTimer.current) clearTimeout(failTimer.current)
    failTimer.current = setTimeout(() => { if (seq.current === mine && !viewRef.current) setJoinError('conn_failed') }, 12000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])
  const send = (m: ClientMsg) => {
    if (room && status !== 'open') { setError('notSent'); setTimeout(() => setError(''), 2500); return }
    conn.current?.send(m)
  }

  useEffect(() => {
    const r = new URLSearchParams(location.search).get('room')
    if (r) {
      setRoom(r.toUpperCase())
      // page refresh inside a room: rejoin automatically (same client id => same seat)
      try { if (localStorage.getItem('kiiro-last-room') === r.toUpperCase() && !new URLSearchParams(location.search).has('solo')) joinRoom(r) } catch { /* ignore */ }
    }
  }, [])
  useEffect(() => () => conn.current?.close(), [])
  useEffect(() => { if (new URLSearchParams(location.search).has('solo') && !conn.current) solo() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [urlGone, setUrlGone] = useState(false)
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('tiles')) return <TileGallery />
  const urlRoom = !active && !urlGone && !new URLSearchParams(location.search).has('solo') ? new URLSearchParams(location.search).get('room') : null
  const playing = view?.status === 'playing' && view.game
  const aka = (view?.config.aka ?? false) && view?.config.rule === 'riichi'

  return (
    <AkaCtx.Provider value={aka}>
      <div className={'app' + (playing ? ' game' : '')}>
        {!playing && !active && <div className="accorner"><AccountChip /></div>}
        {!playing && (
          <div className="floatbar">
            {room && active && !view && <span className="roomtag"><span className={'status-dot ' + status} />{room}</span>}
            <button className="rulesfab" onClick={() => setGuideOpen(true)}><span aria-hidden="true">🎓</span><span className="fablabel"> {t('guideBtn')}</span></button>
            <button className="rulesfab" onClick={() => setRulesOpen(true)}><span aria-hidden="true">📖</span><span className="fablabel"> {t('rulesRef')}</span></button>
            <div className="seg langsw">
              <button className={lang === 'en' ? 'on' : ''} onClick={() => { setLang('en') }}>EN</button>
              <button className={lang === 'zh' && !simplified ? 'on' : ''} onClick={() => { setLang('zh'); setSimplified(false) }}>繁中</button>
              <button className={lang === 'zh' && simplified ? 'on' : ''} onClick={() => { setLang('zh'); setSimplified(true) }}>简中</button>
              <button className={lang === 'ja' ? 'on' : ''} onClick={() => setLang('ja')}>日本語</button>
            </div>
          </div>
        )}
        {room && active && view && (stress ? new URLSearchParams(location.search).has('ping') : true) && <ConnBadge status={stress ? 'open' : status} latency={stress ? 42 : latency} />}
        {rulesOpen && <RulesHelp initial={config.rule} onClose={() => setRulesOpen(false)} />}
        {guideOpen && <Guide onClose={() => setGuideOpen(false)} onPractice={tutorial} />}
        {error && !(active && !view) && <div className="toast">{t(error) !== error ? t(error) : error}</div>}
        {!active && urlRoom && (
          <div className="page joinpage">
            <h1>{t('joinRoomTitle')} <span style={{ color: 'var(--accent)' }}>{urlRoom.toUpperCase()}</span></h1>
            <p className="muted">{t('invited')}</p>
            <form className="card joincard" onSubmit={(e) => { e.preventDefault(); joinRoom(urlRoom) }}>
              <label className="muted" htmlFor="nick">{t('nickname')}</label>
              <input id="nick" type="text" autoFocus value={name === 'Player' ? '' : name} placeholder={t('yourName')} maxLength={16} onChange={(e) => setName(e.target.value || 'Player')} />
              <button className="btn gold big" type="submit">{t('joinRoom')}</button>
              <button className="btn alt" type="button" onClick={() => { history.replaceState(null, '', location.pathname); setRoom(null); setUrlGone(true) }}>{t('backMenu')}</button>
            </form>
          </div>
        )}
        {!active && !urlRoom && (
          <>
            <Menu name={name} setName={setName} config={config} setConfig={setConfig} onSolo={solo} onTutorial={tutorial} onCreate={() => { pendingCfg.current = config; joinRoom(makeCode(), true) }} onJoin={joinRoom} />
          </>
        )}
        {active && !view && joinError && (
          <div className="page joinpage">
            <h1>{t('cantJoin')}</h1>
            <p className="muted">{t(joinError) !== joinError ? t(joinError) : joinError}</p>
            <button className="btn gold big" onClick={leave}>{t('backMenu')}</button>
          </div>
        )}
        {active && !view && !joinError && <div className="page joinpage"><p className="muted">{status === 'closed' ? t('connLost') : t('connecting')}</p><button className="btn alt" onClick={leave}>{t('leave')}</button></div>}
        {active && shown && !playing && room && <RoomLobby view={shown} room={room} send={send} onLeave={leave} />}
        {active && shown && playing && <Board room={room} status={status} view={shown} send={send} hints={hints} setHints={setHints} onLeave={leave} online={!!room || !!stress} />}
      </div>
    </AkaCtx.Provider>
  )
}
