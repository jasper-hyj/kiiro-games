import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readName, writeName } from '../shared/name'
import { useLang } from '../../i18n'
import { Bar } from '../../hub/Hub'
import { useAccount } from '../../account/Account'
import { Card } from '../holdem/ui/Cards'
import { connectLocalBigTwo } from '../shared/localCash'
import { connectCash, getClientId, type CashConn, type Status, type TalkMsg } from '../shared/cashClient'
import { TalkBox } from '../shared/TalkBox'
import { backToRoom, fromRoom, makeCfg, roomSuffix } from '../shared/fromRoom'
import { NoRoom } from '../../ui/components'
import '../../room/strings'
import { BtTable } from './BtTable'
import { Rules } from '../shared/Rules'
import type { BigTwoView, BtMsg } from './net/protocol'
import '../holdem/strings'
import '../blackjack/strings'
import './strings'
import '../holdem/holdem.css'
import './bigtwo.css'

const load = (k: string, d = '') => { try { return localStorage.getItem(k) ?? d } catch { return d } }
const save = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } }

export default function BigTwoApp() {
  const { t } = useLang()
  const { me, openSignIn, refresh } = useAccount()
  const [name, setName] = useState(() => readName(''))
  const [view, setView] = useState<BigTwoView | null>(null)
  const [status, setStatus] = useState<Status>('closed')
  const [error, setError] = useState('')
  const [room, setRoom] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [talk, setTalk] = useState<TalkMsg[]>([])
  const conn = useRef<CashConn<BtMsg> | null>(null)
  const startedFor = useRef<string | null>(null)
  const retry = useRef<(() => void) | null>(null)
  /** the host chose a ranked room: switch it on once the table exists */
  const ranked = useRef(false)
  /** opened from a room: the host's table may not exist yet, so a join that finds nothing tries again for a few seconds */
  const again = useRef<(() => void) | null>(null)
  const tries = useRef(0)
  const urlRoom = useMemo(() => new URLSearchParams(location.search).get('room'), [])
  const watchOnly = useMemo(() => new URLSearchParams(location.search).get('watch') === '1', [])
  const handlers = useMemo(() => ({
    onView: (v: BigTwoView) => {
      retry.current = null; setView(v); setError('')
      if (ranked.current && v.host && v.status === 'lobby') { ranked.current = false; conn.current?.send({ k: 'config', config: { ranked: true } }) }
    },
    onStatus: setStatus,
    onTalk: (m: TalkMsg) => setTalk((l) => [...l.filter((x) => x.n !== m.n), m].slice(-60)),
    onTalkLog: (ms: TalkMsg[]) => setTalk(ms),
    onError: (m: string) => {
      if (m === 'room_not_found' && fromRoom() && !makeCfg() && again.current && tries.current++ < 12) { setTimeout(() => again.current?.(), 800); return }
      if ((m === 'code_taken' || m.startsWith('wrong_game:')) && retry.current) { retry.current(); return } // a code that another room or game already uses: pick a new one
      if (m.startsWith('wrong_game:') && fromRoom()) { setError('rmCodeClash'); return } // from a room: never jump into another game's table
      if (m.startsWith('wrong_game:')) { location.href = `/${m.split(':')[1]}?room=${startedFor.current}`; return }
      setError(m)
      if (m === 'room_not_found' || m === 'code_taken' || m === 'room_full') { conn.current?.close(); conn.current = null; setRoom(null); setView(null); history.replaceState(null, '', location.pathname) }
      setTimeout(() => setError((e) => (e === m ? '' : e)), 5000)
    },
  }), [])
  const open = useCallback((rm: string, create?: boolean) => {
    conn.current?.close(); startedFor.current = rm; setRoom(rm); setView(null); setTalk([])
    history.replaceState(null, '', `${location.pathname}?room=${rm}${roomSuffix()}`)
    again.current = create ? null : () => open(rm)
    conn.current = connectCash<BigTwoView, BtMsg>('bigtwo', rm, getClientId(), (name.trim() || me?.name || 'Player').slice(0, 16), handlers, create ? { bb: 0, casual: true } : undefined, { watch: watchOnly })
  }, [name, me?.name, handlers, watchOnly])
  const practice = () => {
    conn.current?.close(); startedFor.current = null; setRoom('practice'); setView(null)
    conn.current = connectLocalBigTwo(getClientId(), (name.trim() || me?.name || 'Player').slice(0, 16), handlers)
  }
  const create = () => { writeName(name); location.href = '/room?create=1&pick=bigtwo' }
  const join = (c: string) => { retry.current = null; writeName(name); open(c.trim()) }
  useEffect(() => { if (urlRoom && !conn.current) { const mk = makeCfg(); if (mk) { ranked.current = mk.ranked === true; open(urlRoom, true) } else join(urlRoom) } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => conn.current?.close(), [])
  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; return } if (room) open(room) }, [me?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (new URLSearchParams(location.search).get('practice') === '1' && !conn.current) practice() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const leave = () => { if (room === 'practice') { conn.current?.close(); location.href = '/'; return } const rm = startedFor.current; if (fromRoom() && rm) { conn.current?.close(); backToRoom(rm); return } conn.current?.close(); conn.current = null; setRoom(null); setView(null); history.replaceState(null, '', location.pathname); void refresh() }
  const send = (m: BtMsg) => conn.current?.send(m)

  if (!room) return <NoRoom game="bigtwo" error={error} />
  if (!view) return <div className="kg hd"><div className="kg-wrap"><Bar /><p className="kg-lead hdstatus">{status === 'closed' ? t('hdLost') : t('hdConnecting')}</p>{error && <p className="acerr">{t(error)}</p>}</div></div>
  return <BtTable v={view} status={status} room={room} error={error} send={send} talk={talk} say={(x) => conn.current?.say?.(x)} leave={leave} me={me} openSignIn={openSignIn} />
}
