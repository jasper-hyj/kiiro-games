import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readName, writeName } from '../shared/name'
import { useLang } from '../../i18n'
import { Bar } from '../../hub/Hub'
import { useAccount } from '../../account/Account'
import { getToken } from '../../account/api'
import { api } from '../../account/api'
import { BLINDS } from './engine/table'
import { Card } from './ui/Cards'
import { Rules } from '../shared/Rules'
import { best, categoryOf } from './engine/eval'
import { connectLocalHoldem } from '../shared/localCash'
import { connectHoldem, getClientId, type HoldemView, type PokerConn, type Status } from './net/client'
import { TalkBox } from '../shared/TalkBox'
import { Hotkeys, Kbd, OutOfChips, RefillNotice, SeatChip, TableHeader } from '../../ui/components'
import { roomUrl, route } from '../../route'
import { Connecting, NoRoom } from '../../ui/components'
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
const PHONE_SPOTS: [number, number][] = [[50, 92], [13, 76], [14, 19], [50, 8], [86, 19], [87, 76]]
/** The felt's height in pixels, so seats can be kept inside it on a short phone. */
function useHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [h, setH] = useState(520)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const on = () => setH(el.clientHeight || 520)
    on(); const ro = new ResizeObserver(on); ro.observe(el)
    return () => ro.disconnect()
  })
  return [ref, h] as const
}
function useNarrow() {
  const [n, setN] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(max-width: 640px)').matches)
  useEffect(() => { const m = matchMedia('(max-width: 640px)'); const f = () => setN(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  return n
}

export default function HoldemApp() {
  const { t } = useLang()
  const { me, openSignIn, refresh } = useAccount()
  const [name, setName] = useState(() => readName(''))
  const [view, setView] = useState<HoldemView | null>(null)
  const [status, setStatus] = useState<Status>('closed')
  const [error, setError] = useState('')
  const [room, setRoom] = useState<string | null>(null)
  const [buyin, setBuyin] = useState(0)
  const [talk, setTalk] = useState<TalkMsg[]>([])
  const conn = useRef<PokerConn | null>(null)
  const where = route()
  const startedFor = useRef<string | null>(null)

  const handlers = useMemo(() => ({
    onView: (v: HoldemView) => { setView(v); setError('') },
    onStatus: setStatus,
    onTalk: (m: TalkMsg) => setTalk((l) => [...l.filter((x) => x.n !== m.n), m].slice(-60)),
    onTalkLog: (ms: TalkMsg[]) => setTalk(ms),
    onError: (m: string) => {
      if (m.startsWith('wrong_game:')) { setError('rmCodeClash'); return } // this code is another game's table: never jump into it
      setError(m)
      if (m === 'room_not_found') { conn.current?.close(); conn.current = null; setRoom(null); setView(null) }
      setTimeout(() => setError((e) => (e === m ? '' : e)), 5000)
    },
  }), [])

  /** the table already exists (its room made it): just connect */
  const open = useCallback((rm: string) => {
    conn.current?.close()
    startedFor.current = rm
    setRoom(rm); setView(null); setTalk([])
    conn.current = connectHoldem(rm, getClientId(), (name.trim() || me?.name || 'Player').slice(0, 16), handlers)
  }, [name, me?.name, handlers])
  const practice = () => {
    conn.current?.close(); startedFor.current = null; setRoom('practice'); setView(null)
    conn.current = connectLocalHoldem(getClientId(), (name.trim() || me?.name || 'Player').slice(0, 16), handlers)
  }
  useEffect(() => {
    if (conn.current) return
    if (where.page === 'practice') practice()
    else if (where.page === 'table') open(where.code)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => conn.current?.close(), [])
  // a sign-in (or sign-out) while at the table: reconnect so the server knows who you are
  const meId = me?.id
  const first = useRef(getToken()) // the token the connection was made with
  useEffect(() => { if (getToken() === first.current) return; first.current = getToken(); if (room && room !== 'practice') open(room) }, [meId]) // eslint-disable-line react-hooks/exhaustive-deps

  const leave = () => { conn.current?.close(); const rm = startedFor.current; location.href = room === 'practice' || !rm ? '/' : roomUrl(rm) }

  if (!room) return <NoRoom game="holdem" error={error} />
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
  const [feltRef, feltH] = useHeight<HTMLDivElement>()
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
    <div className="kg hd"><div className="kg-wrap"><Bar /><Connecting status={status} />{error && <p className="acerr">{t(error)}</p>}</div></div>
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
  const link = `${location.origin}${roomUrl(room)}`
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ } }
  const canSitCash = !v.config.casual
  const bust = canSitCash && !!youSeat && youSeat.stack === 0 && v.street === 'wait'
  const raiseLabel = turn && v.pot > 0 && turn.canRaise ? (v.seats.some((s) => s.bet > 0) ? t('hdRaise', { n: fmt(raise) }) : t('hdBet', { n: fmt(raise) })) : ''

  const raiseStep = Math.max(5, v.config.bb)
  const clampRaise = (n: number) => turn ? Math.min(Math.max(n, turn.minRaiseTo), turn.maxRaiseTo) : n
  const stepRaise = (d: number) => setRaise((r) => clampRaise(Math.round((clampRaise(r) + d * raiseStep) / 5) * 5))
  const doFold = () => { if (turn && !turn.canCheck) send({ k: 'act', a: { a: 'fold' } }) }
  const doCall = () => { if (turn) send({ k: 'act', a: turn.canCheck ? { a: 'check' } : { a: 'call' } }) }
  const doRaise = () => { if (turn?.canRaise) send({ k: 'act', a: raise >= turn.maxRaiseTo ? { a: 'allin' } : { a: 'raise', to: clampRaise(raise) } }) }
  const doAllIn = () => { if (turn && turn.maxRaiseTo > 0) send({ k: 'act', a: { a: 'allin' } }) }

  return (
    <div className="kg hd">
      <div className="kg-wrap hdwrap">
        <Hotkeys enabled={!!turn} keys={{ f: doFold, c: doCall, r: doRaise, a: doAllIn, arrowup: () => stepRaise(1), arrowdown: () => stepRaise(-1) }} />
        <Bar />
        <TableHeader title={room === 'practice' ? t('practiceTitle') : `${t('hdRoom')} ${room}`} sub={`${v.config.sb}/${v.config.bb} · ${room === 'practice' ? t('hdCasual') : v.config.casual ? t('hdCasual') : t('hdCash')}`} watching={v.spectators}
          copied={copied} onCopy={room === 'practice' ? undefined : copy} onLeave={leave} leaveLabel={room === 'practice' ? t('hdLeave') : t('rmBack')} status={status} help={{ title: 'hdHow', lines: ['hdR1', 'hdR2', 'hdR3', 'hdR4', 'hdR5'] }} />
        {error && <p className="acerr hdbanner" role="alert">{t(error)}</p>}

        <div ref={feltRef} className="hdfelt k-felt" role="group" aria-label={t('hdRoom')}>
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
            const [x, y0] = spots[rel(s.seat) % spots.length]
            // on a short felt keep every seat (with the cards above it) inside the table
            const low = !s.me && y0 > 50 // the lower side seats sit level with you, clear of the board cards
            const y = feltH < 440 ? (low ? 100 - (44 / feltH) * 100 : Math.max(((s.me ? 112 : 40) / feltH) * 100, Math.min(100 - (40 / feltH) * 100, y0))) : y0
            const bx = x + (50 - x) * 0.32, by = y + (50 - y) * 0.32
            const showCards = s.dealt && !s.folded && (s.me || feltH >= 440) // on a short table other players' card backs only take room
            const isTurn = v.toAct === s.seat && v.street !== 'showdown' && v.street !== 'wait'
            const won = v.result?.won[s.seat] ?? 0
            return (
              <div key={s.seat}>
                {s.bet > 0 && <div className="hdbet" style={{ left: bx + '%', top: by + '%' }}>{fmt(s.bet)}</div>}
                <SeatChip className={'hdseat' + (s.empty ? ' empty' : '')} style={{ left: x + '%', top: y + '%' }} name={s.name || ''}
                  state={(s.me ? 'me ' : '') + (isTurn ? 'turn ' : '') + (s.folded ? 'folded ' : '') + (won > 0 ? 'won ' : '') + (s.out || !s.connected ? 'away' : '')}
                  badge={s.seat === v.button ? <i className="hdbtn-d" title={t('hdDealer')}>{t('hdDealer')}</i> : undefined}
                  sub={s.allIn && v.street !== 'wait' && v.street !== 'showdown' ? t('hdLastAllin') : fmt(s.stack)}>
                  {showCards && <div className="hdhole">{s.hole && s.hole.length === 2 ? s.hole.map((c, i) => <Card key={i} c={c} small={!s.me} />) : [0, 1].map((i) => <Card key={i} back small />)}</div>}
                  {s.last && v.street !== 'wait' && <div className="hdlast">{lastLabel(t, s.last)}</div>}
                  {isTurn && secsLeft != null && s.me && <div className="hdtimer"><span style={{ width: `${Math.min(100, (secsLeft / 30) * 100)}%` }} /></div>}
                </SeatChip>
              </div>
            )
          })}
        </div>

        <RefillNotice stack={youSeat ? youSeat.stack : undefined} casual={v.config.casual} minStack={v.config.bb} />
        <div className="hdbar">
          {youSeat ? (
            turn ? (
              <div className="hdactions hd-actions">
                {!turn.canCheck && <button className="hdbtn" onClick={doFold}>{t('hdFold')}<Kbd k="F" /></button>}
                <button className="hdbtn primary" onClick={doCall}>{turn.canCheck ? t('hdCheck') : t('hdCall', { n: fmt(turn.call) })}<Kbd k="C" /></button>
                {turn.canRaise && (
                  <div className="hdraise">
                    <div className="hd-stepper">
                      <button aria-label="−" onClick={() => stepRaise(-1)}>−</button>
                      <span className="hd-amount" aria-live="polite">{fmt(clampRaise(raise))}</span>
                      <button aria-label="+" onClick={() => stepRaise(1)}>+</button>
                    </div>
                    <input type="range" min={turn.minRaiseTo} max={turn.maxRaiseTo} step={raiseStep} value={clampRaise(raise)} onChange={(e) => setRaise(Number(e.target.value))} aria-label={raiseLabel} />
                    <div className="hdpresets">
                      <button onClick={() => setRaise(turn.minRaiseTo)}>{t('hdMin')}</button>
                      <button onClick={() => setRaise(Math.min(turn.maxRaiseTo, Math.max(turn.minRaiseTo, Math.round((v.pot / 2 + turn.call + (v.seats[v.you].bet)) / 5) * 5)))}>{t('hdHalf')}</button>
                      <button onClick={() => setRaise(Math.min(turn.maxRaiseTo, Math.max(turn.minRaiseTo, Math.round((v.pot + turn.call + v.seats[v.you].bet) / 5) * 5)))}>{t('hdPot')}</button>
                      <button onClick={() => setRaise(turn.maxRaiseTo)}>{t('hdAllIn')}<Kbd k="A" /></button>
                    </div>
                    <button className="hdbtn primary" onClick={doRaise}>{raise >= turn.maxRaiseTo ? t('hdAllIn') : raiseLabel}<Kbd k="R" /></button>
                  </div>
                )}
                {!turn.canRaise && turn.maxRaiseTo > 0 && <button className="hdbtn" onClick={() => send({ k: 'act', a: { a: 'allin' } })}>{t('hdAllIn')}<Kbd k="A" /></button>}
              </div>
            ) : bust ? (
              <OutOfChips balance={me?.balance ?? 0} min={v.buyin.min} max={Math.max(0, v.buyin.max - youSeat.stack)} step={v.config.bb} onBuy={(n) => { send({ k: 'rebuy', amount: n }); setTimeout(() => void refreshMe(), 900) }} onLeave={leave} />
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
        {room !== 'practice' && <TalkBox lines={talk} say={say} />}
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
