import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readName, writeName } from '../shared/name'
import { useLang } from '../../i18n'
import { Bar } from '../../hub/Hub'
import { useAccount } from '../../account/Account'
import { getToken } from '../../account/api'
import { Card } from '../holdem/ui/Cards'
import { connectLocalBigTwo } from '../shared/localCash'
import { connectCash, getClientId, type CashConn, type Status, type TalkMsg } from '../shared/cashClient'
import { TalkBox } from '../shared/TalkBox'
import { roomUrl, route } from '../../route'
import { Connecting, NoRoom } from '../../ui/components'
import '../../room/strings'
import { BtTable } from './BtTable'
import { Rules } from '../shared/Rules'
import type { BigTwoView, BtMsg } from './net/protocol'
import '../holdem/strings'
import '../blackjack/strings'
import './strings'
import '../holdem/holdem.css'
import './bigtwo.css'

const load = (k: string, d = '') => {
  try {
    return localStorage.getItem(k) ?? d
  } catch {
    return d
  }
}
const save = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* ignore */
  }
}

export default function BigTwoApp() {
  const { t } = useLang()
  const { me, openSignIn, refresh } = useAccount()
  const [name, setName] = useState(() => readName(''))
  const [view, setView] = useState<BigTwoView | null>(null)
  const [status, setStatus] = useState<Status>('closed')
  const [error, setError] = useState('')
  const [room, setRoom] = useState<string | null>(null)
  const [talk, setTalk] = useState<TalkMsg[]>([])
  const conn = useRef<CashConn<BtMsg> | null>(null)
  const startedFor = useRef<string | null>(null)
  const where = route()
  const watchOnly = where.page === 'table' && where.watch
  const handlers = useMemo(
    () => ({
      onView: (v: BigTwoView) => {
        setView(v)
        setError('')
      },
      onStatus: setStatus,
      onTalk: (m: TalkMsg) => setTalk((l) => [...l.filter((x) => x.n !== m.n), m].slice(-60)),
      onTalkLog: (ms: TalkMsg[]) => setTalk(ms),
      onError: (m: string) => {
        if (m.startsWith('wrong_game:')) {
          setError('rmCodeClash')
          return
        } // this code is another game's table: never jump into it
        setError(m)
        if (m === 'room_not_found' || m === 'room_full') {
          conn.current?.close()
          conn.current = null
          setRoom(null)
          setView(null)
        }
        setTimeout(() => setError((e) => (e === m ? '' : e)), 5000)
      },
    }),
    [],
  )
  /** the table already exists (its room made it, with its rules and host): just connect */
  const open = useCallback(
    (rm: string) => {
      conn.current?.close()
      startedFor.current = rm
      setRoom(rm)
      setView(null)
      setTalk([])
      conn.current = connectCash<BigTwoView, BtMsg>('bigtwo', rm, getClientId(), (name.trim() || me?.name || 'Player').slice(0, 16), handlers, undefined, {
        watch: watchOnly,
      })
    },
    [name, me?.name, handlers, watchOnly],
  )
  const practice = () => {
    conn.current?.close()
    startedFor.current = null
    setRoom('practice')
    setView(null)
    conn.current = connectLocalBigTwo(getClientId(), (name.trim() || me?.name || 'Player').slice(0, 16), handlers)
  }
  useEffect(() => {
    if (conn.current) return
    if (where.page === 'practice') practice()
    else if (where.page === 'table') open(where.code)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => conn.current?.close(), [])
  const first = useRef(getToken()) // the token the connection was made with
  useEffect(() => {
    if (getToken() === first.current) return
    first.current = getToken()
    if (room && room !== 'practice') open(room)
  }, [me?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const leave = () => {
    conn.current?.close()
    const rm = startedFor.current
    location.href = room === 'practice' || !rm ? '/' : roomUrl(rm)
  }
  const send = (m: BtMsg) => conn.current?.send(m)

  if (!room) return <NoRoom game="bigtwo" error={error} />
  if (!view)
    return (
      <div className="kg hd">
        <div className="kg-wrap">
          <Bar />
          <Connecting status={status} />
          {error && <p className="acerr">{t(error)}</p>}
        </div>
      </div>
    )
  return (
    <BtTable
      v={view}
      status={status}
      room={room}
      error={error}
      send={send}
      talk={talk}
      say={(x) => conn.current?.say?.(x)}
      leave={leave}
      me={me}
      openSignIn={openSignIn}
    />
  )
}
