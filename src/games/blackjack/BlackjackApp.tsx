import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../../i18n'
import { Bar } from '../../hub/Hub'
import { useAccount } from '../../account/Account'
import { Card } from '../holdem/ui/Cards'
import { connectLocalBlackjack } from '../shared/localCash'
import { connectCash, getClientId, type CashConn, type Status } from '../shared/cashClient'
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
  const [name, setName] = useState(() => load('kiiro-name', ''))
  const [view, setView] = useState<BlackjackView | null>(null)
  const [status, setStatus] = useState<Status>('closed')
  const [error, setError] = useState('')
  const [room, setRoom] = useState<string | null>(null)
  const [minBet, setMinBet] = useState(() => Number(load('kiiro-bj-min', '10')))
  const [casual, setCasual] = useState(() => load('kiiro-bj-casual', '1') === '1')
  const [code, setCode] = useState('')
  const [buyin, setBuyin] = useState(0)
  const conn = useRef<CashConn<BjMsg> | null>(null)
  const startedFor = useRef<string | null>(null)
  const retry = useRef<(() => void) | null>(null)
  const urlRoom = useMemo(() => new URLSearchParams(location.search).get('room'), [])

  const handlers = useMemo(() => ({
    onView: (v: BlackjackView) => { retry.current = null; setView(v); setError('') },
    onStatus: setStatus,
    onError: (m: string) => {
      if (m === 'code_taken' && retry.current) { retry.current(); return }
      if (m.startsWith('wrong_game:')) { location.href = `/${m.split(':')[1]}?room=${startedFor.current}`; return }
      setError(m)
      if (m === 'room_not_found' || m === 'code_taken') { conn.current?.close(); conn.current = null; setRoom(null); setView(null); history.replaceState(null, '', location.pathname) }
      setTimeout(() => setError((e) => (e === m ? '' : e)), 5000)
    },
  }), [])
  const open = useCallback((rm: string, create?: { bb: number; casual: boolean }) => {
    conn.current?.close()
    startedFor.current = rm
    setRoom(rm); setView(null)
    history.replaceState(null, '', `${location.pathname}?room=${rm}`)
    conn.current = connectCash<BlackjackView, BjMsg>('blackjack', rm, getClientId(), (name.trim() || me?.name || 'Player').slice(0, 16), handlers, create)
  }, [name, me?.name, handlers])
  const practice = () => {
    conn.current?.close(); startedFor.current = null; setRoom('practice'); setView(null)
    conn.current = connectLocalBlackjack(getClientId(), (name.trim() || me?.name || 'Player').slice(0, 16), minBet, handlers)
  }
  const create = () => { save('kiiro-name', name); save('kiiro-bj-min', String(minBet)); save('kiiro-bj-casual', casual ? '1' : '0'); let n = 0; const go = () => { retry.current = n++ < 8 ? go : null; open(String(1000 + Math.floor(Math.random() * 9000)), { bb: minBet, casual }) }; go() }
  const join = (c: string) => { retry.current = null; save('kiiro-name', name); open(c.trim()) }
  useEffect(() => { if (urlRoom && !conn.current) join(urlRoom) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => conn.current?.close(), [])
  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; return } if (room) open(room) }, [me?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const leave = () => { conn.current?.close(); conn.current = null; setRoom(null); setView(null); history.replaceState(null, '', location.pathname); void refresh() }

  if (!room) {
    return (
      <div className="kg hd bj">
        <div className="kg-wrap">
          <Bar />
          <h1>{t('bjName')}</h1>
          <p className="kg-lead">{t('bjTagline')}</p>
          {error && <p className="acerr" role="alert">{t(error)}</p>}
          <div className="hdform"><label>{t('hdNick')}<input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder={me?.name ?? 'Player'} /></label></div>
          <Rules title="bjHow" lines={['bjR1', 'bjR2', 'bjR3', 'bjR4', 'bjR5']} />
          <div className="kg-cols">
            <section className="hdform">
              <h2>{t('bjCreate')}</h2>
              <label>{t('bjMinBet')}<select value={minBet} onChange={(e) => setMinBet(Number(e.target.value))}>{MIN_BETS.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
              <div className="hdseg" role="group" aria-label={t('hdMode')}>
                <button className={casual ? 'on' : ''} onClick={() => setCasual(true)}>{t('hdCasual')}</button>
                <button className={!casual ? 'on' : ''} onClick={() => setCasual(false)}>{t('hdCash')}</button>
              </div>
              <p className="kg-note">{casual ? t('hdCasualNote') : t('hdCashNote')}</p>
              <div className="hdrow"><button className="hdbtn primary" onClick={create}>{t('hdCreateBtn')}</button><button className="hdbtn" onClick={practice}>{t('practiceOffline')}</button></div>
            </section>
            <section className="hdform">
              <h2>{t('hdJoin')}</h2>
              <form onSubmit={(e) => { e.preventDefault(); if (/^\d{4}$/.test(code)) join(code) }} className="hdrow">
                <input inputMode="numeric" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder={t('hdCode')} aria-label={t('hdCode')} />
                <button className="hdbtn primary" disabled={!/^\d{4}$/.test(code)}>{t('hdJoinBtn')}</button>
              </form>
            </section>
          </div>
        </div>
      </div>
    )
  }
  return <BjTable view={view} status={status} room={room} error={error} send={(m) => conn.current?.send(m)} leave={leave} me={me} openSignIn={openSignIn} buyin={buyin} setBuyin={setBuyin} refreshMe={refresh} />
}

function BjTable({ view, status, room, error, send, leave, me, openSignIn, buyin, setBuyin, refreshMe }: {
  view: BlackjackView | null; status: Status; room: string; error: string; send: (m: BjMsg) => void; leave(): void
  me: ReturnType<typeof useAccount>['me']; openSignIn(): void; buyin: number; setBuyin(n: number): void; refreshMe(): Promise<void>
}) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)
  const [bet, setBet] = useState(0)
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
  const message = v.phase === 'bet' ? t('bjBetNow') + (secs != null ? ` · ${secs}s` : '')
    : v.phase === 'play' ? (v.options ? t('bjYourTurn') : toActName ? t('bjWaitTurn', { name: toActName }) : t('bjDeal'))
    : v.phase === 'dealer' ? t('bjDealerPlays')
    : v.phase === 'result' ? (nextS != null ? t('bjNext', { s: nextS }) : '')
    : v.seats.some((s) => !s.empty) ? t('bjWaiting') : t('bjWaiting')
  return (
    <div className="kg hd bj">
      <div className="kg-wrap hdwrap">
        <Bar />
        <div className="hdhead">
          <span><b>{room === 'practice' ? t('practiceTitle') : `${t('hdRoom')} ${room}`}</b> <span className="muted">· {t('bjMinMax', { min: fmt(v.config.bet), max: fmt(room_ > 0 ? v.config.bet * 50 : 0) })} · {v.config.casual ? t('hdCasual') : t('hdCash')}</span></span>
          <span className="hdtools">{room !== 'practice' && <button className="hdlink" onClick={copy}>{copied ? t('hdCopied') : t('hdCopy')}</button>}<button className="hdlink" onClick={leave}>{t('hdLeave')}</button></span>
        </div>
        {status !== 'open' && <p className="acerr hdbanner">{t('hdLost')}</p>}
        {error && <p className="acerr hdbanner" role="alert">{t(error)}</p>}

        <div className="bjtable">
          <div className="bjdealer">
            <div className="bjlabel">{t('bjDealer')}{v.dealer.value != null && <b>{v.dealer.value}</b>}</div>
            <div className="bjcards">{v.dealer.cards.length === 0 ? <span className="pkslot" /> : v.dealer.cards.map((c, i) => c === null ? <Card key={i} back /> : <Card key={i} c={c} />)}</div>
          </div>
          <div className="hdmsg bjmsg" aria-live="polite">{message}</div>
          <div className="bjseats">
            {v.seats.filter((s) => !s.empty).map((s) => {
              const turnHere = v.toAct?.seat === s.seat && v.phase === 'play'
              return (
                <div key={s.seat} className={'bjseat' + (s.me ? ' me' : '') + (turnHere ? ' turn' : '') + (s.out || !s.connected ? ' away' : '')}>
                  <div className="bjname">{s.name}</div>
                  <div className="hdstack">{fmt(s.stack)}</div>
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
                </div>
              )
            })}
          </div>
        </div>

        <div className="hdbar">
          {you ? (
            v.options ? (
              <div className="hdactions">
                <button className="hdbtn" onClick={() => send({ k: 'act', a: { a: 'stand' } })}>{t('bjStand')}</button>
                <button className="hdbtn primary" disabled={!v.options.hit} onClick={() => send({ k: 'act', a: { a: 'hit' } })}>{t('bjHit')}</button>
                <button className="hdbtn" disabled={!v.options.double} onClick={() => send({ k: 'act', a: { a: 'double' } })}>{t('bjDouble')}</button>
                <button className="hdbtn" disabled={!v.options.split} onClick={() => send({ k: 'act', a: { a: 'split' } })}>{t('bjSplit')}</button>
              </div>
            ) : v.canBet ? (
              <div className="bjbetbar">
                <div className="bjchips">{[1, 2, 5, 10, 25].map((m) => <button key={m} className="bjchip" disabled={bet + minB * m > cap} onClick={() => addChip(minB * m)}>+{fmt(minB * m)}</button>)}<button className="hdlink" onClick={() => setBet(0)}>×</button></div>
                <div className="hdactions">
                  <button className="hdbtn primary" disabled={bet < minB || bet % 2 !== 0 || bet > cap} onClick={() => send({ k: 'act', a: { a: 'bet', amount: bet } })}>{bet > 0 ? t('bjBet', { n: fmt(bet) }) : t('bjBetNow')}</button>
                  {myPending > 0 && <span className="muted">{t('bjBetPlaced', { n: fmt(myPending) })}</span>}
                </div>
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
      </div>
    </div>
  )
}
