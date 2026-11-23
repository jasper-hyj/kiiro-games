import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../../i18n'
import { Bar } from '../../hub/Hub'
import { useAccount } from '../../account/Account'
import { api } from '../../account/api'
import { BLINDS } from './engine/table'
import { Card } from './ui/Cards'
import { Rules } from '../shared/Rules'
import { best, categoryOf } from './engine/eval'
import { connectHoldem, getClientId, type HoldemView, type PokerConn, type Status } from './net/client'
import { TalkBox } from '../shared/TalkBox'
import { backToRoom, fromRoom, makeCfg, roomSuffix } from '../shared/fromRoom'
import '../../room/strings'
import type { TalkMsg } from '../shared/cashClient'
import './strings'
import './holdem.css'

const load = (k: string, d = '') => { try { return localStorage.getItem(k) ?? d } catch { return d } }
const save = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } }
const fmt = (n: number) => n.toLocaleString()
/** where each seat sits on the table, as % of its box: you are always at the bottom */
const SPOTS: [number, number][] = [[50, 90], [13, 68], [16, 22], [50, 9], [84, 22], [87, 68]]
/** on phones the side seats move out of the way of the board cards */
const PHONE_SPOTS: [number, number][] = [[50, 92], [13, 76], [16, 21], [50, 8], [84, 21], [87, 76]]
function useNarrow() {
  const [n, setN] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(max-width: 640px)').matches)
  useEffect(() => { const m = matchMedia('(max-width: 640px)'); const f = () => setN(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  return n
}

export default function HoldemApp() {
  const { t } = useLang()
  const { me, openSignIn, refresh } = useAccount()
  const [name, setName] = useState(() => load('kiiro-name', ''))
  const [view, setView] = useState<HoldemView | null>(null)
  const [status, setStatus] = useState<Status>('closed')
  const [error, setError] = useState('')
  const [room, setRoom] = useState<string | null>(null)
  const [sb, setSb] = useState(() => Number(load('kiiro-hd-sb', '25')))
  const [casual, setCasual] = useState(() => load('kiiro-hd-casual', '1') === '1')
  const [code, setCode] = useState('')
  const [buyin, setBuyin] = useState(0)
  const [talk, setTalk] = useState<TalkMsg[]>([])
  const conn = useRef<PokerConn | null>(null)
  const urlRoom = useMemo(() => new URLSearchParams(location.search).get('room'), [])
  const startedFor = useRef<string | null>(null)
  /** set while creating a table: a code that is already in use is retried with a new one */
  const retry = useRef<(() => void) | null>(null)
  /** opened from a room: the host's table may not exist yet, so a join that finds nothing tries again for a few seconds */
  const again = useRef<(() => void) | null>(null)
  const tries = useRef(0)

  const handlers = useMemo(() => ({
    onView: (v: HoldemView) => { retry.current = null; setView(v); setError('') },
    onStatus: setStatus,
    onTalk: (m: TalkMsg) => setTalk((l) => [...l.filter((x) => x.n !== m.n), m].slice(-60)),
    onTalkLog: (ms: TalkMsg[]) => setTalk(ms),
    onError: (m: string) => {
      if (m === 'room_not_found' && fromRoom() && !makeCfg() && again.current && tries.current++ < 12) { setTimeout(() => again.current?.(), 800); return }
      if ((m === 'code_taken' || m.startsWith('wrong_game:')) && retry.current) { retry.current(); return } // a code that another room or game already uses: pick a new one
      if (m.startsWith('wrong_game:')) { location.href = `/mahjong?room=${startedFor.current}`; return }
      setError(m)
      if (m === 'room_not_found' || m === 'code_taken') { conn.current?.close(); conn.current = null; setRoom(null); setView(null); history.replaceState(null, '', location.pathname) }
      setTimeout(() => setError((e) => (e === m ? '' : e)), 5000)
    },
  }), [])

  const open = useCallback((rm: string, create?: { sb: number; bb: number; casual: boolean }) => {
    conn.current?.close()
    const nm = (name.trim() || me?.name || 'Player').slice(0, 16)
    startedFor.current = rm
    setRoom(rm); setView(null); setTalk([])
    history.replaceState(null, '', `${location.pathname}?room=${rm}${roomSuffix()}`)
    again.current = create ? null : () => open(rm)
    conn.current = connectHoldem(rm, getClientId(), nm, handlers, create)
  }, [name, me?.name, handlers])

  const create = () => { save('kiiro-name', name); location.href = '/room?create=1&pick=holdem' } // tables start from a room now: gather first, then choose the game and rules
  const join = (c: string) => { retry.current = null; save('kiiro-name', name); open(c.trim()) }
  useEffect(() => { if (urlRoom && !conn.current) { const mk = makeCfg(); if (mk) { const sb = Number(mk.sb) || 25, bb = Number(mk.bb) || 50; open(urlRoom, { sb, bb, casual: mk.casual !== false }) } else join(urlRoom) } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => conn.current?.close(), [])
  // a sign-in (or sign-out) while at the table: reconnect so the server knows who you are
  const meId = me?.id
  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; return } if (room) open(room) }, [meId]) // eslint-disable-line react-hooks/exhaustive-deps

  const leave = () => { const rm = startedFor.current; if (fromRoom() && rm) { conn.current?.close(); backToRoom(rm); return } conn.current?.close(); conn.current = null; setRoom(null); setView(null); history.replaceState(null, '', location.pathname); void refresh() }

  if (!room) {
    return (
      <div className="kg hd">
        <div className="kg-wrap">
          <Bar />
          <h1>{t('hdName')}</h1>
          <p className="kg-lead">{t('hdTagline')}</p>
          {error && <p className="acerr" role="alert">{t(error)}</p>}
          <div className="hdform">
            <label>{t('hdNick')}<input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder={me?.name ?? 'Player'} /></label>
          </div>
          <Rules title="hdHow" lines={['hdR1', 'hdR2', 'hdR3', 'hdR4', 'hdR5']} />
          <div className="kg-cols">
            <section className="hdform">
              <h2>{t('hdCreate')}</h2>
              <p className="kg-note">{t('rmCreateNote')}</p>
              <div><button className="hdbtn primary" onClick={create}>{t('rmCreateBtn')}</button></div>
            </section>
            <section className="hdform">
              <h2>{t('hdJoin')}</h2>
              <form onSubmit={(e) => { e.preventDefault(); if (/^\d{4}$/.test(code)) join(code) }} className="hdrow">
                <input inputMode="numeric" pattern="\d{4}" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder={t('hdCode')} aria-label={t('hdCode')} />
                <button className="hdbtn primary" disabled={!/^\d{4}$/.test(code)}>{t('hdJoinBtn')}</button>
              </form>
            </section>
          </div>
        </div>
      </div>
    )
  }
  return <Table view={view} status={status} room={room} error={error} send={(m) => conn.current?.send(m)} talk={talk} say={(x) => conn.current?.say?.(x)} leave={leave} me={me} openSignIn={openSignIn} buyin={buyin} setBuyin={setBuyin} refreshMe={refresh} api={api} />
}

interface TableProps {
  view: HoldemView | null; status: Status; room: string; error: string
  send: PokerConn['send']; leave(): void; talk: TalkMsg[]; say(text: string): void
  me: ReturnType<typeof useAccount>['me']; openSignIn(): void
  buyin: number; setBuyin(n: number): void; refreshMe(): Promise<void>; api: typeof api
}

function Table({ view, status, room, error, send, talk, say, leave, me, openSignIn, buyin, setBuyin, refreshMe }: TableProps) {
  const { t } = useLang()
  const narrow = useNarrow()
  const spots = narrow ? PHONE_SPOTS : SPOTS
  const [copied, setCopied] = useState(false)
  const [raise, setRaise] = useState(0)
  const [, tick] = useState(0)
  const deadline = useRef<{ at: number; total: number } | null>(null)
  const nextAt = useRef<number | null>(null)
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(i) }, [])
  useEffect(() => { if (view) { deadline.current = view.timeLeft != null ? { at: Date.now() + view.timeLeft, total: 30000 } : null; nextAt.current = view.nextIn != null ? Date.now() + view.nextIn : null } }, [view])
  // refresh the balance when seated players change (buy-ins and cash-outs move it)
  const seatedKey = view ? view.you >= 0 : false
  useEffect(() => { void refreshMe() }, [seatedKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const turnKey = view ? `${view.handNo}:${view.street}:${view.toAct}` : ''
  useEffect(() => { if (view?.turn) setRaise(view.turn.minRaiseTo) }, [turnKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const minBuy = view?.buyin.min ?? 0, maxBuy = view?.buyin.max ?? 0
  useEffect(() => { if (view && (buyin < minBuy || buyin > maxBuy)) setBuyin(Math.min(maxBuy, Math.max(minBuy, view.config.bb * 50))) }, [view?.config.bb]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!view) return (
    <div className="kg hd"><div className="kg-wrap"><Bar /><p className="kg-lead hdstatus">{status === 'closed' ? t('hdLost') : t('hdConnecting')}</p>{error && <p className="acerr">{t(error)}</p>}</div></div>
  )
  const v = view
  const youSeat = v.you >= 0 ? v.seats[v.you] : null
  const rel = (seat: number) => (v.you >= 0 ? (seat - v.you + v.seats.length) % v.seats.length : seat)
  const turn = v.turn
  const potNow = v.pot
  const winners = v.result ? v.result.won.map((w, i) => ({ w, i })).filter((x) => x.w > 0) : []
  const toActName = v.toAct >= 0 ? v.seats[v.toAct].name : ''
  const mine = youSeat && !youSeat.folded && youSeat.hole && youSeat.hole.length === 2 && v.board.length >= 3 ? [...youSeat.hole, ...v.board] : null
  const mineName = mine ? t('hand.' + categoryOf(best(mine))) : ''
  const secsLeft = deadline.current ? Math.max(0, Math.ceil((deadline.current.at - Date.now()) / 1000)) : null
  const nextS = nextAt.current ? Math.max(0, Math.ceil((nextAt.current - Date.now()) / 1000)) : null
  const link = `${location.origin}${location.pathname}?room=${room}`
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ } }
  const canSitCash = !v.config.casual
  const raiseLabel = turn && v.pot > 0 && turn.canRaise ? (v.seats.some((s) => s.bet > 0) ? t('hdRaise', { n: fmt(raise) }) : t('hdBet', { n: fmt(raise) })) : ''

  return (
    <div className="kg hd">
      <div className="kg-wrap hdwrap">
        <Bar />
        <div className="hdhead">
          <span><b>{t('hdRoom')} {room}</b> <span className="muted">· {v.config.sb}/{v.config.bb} · {v.config.casual ? t('hdCasual') : t('hdCash')}</span></span>
          <span className="hdtools">
            <button className="hdlink" onClick={copy}>{copied ? t('hdCopied') : t('hdCopy')}</button>
            <button className="hdlink" onClick={leave}>{fromRoom() ? t('rmBack') : t('hdLeave')}</button>
          </span>
        </div>
        {status !== 'open' && <p className="acerr hdbanner">{t('hdLost')}</p>}
        {error && <p className="acerr hdbanner" role="alert">{t(error)}</p>}

        <div className="hdfelt" role="group" aria-label={t('hdRoom')}>
          <div className="hdcenter">
            <div className="hdpot">{t('hdPotLabel')} <b>{fmt(potNow)}</b></div>
            <div className="hdboard">{[0, 1, 2, 3, 4].map((i) => v.board[i] !== undefined ? <Card key={i} c={v.board[i]} /> : <span key={i} className="pkslot" />)}</div>
            <div className="hdmsg" aria-live="polite">
              {v.result
                ? <>{winners.length > 1 && v.result.pots.every((p) => p.winners.length > 1) ? t('hdSplit') + ': ' : ''}{winners.map(({ w, i }) => {
                    const sh = v.result!.shown.find((s) => s.seat === i)
                    return <span key={i} className="hdwin">{t('hdWins', { name: v.seats[i].name || '—', n: fmt(w) })}{sh ? ` · ${t('hand.' + sh.cat)}` : ''}</span>
                  })}{nextS != null && <span className="muted"> · {t('hdNext', { s: nextS })}</span>}</>
                : v.street === 'wait' ? (v.seats.filter((s) => !s.empty).length < 2 ? t('hdWaiting') : '')
                : (turn ? t('hdYourTurn') : toActName ? t('hdWaitTurn', { name: toActName }) : '')}
              {mineName && !v.result && <span className="hdmine">{t('hdYouHave', { hand: mineName })}</span>}
            </div>
          </div>
          {v.seats.map((s) => {
            const [x, y] = spots[rel(s.seat) % spots.length]
            const bx = x + (50 - x) * 0.32, by = y + (50 - y) * 0.32
            const showCards = s.dealt && !s.folded
            const isTurn = v.toAct === s.seat && v.street !== 'showdown' && v.street !== 'wait'
            const won = v.result?.won[s.seat] ?? 0
            return (
              <div key={s.seat}>
                {s.bet > 0 && <div className="hdbet" style={{ left: bx + '%', top: by + '%' }}>{fmt(s.bet)}</div>}
                <div className={'hdseat' + (s.empty ? ' empty' : '') + (s.me ? ' me' : '') + (isTurn ? ' turn' : '') + (s.folded ? ' folded' : '') + (won > 0 ? ' won' : '') + (s.out || !s.connected ? ' away' : '')} style={{ left: x + '%', top: y + '%' }}>
                  {!s.empty && <>
                    {showCards && <div className="hdhole">{s.hole && s.hole.length === 2 ? s.hole.map((c, i) => <Card key={i} c={c} small={!s.me} />) : [0, 1].map((i) => <Card key={i} back small />)}</div>}
                    <div className="hdname">{s.seat === v.button && <i className="hdbtn-d" title={t('hdDealer')}>{t('hdDealer')}</i>}{s.name}</div>
                    <div className="hdstack">{s.allIn && v.street !== 'wait' && v.street !== 'showdown' ? t('hdLastAllin') : fmt(s.stack)}</div>
                    {s.last && !s.empty && v.street !== 'wait' && <div className="hdlast">{lastLabel(t, s.last)}</div>}
                    {isTurn && secsLeft != null && s.me && <div className="hdtimer"><span style={{ width: `${Math.min(100, (secsLeft / 30) * 100)}%` }} /></div>}
                  </>}
                </div>
              </div>
            )
          })}
        </div>

        <div className="hdbar">
          {youSeat ? (
            turn ? (
              <div className="hdactions">
                <button className="hdbtn" onClick={() => send({ k: 'act', a: { a: 'fold' } })}>{t('hdFold')}</button>
                <button className="hdbtn primary" onClick={() => send({ k: 'act', a: turn.canCheck ? { a: 'check' } : { a: 'call' } })}>{turn.canCheck ? t('hdCheck') : t('hdCall', { n: fmt(turn.call) })}</button>
                {turn.canRaise && (
                  <div className="hdraise">
                    <input type="range" min={turn.minRaiseTo} max={turn.maxRaiseTo} step={5} value={Math.min(Math.max(raise, turn.minRaiseTo), turn.maxRaiseTo)} onChange={(e) => setRaise(Number(e.target.value))} aria-label={raiseLabel} />
                    <div className="hdpresets">
                      <button onClick={() => setRaise(turn.minRaiseTo)}>{t('hdMin')}</button>
                      <button onClick={() => setRaise(Math.min(turn.maxRaiseTo, Math.max(turn.minRaiseTo, Math.round((v.pot / 2 + turn.call + (v.seats[v.you].bet)) / 5) * 5)))}>{t('hdHalf')}</button>
                      <button onClick={() => setRaise(Math.min(turn.maxRaiseTo, Math.max(turn.minRaiseTo, Math.round((v.pot + turn.call + v.seats[v.you].bet) / 5) * 5)))}>{t('hdPot')}</button>
                      <button onClick={() => setRaise(turn.maxRaiseTo)}>{t('hdAllIn')}</button>
                    </div>
                    <button className="hdbtn primary" onClick={() => send({ k: 'act', a: raise >= turn.maxRaiseTo ? { a: 'allin' } : { a: 'raise', to: Math.min(Math.max(raise, turn.minRaiseTo), turn.maxRaiseTo) } })}>{raise >= turn.maxRaiseTo ? t('hdAllIn') : raiseLabel}</button>
                  </div>
                )}
                {!turn.canRaise && turn.maxRaiseTo > 0 && <button className="hdbtn" onClick={() => send({ k: 'act', a: { a: 'allin' } })}>{t('hdAllIn')}</button>}
              </div>
            ) : (
              <div className="hdactions idle">
                {youSeat.out ? <><span className="muted">{t('hdOutNote')}</span><button className="hdbtn primary" onClick={() => send({ k: 'out', out: false })}>{t('hdBack')}</button></>
                  : <button className="hdlink" onClick={() => send({ k: 'out', out: true })}>{t('hdSitOut')}</button>}
                {canSitCash && v.street !== 'preflop' && v.street !== 'flop' && v.street !== 'turn' && v.street !== 'river' && youSeat.stack < v.buyin.max && (
                  <RebuyBox max={v.buyin.max - youSeat.stack} min={1} step={v.config.bb} onBuy={(n) => send({ k: 'rebuy', amount: n })} label={t('hdRebuy')} />
                )}
              </div>
            )
          ) : (
            <div className="hdsit">
              {v.config.casual ? (
                <button className="hdbtn primary" onClick={() => send({ k: 'sit', buyin: 0 })}>{t('hdSit')}</button>
              ) : me ? (
                <>
                  <label className="hdbuy">{t('hdBuyin')}
                    <input type="range" min={minBuy} max={maxBuy} step={v.config.bb} value={buyin} onChange={(e) => setBuyin(Number(e.target.value))} />
                    <b>{fmt(buyin)}</b> <span className="muted">/ {fmt(me.balance)}</span>
                  </label>
                  <button className="hdbtn primary" onClick={() => send({ k: 'sit', buyin })}>{t('hdSitCash', { n: fmt(buyin) })}</button>
                </>
              ) : <button className="hdbtn primary" onClick={openSignIn}>{t('hdSignIn')}</button>}
              <p className="kg-note">{v.spectators > 0 || v.seats.some((s) => !s.empty) ? t('hdSpectating') : ''}</p>
            </div>
          )}
        </div>
        <TalkBox lines={talk} say={say} />
      </div>
    </div>
  )
}

function RebuyBox({ max, min, step, onBuy, label }: { max: number; min: number; step: number; onBuy(n: number): void; label: string }) {
  const [n, setN] = useState(Math.min(max, step * 20))
  useEffect(() => { setN((x) => Math.min(max, Math.max(min, x))) }, [max, min])
  return <span className="hdrebuy"><input type="range" min={min} max={max} step={Math.min(step, max)} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label={label} /><button className="hdbtn" onClick={() => onBuy(n)}>{label} {fmt(n)}</button></span>
}

function lastLabel(t: (k: string) => string, last: string): string {
  const map: Record<string, string> = { fold: 'hdLastFold', check: 'hdLastCheck', call: 'hdLastCall', raise: 'hdLastRaise', bet: 'hdLastBet', allin: 'hdLastAllin', sb: 'hdLastSb', bb: 'hdLastBb' }
  return map[last] ? t(map[last]) : ''
}
