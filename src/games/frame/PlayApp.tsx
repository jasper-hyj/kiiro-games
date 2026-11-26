import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../../i18n'
import { useAccount } from '../../account/Account'
import { getToken } from '../../account/api'
import { roomUrl, route } from '../../route'
import { getClientId } from '../shared/cashClient'
import { nameOrGuest } from '../shared/name'
import { TalkBox } from '../shared/TalkBox'
import { Connecting, Hotkeys, NoRoom, ResultPanel, SeatChip, TableHeader, useShownName } from '../../ui/components'
import { connectLocalPlay, connectPlay, type PlayConn, type PlayViewX, type TalkMsg } from './client'
import { GAME_UI } from './boards'
import type { GenericGame } from './kinds'
import '../holdem/strings'
import '../../room/strings'
import './strings'

/**
 * One page for every turn-based game on the shared frame: the lobby, the turn line, spectators, chat, the result.
 * The game itself (the board, the cards, the dice) comes from ./ui.tsx; this page never knows the rules.
 */
export default function PlayApp({ game }: { game: GenericGame }) {
  const { t } = useLang()
  const shown = useShownName()
  const { me, openSignIn } = useAccount()
  const where = route()
  const practice = where.page === 'practice'
  const code = where.page === 'table' ? where.code : null
  const watchOnly = where.page === 'table' && where.watch
  const ui = GAME_UI[game]
  const [view, setView] = useState<PlayViewX | null>(null)
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('closed')
  const [error, setError] = useState('')
  const [talk, setTalk] = useState<TalkMsg[]>([])
  const [copied, setCopied] = useState(false)
  const [, tick] = useState(0)
  const conn = useRef<PlayConn | null>(null)
  const left = useRef<number | null>(null)

  const handlers = useMemo(
    () => ({
      onView: (v: PlayViewX) => {
        setView(v)
        setError('')
        left.current = v.timeLeft != null ? Date.now() + v.timeLeft : null
      },
      onStatus: setStatus,
      onTalk: (m: TalkMsg) => setTalk((l) => [...l.filter((x) => x.n !== m.n), m].slice(-60)),
      onTalkLog: (ms: TalkMsg[]) => setTalk(ms),
      onError: (m: string) => {
        if (m.startsWith('wrong_game:')) {
          setError('rmCodeClash')
          return
        }
        setError(m)
        if (m === 'room_not_found') {
          conn.current?.close()
          conn.current = null
          setView(null)
        }
        setTimeout(() => setError((e) => (e === m ? '' : e)), 5000)
      },
    }),
    [],
  )

  const open = useCallback(() => {
    conn.current?.close()
    setView(null)
    setTalk([])
    const name = (me?.name || nameOrGuest()).slice(0, 16)
    conn.current = practice
      ? connectLocalPlay(game, getClientId(), name, handlers, game === 'yahtzee' ? { players: 2 } : {}, { local: where.page === 'practice' && !!where.local })
      : connectPlay(game, code!, getClientId(), name, handlers, { watch: watchOnly })
  }, [game, practice, code, watchOnly, me?.name, handlers])
  useEffect(() => {
    if (!conn.current && (practice || code)) open()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => conn.current?.close(), [])
  // signing in (or out) at the table: connect again so the server knows who you are
  const tok = useRef(getToken())
  useEffect(() => {
    if (getToken() === tok.current) return
    tok.current = getToken()
    if (!practice && code) open()
  }, [me?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 500)
    return () => clearInterval(i)
  }, [])

  const send = (m: Record<string, unknown>) => conn.current?.send(m)
  const leave = () => {
    conn.current?.close()
    location.href = practice || !code ? '/' : roomUrl(code)
  }
  const again = () => {
    send({ k: 'lobby' })
    if (practice) setTimeout(() => send({ k: 'start' }), 30)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}${roomUrl(code ?? '')}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  if (!practice && !code) return <NoRoom game={game} />
  const head = (v?: PlayViewX | null) => (
    <>
      <TableHeader
        title={practice ? (where.page === 'practice' && where.local ? t('plLocal') : t('plPractice')) : `${t('hdRoom')} ${code}`}
        sub={t(ui.name)}
        watching={v?.watching}
        copied={copied}
        onCopy={practice ? undefined : copy}
        onLeave={leave}
        leaveLabel={practice ? t('hdLeave') : t('rmBack')}
        status={status}
        help={ui.help}
      />
      {error && (
        <p className="acerr hdbanner" role="alert">
          {t(error)}
        </p>
      )}
    </>
  )
  if (!view)
    return (
      <div className="kg hd play">
        <div className="kg-wrap hdwrap">
          {head()}
          <Connecting status={status} />
        </div>
      </div>
    )

  const v = view
  const watcher = v.you < 0
  const myTurn = v.status === 'playing' && (v.anyTurn || (v.actor ?? v.turn) === v.you)
  const secs = left.current ? Math.max(0, Math.ceil((left.current - Date.now()) / 1000)) : null
  const line =
    v.status === 'playing'
      ? v.local
        ? v.turn >= 0
          ? t('plLocalTurn', { name: shown(v.seats[v.turn].name) })
          : ''
        : myTurn
          ? t('plYourTurn') + (secs != null ? ` · ${secs}s` : '')
          : v.turn >= 0
            ? t('plWaitTurn', { name: shown(v.seats[v.turn].name) })
            : ''
      : ''
  const cfgLine = [v.config.ranked ? t('rmRanked') : t('rmCasual'), ...ui.settings(v.config, t)].join(' · ')

  /* ------------------------------------------------------------ lobby */
  if (v.status === 'lobby') {
    return (
      <div className="kg hd play">
        <div className="kg-wrap hdwrap">
          {head(v)}
          <h2 className="btsec">{t('plSeats')}</h2>
          <ul className="btlobby">
            {v.seats.map((s) => (
              <li key={s.seat} className={s.empty ? 'bot' : ''}>
                <SeatChip
                  name={s.empty ? t('plBot') : s.name}
                  sub={s.empty ? undefined : s.me ? t('plYou') : s.seat === 0 ? t('rmHost') : undefined}
                  state={s.me ? 'me' : s.empty ? 'away' : ''}
                />
              </li>
            ))}
          </ul>
          <p className="kg-note">{cfgLine}</p>
          {watcher && (
            <p className="kg-note">
              {t('hdSpectating')}{' '}
              <button className="hdbtn primary" onClick={() => send({ k: 'sit' })}>
                {t('hdSit')}
              </button>
            </p>
          )}
          {v.host ? (
            <div>
              <button className="hdbtn primary" onClick={() => send({ k: 'start' })}>
                {t('plStart')}
              </button>
            </div>
          ) : (
            !watcher && <p className="kg-note">{t('plWaitHost')}</p>
          )}
          {!practice && (
            <p className="kg-note">
              {v.host ? t('rulesInRoomHost') : t('hostDecides')} <a href={roomUrl(code!)}>{t('rmBack')}</a>
            </p>
          )}
          {v.watching > 0 && <p className="kg-note">{t('plWatchers', { n: v.watching })}</p>}
          {!practice && <TalkBox lines={talk} say={(x) => conn.current?.say?.(x)} />}
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------ the game */
  const over = v.status === 'over' && v.result
  return (
    <div className="kg hd play">
      <div className="kg-wrap hdwrap">
        {head(v)}
        <Hotkeys enabled={!!over && v.host} keys={{ enter: again }} />
        <div className="plseats">
          {v.seats.map((s) => (
            <SeatChip
              key={s.seat}
              name={s.name}
              state={(v.turn === s.seat && v.status === 'playing' ? 'turn ' : '') + (s.me ? 'me ' : '') + (!s.connected && !s.bot ? 'away' : '')}
              sub={s.me ? t('plYou') : s.bot ? t('hdCasual') && '' : undefined}
            />
          ))}
        </div>
        <div className={'hdmsg plline' + (myTurn ? ' mine' : '')} aria-live="polite">
          {line}
        </div>
        <ui.Board v={v} send={send} name={shown} />
        {over && (
          <ResultPanel
            title={
              (v.result!.winners?.length ?? 0) > 1
                ? t('plWinsMany', { names: v.result!.winners!.map((i) => shown(v.seats[i].name)).join(' & ') })
                : v.result!.winner >= 0
                  ? t('plWins', { name: shown(v.seats[v.result!.winner].name) })
                  : t('plDraw')
            }
            columns={[t('acPlayer'), t('plScore')]}
            rows={v.seats.map((s) => {
              const points = v.result!.points[s.seat]
              const score = v.result!.scores?.[s.seat]
              return {
                name: s.name,
                me: s.me,
                value: score !== undefined ? String(score) : `${points > 0 ? '+' : ''}${points}`,
                tone: points > 0 ? ('up' as const) : points < 0 ? ('down' as const) : ('flat' as const),
              }
            })}
            note={v.host ? undefined : t('plWaitHost')}
          >
            {v.host && (
              <button className="hdbtn primary" onClick={again}>
                {t('plAgain')}
              </button>
            )}
          </ResultPanel>
        )}
        {watcher && (
          <div className="bt-watchbar">
            <span className="muted small">
              {t('hdSpectating')}
              {v.watching > 0 ? ` · ${t('plWatchers', { n: v.watching })}` : ''}
            </span>
            <button className="hdbtn primary" onClick={() => send({ k: 'sit' })}>
              {t('hdSit')}
            </button>
          </div>
        )}
        {!practice && <TalkBox lines={talk} say={(x) => conn.current?.say?.(x)} />}
      </div>
    </div>
  )
}
