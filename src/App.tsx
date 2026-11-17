import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_CONFIG, type RoomConfig, type TableView } from './engine/table'
import { connectLocal, connectRemote, getClientId, type Conn, type Status } from './net/client'
import type { ClientMsg } from './net/protocol'
import { Menu, RoomLobby } from './ui/Lobby'
import { Board } from './ui/Board'
import { AkaCtx } from './ui/Tile'

const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d } catch { return d } }
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }
const makeCode = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')

export default function App() {
  const [name, setName] = useState(() => load('kiiro-name', 'Player'))
  const [config, setConfig] = useState<RoomConfig>(() => load('kiiro-config', DEFAULT_CONFIG))
  const [hints, setHints] = useState(() => load('kiiro-hints', true))
  const [view, setView] = useState<TableView | null>(null)
  const [room, setRoom] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('closed')
  const [error, setError] = useState('')
  const [active, setActive] = useState(false)
  const conn = useRef<Conn | null>(null)
  const id = useRef(getClientId())

  useEffect(() => save('kiiro-name', name), [name])
  useEffect(() => save('kiiro-config', config), [config])
  useEffect(() => save('kiiro-hints', hints), [hints])

  const leave = useCallback(() => {
    conn.current?.close(); conn.current = null
    setView(null); setRoom(null); setActive(false); setStatus('closed')
    history.replaceState(null, '', location.pathname)
  }, [])

  const handlers = { onView: setView, onStatus: setStatus, onError: (m: string) => { setError(m); setTimeout(() => setError(''), 4000) } }
  const solo = () => {
    const q = new URLSearchParams(location.search) // debug overrides: ?rule=riichi&players=3
    const cfg = { ...config, ...(q.get('rule') ? { rule: q.get('rule') as RoomConfig['rule'] } : {}), ...(q.get('players') ? { players: Number(q.get('players')) as 3 | 4 } : {}) }
    setActive(true); conn.current = connectLocal(id.current, name || 'Player', cfg, handlers)
  }
  const joinRoom = useCallback((code: string) => {
    const c = code.toUpperCase()
    setRoom(c); setActive(true)
    history.replaceState(null, '', `?room=${c}`)
    conn.current = connectRemote(c, id.current, name || 'Player', handlers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])
  const send = (m: ClientMsg) => conn.current?.send(m)

  useEffect(() => {
    const r = new URLSearchParams(location.search).get('room')
    if (r) { setRoom(r.toUpperCase()) }
  }, [])
  useEffect(() => () => conn.current?.close(), [])
  useEffect(() => { if (new URLSearchParams(location.search).has('solo') && !conn.current) solo() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const urlRoom = !active ? new URLSearchParams(location.search).get('room') : null
  const playing = view?.status === 'playing' && view.game
  const aka = (view?.config.aka ?? false) && view?.config.rule === 'riichi'

  return (
    <AkaCtx.Provider value={aka}>
      <div className="app">
        <div className="topbar">
          <span className="brand">🀄 Kiiro Mahjong</span>
          {room && <span className="muted"><span className={'status-dot ' + status} />Room {room}</span>}
          <span className="grow" />
          {active && <button className="btn sm alt" onClick={leave}>Leave</button>}
        </div>
        {error && <div className="toast">{error}</div>}
        {!active && (
          <>
            {urlRoom && (
              <div className="page" style={{ paddingBottom: 0 }}>
                <div className="card row">
                  <span>You were invited to room <b>{urlRoom.toUpperCase()}</b></span>
                  <input type="text" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
                  <button className="btn gold" onClick={() => joinRoom(urlRoom)}>Join room</button>
                </div>
              </div>
            )}
            <Menu name={name} setName={setName} config={config} setConfig={setConfig} onSolo={solo} onCreate={() => joinRoom(makeCode())} onJoin={joinRoom} />
          </>
        )}
        {active && !view && <div className="page muted">{status === 'closed' ? 'Connection lost.' : 'Connecting…'}</div>}
        {active && view && !playing && room && <RoomLobby view={view} room={room} send={send} onLeave={leave} />}
        {active && view && playing && <Board view={view} send={send} hints={hints} setHints={setHints} onLeave={leave} />}
      </div>
    </AkaCtx.Provider>
  )
}
