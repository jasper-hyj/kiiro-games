import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readName, writeName } from '../shared/name'
import { useLang } from '../../i18n'
import { Bar } from '../../hub/Hub'
import { useAccount } from '../../account/Account'
import { Card } from '../holdem/ui/Cards'
import { connectLocalBlackjack } from '../shared/localCash'
import { connectCash, getClientId, type CashConn, type Status, type TalkMsg } from '../shared/cashClient'
import { TalkBox } from '../shared/TalkBox'
import { Hotkeys, Kbd, SeatChip, TableHeader } from '../../ui/components'
import { backToRoom, fromRoom, makeCfg, roomSuffix } from '../shared/fromRoom'
import { NoRoom } from '../../ui/components'
import '../../room/strings'
import { MIN_BETS } from './engine/table'
import { Rules } from '../shared/Rules'
import type { BjMsg, BlackjackView } from './net/protocol'
import '../holdem/strings'
import './strings'
import '../holdem/holdem.css'
import './blackjack.css'

const load = (k: string, d = '') => { try { return localStorage.getItem(k) ?? d } catch { return d } }
const save = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } }
const fmt = (n: number) => n.toLocaleString()

export default function BlackjackApp() {
  const { t } = useLang()
  const { me, openSignIn, refresh } = useAccount()
  const [name, setName] = useState(() => readName(''))
  const [view, setView] = useState<BlackjackView | null>(null)
  const [status, setStatus] = useState<Status>('closed')
  const [error, setError] = useState('')
  const [room, setRoom] = useState<string | null>(null)
  const [minBet, setMinBet] = useState(() => Number(load('kiiro-bj-min', '10')))
  const [casual, setCasual] = useState(() => load('kiiro-bj-casual', '1') === '1')
  const [code, setCode] = useState('')
  const [buyin, setBuyin] = useState(0)
  const [talk, setTalk] = useState<TalkMsg[]>([])
  const conn = useRef<CashConn<BjMsg> | null>(null)
  const startedFor = useRef<string | null>(null)
  const retry = useRef<(() => void) | null>(null)
  /** opened from a room: the host's table may not exist yet, so a join that finds nothing tries again for a few seconds */
  const again = useRef<(() => void) | null>(null)
  const tries = useRef(0)
  const urlRoom = useMemo(() => new URLSearchParams(location.search).get('room'), [])

  const handlers = useMemo(() => ({
    onView: (v: BlackjackView) => { retry.current = null; setView(v); setError('') },
    onStatus: setStatus,
    onTalk: (m: TalkMsg) => setTalk((l) => [...l.filter((x) => x.n !== m.n), m].slice(-60)),
    onTalkLog: (ms: TalkMsg[]) => setTalk(ms),
    onError: (m: string) => {
      if (m === 'room_not_found' && fromRoom() && !makeCfg() && again.current && tries.current++ < 12) { setTimeout(() => again.current?.(), 800); return }
      if ((m === 'code_taken' || m.startsWith('wrong_game:')) && retry.current) { retry.current(); return } // a code that another room or game already uses: pick a new one
      if (m.startsWith('wrong_game:') && fromRoom()) { setError('rmCodeClash'); return } // from a room: never jump into another game's table
      if (m.startsWith('wrong_game:')) { location.href = `/${m.split(':')[1]}?room=${startedFor.current}`; return }
      setError(m)
      if (m === 'room_not_found' || m === 'code_taken') { conn.current?.close(); conn.current = null; setRoom(null); setView(null); history.replaceState(null, '', location.pathname) }
      setTimeout(() => setError((e) => (e === m ? '' : e)), 5000)
    },
  }), [])
  const open = useCallback((rm: string, create?: { bb: number; casual: boolean }) => {
    conn.current?.close()
    startedFor.current = rm
    setRoom(rm); setView(null); setTalk([])
    history.replaceState(null, '', `${location.pathname}?room=${rm}${roomSuffix()}`)
    again.current = create ? null : () => open(rm)
    conn.current = connectCash<BlackjackView, BjMsg>('blackjack', rm, getClientId(), (name.trim() || me?.name || 'Player').slice(0, 16), handlers, create)
  }, [name, me?.name, handlers])
  const practice = () => {
    conn.current?.close(); startedFor.current = null; setRoom('practice'); setView(null)
    conn.current = connectLocalBlackjack(getClientId(), (name.trim() || me?.name || 'Player').slice(0, 16), minBet, handlers)
  }
  const create = () => { writeName(name); location.href = '/room?create=1&pick=blackjack' }
  const join = (c: string) => { retry.current = null; writeName(name); open(c.trim()) }
  useEffect(() => { if (urlRoom && !conn.current) { const mk = makeCfg(); if (mk) open(urlRoom, { bb: Number(mk.bb) || 10, casual: mk.casual !== false }); else join(urlRoom) } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => conn.current?.close(), [])
  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; return } if (room) open(room) }, [me?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (new URLSearchParams(location.search).get('practice') === '1' && !conn.current) practice() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const leave = () => { if (room === 'practice') { conn.current?.close(); location.href = '/'; return } const rm = startedFor.current; if (fromRoom() && rm) { conn.current?.close(); backToRoom(rm); return } conn.current?.close(); conn.current = null; setRoom(null); setView(null); history.replaceState(null, '', location.pathname); void refresh() }

  if (!room) return <NoRoom game="blackjack" error={error} />
  return <BjTable view={view} status={status} room={room} error={error} send={(m) => conn.current?.send(m)} talk={talk} say={(x) => conn.current?.say?.(x)} room_={room} leave={leave} me={me} openSignIn={openSignIn} buyin={buyin} setBuyin={setBuyin} refreshMe={refresh} />
}

function BjTable({ view, status, room, error, send, talk, say, leave, me, openSignIn, buyin, setBuyin, refreshMe }: {
  view: BlackjackView | null; status: Status; room: string; error: string; send: (m: BjMsg) => void; leave(): void; talk: TalkMsg[]; say(text: string): void; room_?: string
  me: ReturnType<typeof useAccount>['me']; openSignIn(): void; buyin: number; setBuyin(n: number): void; refreshMe(): Promise<void>
}) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)
  const [bet, setBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [, tick] = useState(0)
  const nextAt = useRef<number | null>(null)
  const deadline = useRef<number | null>(null)
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(i) }, [])
  useEffect(() => { if (view) { nextAt.current = view.nextIn != null ? Date.now() + view.nextIn : null; deadline.current = view.timeLeft != null ? Date.now() + view.timeLeft : null } }, [view])
  const seated = view ? view.you >= 0 : false
  useEffect(() => { void refreshMe() }, [seated]) // eslint-disable-line react-hooks/exhaustive-deps
  const minB = view?.config.bet ?? 0
  const phaseKey = view ? `${view.round}:${view.phase}` : ''
  useEffect(() => { if (view?.phase === 'bet') setBet(0) }, [phaseKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const minBuy = view?.buyin.min ?? 0, maxBuy = view?.buyin.max ?? 0
  useEffect(() => { if (view && (buyin < minBuy || buyin > maxBuy)) setBuyin(Math.min(maxBuy, Math.max(minBuy, minB * 50))) }, [minB]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!view) return <div className="kg hd"><div className="kg-wrap"><Bar /><p className="kg-lead hdstatus">{status === 'closed' ? t('hdLost') : t('hdConnecting')}</p>{error && <p className="acerr">{t(error)}</p>}</div></div>
  const v = view
  const you = v.you >= 0 ? v.seats[v.you] : null
  const myPending = you?.pending ?? 0
  const nextS = nextAt.current ? Math.max(0, Math.ceil((nextAt.current - Date.now()) / 1000)) : null
  const secs = deadline.current ? Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)) : null
  const link = `${location.origin}${location.pathname}?room=${room}`
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ } }
  const toActName = v.toAct ? v.seats[v.toAct.seat].name : ''
  const room_ = v.betLimits.max
  const cap = Math.min(v.betLimits.max, you ? you.stack + you.pending : 0)
  const addChip = (n: number) => setBet((b) => Math.min(cap, b + n))
  const betOk = bet >= minB && bet % 2 === 0 && bet <= cap
  const placeBet = () => { if (v.canBet && betOk) { setLastBet(bet); send({ k: 'act', a: { a: 'bet', amount: bet } }) } }
  const act = (a: 'hit' | 'stand' | 'double' | 'split') => { if (v.options && (a === 'stand' || v.options[a])) send({ k: 'act', a: { a } }) }
  // keys: H hit, S stand, D double, P split; when betting: 1-5 add a chip, Enter places the bet, Esc clears it
  const message = v.phase === 'bet' ? t('bjBetNow') + (secs != null ? ` · ${secs}s` : '')
    : v.phase === 'play' ? (v.options ? t('bjYourTurn') : toActName ? t('bjWaitTurn', { name: toActName }) : t('bjDeal'))
    : v.phase === 'dealer' ? t('bjDealerPlays')
    : v.phase === 'result' ? (nextS != null ? t('bjNext', { s: nextS }) : '')
    : v.seats.some((s) => !s.empty) ? t('bjWaiting') : t('bjWaiting')
  return (
    <div className="kg hd bj">
      <div className="kg-wrap hdwrap">
        <Hotkeys enabled={!!you} keys={{
          h: () => act('hit'), s: () => act('stand'), d: () => act('double'), p: () => act('split'),
          enter: v.canBet ? placeBet : undefined, escape: v.canBet ? () => setBet(0) : undefined,
          ...Object.fromEntries([1, 2, 3, 4, 5].map((i) => [String(i), v.canBet ? () => addChip(minB * [1, 2, 5, 10, 25][i - 1]) : undefined])),
        }} />
        <Bar />
        <TableHeader title={room === 'practice' ? t('practiceTitle') : `${t('hdRoom')} ${room}`}
          sub={`${t('bjMinMax', { min: fmt(v.config.bet), max: fmt(room_ > 0 ? v.config.bet * 50 : 0) })} · ${v.config.casual ? t('hdCasual') : t('hdCash')}`}
          copied={copied} onCopy={room === 'practice' ? undefined : copy} onLeave={leave} leaveLabel={fromRoom() ? t('rmBack') : t('hdLeave')} status={status} help={{ title: 'bjHow', lines: ['bjR1', 'bjR2', 'bjR3', 'bjR4', 'bjR5'] }} />
        {error && <p className="acerr hdbanner" role="alert">{t(error)}</p>}

        <div className="bjtable k-felt">
          <div className="bjdealer">
            <div className="bjlabel">{t('bjDealer')}{v.dealer.value != null && <b>{v.dealer.value}</b>}</div>
            <div className="bjcards">{v.dealer.cards.length === 0 ? <span className="pkslot" /> : v.dealer.cards.map((c, i) => c === null ? <Card key={i} back /> : <Card key={i} c={c} />)}</div>
          </div>
          <div className="hdmsg bjmsg" aria-live="polite">{message}</div>
          <div className="bjseats">
            {v.seats.filter((s) => !s.empty).map((s) => {
              const turnHere = v.toAct?.seat === s.seat && v.phase === 'play'
              return (
                <SeatChip key={s.seat} className="bjseat" name={s.name} sub={fmt(s.stack)} state={(s.me ? 'me ' : '') + (turnHere ? 'turn ' : '') + (s.out || !s.connected ? 'away' : '')}>
                  {v.phase === 'bet' && s.pending > 0 && <div className="bjbet">{fmt(s.pending)}</div>}
                  <div className="bjhands">
                    {s.hands.map((h, hi) => (
                      <div key={hi} className={'bjhand' + (turnHere && v.toAct?.hand === hi ? ' active' : '')}>
                        <div className="bjcards small">{h.cards.map((c, i) => <Card key={i} c={c} small />)}</div>
                        <div className="bjinfo"><b>{h.value}{h.soft && h.value < 21 && !h.done ? ` ${t('bjSoft')}` : ''}</b><span className="muted"> · {fmt(h.bet)}</span>
                          {h.outcome && <span className={'bjout ' + h.outcome}>{t('bjo.' + h.outcome)} {h.net !== 0 ? (h.net > 0 ? '+' : '') + fmt(h.net) : ''}</span>}</div>
                      </div>
                    ))}
                  </div>
                </SeatChip>
              )
            })}
          </div>
        </div>

        <div className="hdbar">
          {you ? (
            v.options ? (
              <div className="hdactions bj-actions">
                <button className="hdbtn primary" disabled={!v.options.hit} onClick={() => act('hit')}>{t('bjHit')}<Kbd k="H" /></button>
                <button className="hdbtn" onClick={() => act('stand')}>{t('bjStand')}<Kbd k="S" /></button>
                <button className="hdbtn" disabled={!v.options.double} onClick={() => act('double')}>{t('bjDouble')}<Kbd k="D" /></button>
                <button className="hdbtn" disabled={!v.options.split} onClick={() => act('split')}>{t('bjSplit')}<Kbd k="P" /></button>
              </div>
            ) : v.canBet ? (
              <div className="bjbetbar">
                <div className="bjstake" aria-live="polite"><span className="muted">{t('bjYourBet')}</span><b>{fmt(bet)}</b></div>
                <div className="bjchips" role="group" aria-label={t('bjChips')}>
                  {[1, 2, 5, 10, 25].map((m, i) => <button key={m} className={'bjchip c' + i} disabled={bet + minB * m > cap} onClick={() => addChip(minB * m)} aria-label={`+${fmt(minB * m)}`}><span>{fmt(minB * m)}</span></button>)}
                </div>
                <div className="hdactions">
                  {bet > 0 ? <button className="hdbtn quiet" onClick={() => setBet(0)}>{t('bjClear')}<Kbd k="Esc" /></button>
                    : lastBet >= minB && lastBet <= cap ? <button className="hdbtn" onClick={() => setBet(lastBet)}>{t('bjRepeat', { n: fmt(lastBet) })}</button> : null}
                  <button className="hdbtn primary" disabled={!betOk} onClick={placeBet}>{bet > 0 ? t('bjBet', { n: fmt(bet) }) : t('bjBetNow')}<Kbd k="↵" /></button>
                </div>
                {myPending > 0 && <p className="muted small">{t('bjBetPlaced', { n: fmt(myPending) })}</p>}
                {bet > 0 && bet < minB && <p className="muted small">{t('bjMinBetNote', { n: fmt(minB) })}</p>}
                {bet > 0 && bet % 2 !== 0 && <p className="muted small">{t('bjEvenNote')}</p>}
              </div>
            ) : (
              <div className="hdactions idle">
                {you.out ? <><span className="muted">{t('hdOutNote')}</span><button className="hdbtn primary" onClick={() => send({ k: 'out', out: false })}>{t('hdBack')}</button></>
                  : <button className="hdlink" onClick={() => send({ k: 'out', out: true })}>{t('hdSitOut')}</button>}
              </div>
            )
          ) : (
            <div className="hdsit">
              {v.config.casual ? <button className="hdbtn primary" onClick={() => send({ k: 'sit', buyin: 0 })}>{t('hdSit')}</button>
                : me ? <>
                  <label className="hdbuy">{t('hdBuyin')}<input type="range" min={minBuy} max={maxBuy} step={minB} value={buyin} onChange={(e) => setBuyin(Number(e.target.value))} /><b>{fmt(buyin)}</b> <span className="muted">/ {fmt(me.balance)}</span></label>
                  <button className="hdbtn primary" onClick={() => send({ k: 'sit', buyin })}>{t('hdSitCash', { n: fmt(buyin) })}</button></>
                : <button className="hdbtn primary" onClick={openSignIn}>{t('hdSignIn')}</button>}
              <p className="kg-note">{t('hdSpectating')}</p>
            </div>
          )}
        </div>
        {room !== 'practice' && <TalkBox lines={talk} say={say} />}
      </div>
    </div>
  )
}
