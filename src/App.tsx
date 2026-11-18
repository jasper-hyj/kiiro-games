import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_CONFIG, type RoomConfig, type TableView } from './engine/table'
import { connectLocal, connectRemote, getClientId, type Conn, type Status } from './net/client'
import type { ClientMsg } from './net/protocol'
import { Menu, RoomLobby } from './ui/Lobby'
import { Board } from './ui/Board'
import { AkaCtx } from './ui/Tile'
import { useLang } from './i18n'
import { TileGallery } from './ui/TileGallery'
import { stressView } from './ui/stress'
import { setSetting, useSettings } from './settings'
import { ConnBadge } from './ui/ConnBadge'
import { RotatePrompt } from './ui/RotatePrompt'

const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d } catch { return d } }
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }
const makeCode = () => String(Math.floor(Math.random() * 900000) + 100000) // six digits, never starts with 0

export default function App() {
  const { lang, setLang, t } = useLang()
  const settings = useSettings()
  const [name, setName] = useState(() => load('kiiro-name', 'Player'))
  const [config, setConfig] = useState<RoomConfig>(() => load('kiiro-config', DEFAULT_CONFIG))
  const [hints, setHints] = useState(() => load('kiiro-hints', false))
  const stress = new URLSearchParams(location.search).get('stress')
  const [view, setView] = useState<TableView | null>(() => (stress ? stressView(stress, Number(new URLSearchParams(location.search).get('players') ?? 4), new URLSearchParams(location.search).get('rule') ?? 'taiwan') : null))
  const [room, setRoom] = useState<string | null>(null)
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

  const leave = useCallback(() => {
    conn.current?.close(); conn.current = null
    setView(null); setRoom(null); setActive(false); setStatus('closed'); setJoinError('')
    try { localStorage.removeItem('kiiro-last-room') } catch { /* ignore */ }
    history.replaceState(null, '', location.pathname)
  }, [])

  const handlers = { onView: setView, onStatus: (st: Status) => { setStatus(st); if (st !== 'open') setLatency(null) }, onLatency: setLatency, onError: (m: string) => { setError(m); setJoinError(m); setTimeout(() => setError(''), 4000) } }
  const solo = () => {
    const q = new URLSearchParams(location.search) // debug overrides: ?rule=riichi&players=3
    const cfg = { ...config, ...(q.get('rule') ? { rule: q.get('rule') as RoomConfig['rule'] } : {}), ...(q.get('players') ? { players: Number(q.get('players')) as 3 | 4 } : {}) }
    setActive(true); conn.current = connectLocal(id.current, name || 'Player', cfg, handlers)
  }
  const joinRoom = useCallback((code: string) => {
    const c = code.toUpperCase()
    try { localStorage.setItem('kiiro-last-room', c) } catch { /* ignore */ }
    setRoom(c); setActive(true)
    const dbg = new URLSearchParams(location.search).has('debug')
    history.replaceState(null, '', `?room=${c}${dbg ? '&debug=1' : ''}`)
    conn.current = connectRemote(c, id.current, name || 'Player', handlers)
    if (dbg) (window as unknown as { __kiiroConn?: Conn }).__kiiroConn = conn.current // test hook
    // give up with a clear message if the server never answers
    setTimeout(() => { if (!viewRef.current) setJoinError('conn_failed') }, 12000)
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
        {!playing && (
          <div className="floatbar">
            {room && active && !view && <span className="roomtag"><span className={'status-dot ' + status} />{room}</span>}
            <details className="gear">
              <summary aria-label={t('settings')}>⚙</summary>
              <div className="gearpanel">
                <label className="switch"><input type="checkbox" checked={settings.reduceMotion} onChange={() => setSetting('reduceMotion', !settings.reduceMotion)} /><span className="knob" />{t('reduceMotion')}</label>
              </div>
            </details>
            <div className="seg langsw">
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
              <button className={lang === 'zh' ? 'on' : ''} onClick={() => setLang('zh')}>繁中</button>
            </div>
          </div>
        )}
        {room && active && view && <ConnBadge status={status} latency={latency} />}
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
            <Menu name={name} setName={setName} config={config} setConfig={setConfig} onSolo={solo} onCreate={() => joinRoom(makeCode())} onJoin={joinRoom} />
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
        {active && view && !playing && room && <RoomLobby view={view} room={room} send={send} onLeave={leave} />}
        {active && view && playing && <><Board room={room} status={status} view={view} send={send} hints={hints} setHints={setHints} onLeave={leave} online={!!room || !!stress} /><RotatePrompt /></>}
      </div>
    </AkaCtx.Provider>
  )
}
