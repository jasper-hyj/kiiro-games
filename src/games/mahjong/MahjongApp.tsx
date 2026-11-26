import { AccountChip } from '../../account/Panels'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAccount } from '../../account/Account'
import { getToken } from '../../account/api'
import { nameOrGuest } from '../shared/name'
import { DEFAULT_CONFIG, type RoomConfig, type TableView } from './engine/table'
import { connectLocal, connectRemote, getClientId, type Conn, type Handlers, type Status } from './net/client'
import type { ClientMsg } from './net/protocol'
import { RoomLobby } from './ui/Lobby'
import { Board } from './ui/Board'
import { AkaCtx } from './ui/Tile'
import { Connecting } from '../../ui/components'
import { useLang } from '../../i18n'
import './strings'
import { TileGallery } from './ui/TileGallery'
import { stressView } from './ui/stress'
import { RulesHelp } from './ui/RulesHelp'
import { Guide } from './ui/Guide'
import { ConnBadge } from './ui/ConnBadge'
import { TalkBox } from '../shared/TalkBox'
import { backToRoom, watchOnly as isWatchOnly } from '../shared/fromRoom'
import { route } from '../../route'
import '../../room/strings'
import '../holdem/strings'

const load = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : d
  } catch {
    return d
  }
}
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

export default function MahjongApp() {
  const { lang, setLang, simplified, setSimplified, t } = useLang()
  const [rulesOpen, setRulesOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const { me } = useAccount()
  const [name, setName] = useState(nameOrGuest)
  const [config, setConfig] = useState<RoomConfig>(() => load('kiiro-config', DEFAULT_CONFIG))
  const [hints, setHints] = useState(() => load('kiiro-hints', false))
  const [talk, setTalk] = useState<{ n: number; name: string; text: string }[]>([])
  const watchOnly = isWatchOnly()
  const stress = new URLSearchParams(location.search).get('stress')
  const [view, setView] = useState<TableView | null>(() =>
    stress
      ? stressView(stress, Number(new URLSearchParams(location.search).get('players') ?? 4), new URLSearchParams(location.search).get('rule') ?? 'taiwan')
      : null,
  )
  // bots are named "Bot 1…" by the engine; show them in the player's language
  const shown = useMemo(() => {
    if (!view) return view
    const loc = (n: string) => {
      const m = /^Bot (\d+)$/.exec(n)
      return m ? t('botName', { n: m[1] }) : n
    }
    return {
      ...view,
      seats: view.seats.map((x) => ({ ...x, name: loc(x.name) })),
      game: view.game
        ? {
            ...view.game,
            players: view.game.players.map((p) => ({ ...p, name: loc(p.name) })),
            standings: view.game.standings?.map((x) => ({ ...x, name: loc(x.name) })),
          }
        : view.game,
    } as typeof view
  }, [view, t])
  // the page takes the accent colour of the game being set up or played (see the [data-rule] block in parlour.css)
  useEffect(() => {
    document.documentElement.dataset.rule = (view?.config.rule ?? config.rule) as string
  }, [view?.config.rule, config.rule])
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
  useEffect(() => {
    if (me?.name) setName(me.name)
  }, [me?.name]) // a signed-in player is never asked for a name
  useEffect(() => save('kiiro-config', config), [config])
  useEffect(() => save('kiiro-hints', hints), [hints])

  const joined = useRef<string | null>(null) // the room this table belongs to ("Back to room" goes there)
  const failTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leave = useCallback(() => {
    seq.current++
    if (failTimer.current) {
      clearTimeout(failTimer.current)
      failTimer.current = null
    }
    try {
      conn.current?.send({ t: 'bye' })
    } catch {
      /* ignore */
    } // a deliberate leave: a bot takes the seat straight away
    conn.current?.close()
    conn.current = null
    setView(null)
    setRoom(null)
    setActive(false)
    setStatus('closed')
    setJoinError('')
    try {
      localStorage.removeItem('kiiro-last-room')
    } catch {
      /* ignore */
    }
    const back = joined.current
    if (back) backToRoom(back)
    else location.href = '/'
  }, [])

  const seq = useRef(0) // every connection gets a number; once the player leaves or starts another one, the old one can no longer touch the UI
  const guard = <H extends Handlers>(h: H, mine: number): H => ({
    ...h,
    onView: (v: TableView) => {
      if (seq.current === mine) h.onView(v)
    },
    onStatus: (st: Status) => {
      if (seq.current === mine) h.onStatus(st)
    },
    onError: (m: string) => {
      if (seq.current === mine) h.onError(m)
    },
    onLatency: (ms: number) => {
      if (seq.current === mine) h.onLatency?.(ms)
    },
  })
  const handlers = {
    onView: setView,
    onStatus: (st: Status) => {
      setStatus(st)
      if (st !== 'open') setLatency(null)
    },
    onLatency: setLatency,
    onError: (m: string) => {
      setError(m)
      setJoinError(m)
      setTimeout(() => setError(''), 4000)
    },
  }
  const solo = () => {
    const q = new URLSearchParams(location.search) // debug overrides: ?rule=riichi&players=3
    const cfg = {
      ...config,
      ...(q.get('rule') ? { rule: q.get('rule') as RoomConfig['rule'] } : {}),
      ...(q.get('players') ? { players: Number(q.get('players')) as 3 | 4 } : {}),
    }
    setActive(true)
    conn.current = connectLocal(id.current, name || 'Player', cfg, guard(handlers, ++seq.current))
  }
  const tutorial = () => {
    // a guided practice game: easy bots, the coach switched on, tips that explain each moment
    setActive(true)
    conn.current = connectLocal(id.current, name || 'Player', { ...config, botLevel: 'easy', rounds: 1 }, guard(handlers, ++seq.current))
  }
  /** the table already exists (its room made it, with its rules and host): just connect */
  const joinRoom = useCallback(
    (code: string) => {
      const c = code.toUpperCase()
      conn.current?.close()
      conn.current = null // never two connections at once
      setView(null)
      setJoinError('')
      setTalk([])
      joined.current = c
      setRoom(c)
      setActive(true)
      const dbg = new URLSearchParams(location.search).has('debug')
      const roomHandlers = {
        ...handlers,
        onTalk: (m: { n: number; name: string; text: string }) => setTalk((l) => [...l.filter((x) => x.n !== m.n), m].slice(-60)),
        onTalkLog: (ms: { n: number; name: string; text: string }[]) => setTalk(ms),
        onError: (m: string) => {
          if (m.startsWith('wrong_game:')) {
            handlers.onError('rmCodeClash')
            return
          } // this code is another game's table: never jump into it
          handlers.onError(m)
        },
      }
      const mine = ++seq.current
      conn.current = connectRemote(c, id.current, name || 'Player', guard(roomHandlers, mine), false, watchOnly)
      if (dbg) (window as unknown as { __kiiroConn?: Conn }).__kiiroConn = conn.current // test hook
      // give up with a clear message if the server never answers
      if (failTimer.current) clearTimeout(failTimer.current)
      failTimer.current = setTimeout(() => {
        if (seq.current === mine && !viewRef.current) setJoinError('conn_failed')
      }, 12000)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [name],
  )
  const send = (m: ClientMsg) => {
    if (room && status !== 'open') {
      setError('notSent')
      setTimeout(() => setError(''), 2500)
      return
    }
    conn.current?.send(m)
  }

  const where = route()
  useEffect(() => {
    if (conn.current) return
    if (where.page === 'table') joinRoom(where.code)
    else if (where.page === 'practice') {
      if (where.tutorial) tutorial()
      else solo()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => conn.current?.close(), [])
  // signing in (or out) at a table: connect again so the server knows who you are
  const tok = useRef(getToken())
  useEffect(() => {
    if (getToken() === tok.current) return
    tok.current = getToken()
    if (joined.current && where.page === 'table') joinRoom(joined.current)
  }, [me?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('tiles')) return <TileGallery />
  const playing = view?.status === 'playing' && view.game
  const aka = (view?.config.aka ?? false) && view?.config.rule === 'riichi'

  return (
    <AkaCtx.Provider value={aka}>
      <div className={'app' + (playing ? ' game' : '')}>
        {!playing && !active && (
          <div className="accorner">
            <AccountChip />
          </div>
        )}
        {!playing && (
          <div className="floatbar">
            {room && active && !view && (
              <span className="roomtag">
                <span className={'status-dot ' + status} />
                {room}
              </span>
            )}
            <button className="rulesfab" onClick={() => setGuideOpen(true)}>
              <span aria-hidden="true">🎓</span>
              <span className="fablabel"> {t('guideBtn')}</span>
            </button>
            <button className="rulesfab" onClick={() => setRulesOpen(true)}>
              <span aria-hidden="true">📖</span>
              <span className="fablabel"> {t('rulesRef')}</span>
            </button>
            <div className="seg langsw">
              <button
                className={lang === 'en' ? 'on' : ''}
                onClick={() => {
                  setLang('en')
                }}
              >
                EN
              </button>
              <button
                className={lang === 'zh' && !simplified ? 'on' : ''}
                onClick={() => {
                  setLang('zh')
                  setSimplified(false)
                }}
              >
                繁中
              </button>
              <button
                className={lang === 'zh' && simplified ? 'on' : ''}
                onClick={() => {
                  setLang('zh')
                  setSimplified(true)
                }}
              >
                简中
              </button>
              <button className={lang === 'ja' ? 'on' : ''} onClick={() => setLang('ja')}>
                日本語
              </button>
            </div>
          </div>
        )}
        {room && active && view && (stress ? new URLSearchParams(location.search).has('ping') : true) && (
          <ConnBadge status={stress ? 'open' : status} latency={stress ? 42 : latency} />
        )}
        {rulesOpen && <RulesHelp initial={config.rule} onClose={() => setRulesOpen(false)} />}
        {guideOpen && (
          <Guide
            onClose={() => setGuideOpen(false)}
            onPractice={() => {
              if (joined.current) window.open('/mahjong/tutorial', '_blank')
              else tutorial()
            }}
          />
        )}
        {error && !(active && !view) && <div className="toast">{t(error) !== error ? t(error) : error}</div>}
        {!active && (
          <div className="page joinpage">
            <Connecting status="connecting" />
          </div>
        )}
        {active && !view && joinError && (
          <div className="page joinpage">
            <h1>{t('cantJoin')}</h1>
            <p className="muted">{t(joinError) !== joinError ? t(joinError) : joinError}</p>
            <button className="btn gold big" onClick={leave}>
              {t('backMenu')}
            </button>
          </div>
        )}
        {active && !view && !joinError && (
          <div className="page joinpage">
            <Connecting status={status} />
            <button className="btn alt" onClick={leave}>
              {t('leave')}
            </button>
          </div>
        )}
        {active && shown && room && shown.you < 0 && (
          <div className="mjwatch" role="status">
            {t('mjWatching')}
            {shown.watching ? ` · ${t('mjWatchers', { n: shown.watching })}` : ''}
            <button className="btn gold" onClick={() => send({ t: 'sit' })}>
              {t('mjSit')}
            </button>
          </div>
        )}
        {active && room && shown && <TalkBox lines={talk} say={(x) => conn.current?.send({ t: 'talk', text: x })} />}
        {active && shown && !playing && room && <RoomLobby view={shown} room={room} send={send} onLeave={leave} />}
        {active && shown && playing && (
          <Board room={room} status={status} view={shown} send={send} hints={hints} setHints={setHints} onLeave={leave} online={!!room || !!stress} />
        )}
      </div>
    </AkaCtx.Provider>
  )
}
