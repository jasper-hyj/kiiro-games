import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../../i18n'
import { Bar } from '../../hub/Hub'
import { useAccount } from '../../account/Account'
import { Card } from '../holdem/ui/Cards'
import { connectLocalBigTwo } from '../shared/localCash'
import { connectCash, getClientId, type CashConn, type Status, type TalkMsg } from '../shared/cashClient'
import { TalkBox } from '../shared/TalkBox'
import { backToRoom, fromRoom, makeCfg, roomSuffix } from '../shared/fromRoom'
import '../../room/strings'
import { beats, evalCombo, power } from './engine/combos'
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
  const [name, setName] = useState(() => load('kiiro-name', ''))
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
  const create = () => { save('kiiro-name', name); location.href = '/room?create=1&pick=bigtwo' }
  const join = (c: string) => { retry.current = null; save('kiiro-name', name); open(c.trim()) }
  useEffect(() => { if (urlRoom && !conn.current) { const mk = makeCfg(); if (mk) { ranked.current = mk.ranked === true; open(urlRoom, true) } else join(urlRoom) } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => conn.current?.close(), [])
  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; return } if (room) open(room) }, [me?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const leave = () => { const rm = startedFor.current; if (fromRoom() && rm) { conn.current?.close(); backToRoom(rm); return } conn.current?.close(); conn.current = null; setRoom(null); setView(null); history.replaceState(null, '', location.pathname); void refresh() }
  const send = (m: BtMsg) => conn.current?.send(m)

  if (!room) {
    return (
      <div className="kg hd bt">
        <div className="kg-wrap">
          <Bar />
          <h1>{t('btName')}</h1>
          <p className="kg-lead">{t('btTagline')}</p>
          {error && <p className="acerr" role="alert">{t(error)}</p>}
          <div className="hdform"><label>{t('hdNick')}<input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder={me?.name ?? 'Player'} /></label></div>
          <Rules title="btHow" lines={['btR1', 'btR2', 'btR3', 'btR4', 'btR5']} />
          <div className="kg-cols">
            <section className="hdform"><h2>{t('hdCreate')}</h2><p className="kg-note">{t('rmCreateNote')}</p><div className="hdrow"><button className="hdbtn primary" onClick={create}>{t('rmCreateBtn')}</button><button className="hdbtn" onClick={practice}>{t('practiceOffline')}</button></div></section>
            <section className="hdform"><h2>{t('hdJoin')}</h2>
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
  if (!view) return <div className="kg hd"><div className="kg-wrap"><Bar /><p className="kg-lead hdstatus">{status === 'closed' ? t('hdLost') : t('hdConnecting')}</p>{error && <p className="acerr">{t(error)}</p>}</div></div>
  return <BtTable v={view} status={status} room={room} error={error} send={send} talk={talk} say={(x) => conn.current?.say?.(x)} leave={leave} me={me} openSignIn={openSignIn} />
}

function BtTable({ v, status, room, error, send, talk, say, leave, me, openSignIn }: { v: BigTwoView; status: Status; room: string; error: string; send: (m: BtMsg) => void; talk: TalkMsg[]; say(text: string): void; leave(): void; me: ReturnType<typeof useAccount>['me']; openSignIn(): void }) {
  const { t } = useLang()
  const [sel, setSel] = useState<number[]>([])
  const [copied, setCopied] = useState(false)
  const [, tick] = useState(0)
  const deadline = useRef<number | null>(null)
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(i) }, [])
  useEffect(() => { deadline.current = v.timeLeft != null ? Date.now() + v.timeLeft : null }, [v])
  // a play or a new game clears the selection
  const key = `${v.game}:${v.last.length}:${v.status}`
  useEffect(() => { setSel([]) }, [key])
  const link = `${location.origin}${location.pathname}?room=${room}`
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ } }
  const myTurn = v.status === 'playing' && v.turn === v.you
  const chosen = sel.length ? evalCombo(sel) : null
  const curCombo = v.current ? evalCombo(v.current.cards) : null
  const legal = !!chosen && beats(chosen, curCombo) && (!v.mustOpen || sel.includes(27))
  const ref = Math.max(0, v.you)
  const watcher = v.you < 0
  const rel = (seat: number) => (seat - ref + 4) % 4 // 0 me, 1 left, 2 top, 3 right
  const secs = deadline.current ? Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)) : null
  const toggle = (c: number) => setSel((s) => (s.includes(c) ? s.filter((x) => x !== c) : s.length < 5 ? [...s, c] : s))
  const hand = [...v.hand].sort((a, b) => power(a) - power(b))
  const head = (
    <>
      <Bar />
      <div className="hdhead">
        <span><b>{room === 'practice' ? t('practiceTitle') : `${t('hdRoom')} ${room}`}</b> <span className="muted">· {room === 'practice' ? t('btCasual') : v.config.ranked ? t('btRanked') : t('btCasual')}</span></span>
        <span className="hdtools">{room !== 'practice' && <button className="hdlink" onClick={copy}>{copied ? t('hdCopied') : t('hdCopy')}</button>}<button className="hdlink" onClick={leave}>{fromRoom() ? t('rmBack') : t('hdLeave')}</button></span>
      </div>
      {status !== 'open' && <p className="acerr hdbanner">{t('hdLost')}</p>}
      {error && <p className="acerr hdbanner" role="alert">{t(error)}</p>}
    </>
  )

  if (v.status === 'lobby') {
    return (
      <div className="kg hd bt"><div className="kg-wrap hdwrap">{head}
        <h2 className="btsec">{t('btSeats')}</h2>
        {v.you < 0 && <p className="kg-note">{t('hdSpectating')} <button className="hdbtn primary" onClick={() => send({ k: 'sit' })}>{t('hdSit')}</button></p>}
        <ul className="btlobby">{v.seats.map((s) => <li key={s.seat} className={s.empty ? 'muted' : ''}>{s.empty ? t('btBot') : <>{s.name}{s.me && <span className="muted"> · {t('btYou')}</span>}</>}</li>)}</ul>
        {v.host ? (
          <div className="hdform">
            <div className="hdseg"><button className={!v.config.ranked ? 'on' : ''} onClick={() => send({ k: 'config', config: { ranked: false } })}>{t('btCasual')}</button>
              <button className={v.config.ranked ? 'on' : ''} disabled={!me} onClick={() => send({ k: 'config', config: { ranked: true } })}>{t('btRanked')}</button></div>
            <p className="kg-note">{me ? t('btRankedHint') : <>{t('acRankedLocked')} <button className="hdlink" onClick={openSignIn}>{t('acSignIn')}</button></>}</p>
            <div><button className="hdbtn primary" onClick={() => send({ k: 'start' })}>{t('btStart')}</button></div>
          </div>
        ) : <p className="kg-note">{t('btWaitHost')}</p>}
        {v.watching > 0 && <p className="kg-note">{t('btWatchers', { n: v.watching })}</p>}
        <p className="kg-note">{t('btRules')}</p>
        {room !== 'practice' && <TalkBox lines={talk} say={say} />}
      </div></div>
    )
  }

  const msg = v.status === 'over' ? '' : myTurn ? (v.mustOpen ? t('btOpen') : !v.current ? t('btLead') : t('btYourTurn') + (secs != null ? ` · ${secs}s` : '')) : v.turn >= 0 ? t('btWaitTurn', { name: v.seats[v.turn].name }) : ''
  return (
    <div className="kg hd bt"><div className="kg-wrap hdwrap">{head}
      <div className="bttable">
        {v.seats.filter((s) => s.seat !== ref).map((s) => (
          <div key={s.seat} className={'btseat pos' + rel(s.seat) + (v.turn === s.seat ? ' turn' : '') + (!s.connected && !s.bot ? ' away' : '')}>
            <div className="bttag">{s.name}</div>
            <div className="btcount">{t('btCards', { n: s.count })}</div>
            {s.passed && v.status === 'playing' && <div className="btpass">{t('btPassed')}</div>}
          </div>
        ))}
        <div className="btcenter">
          {v.status === 'over' && v.result ? (
            <div className="btresult">
              <div className="hdwin">{t('btWins', { name: v.seats[v.result.winner].name })}</div>
              <table className="kgt"><thead><tr><th>{t('acPlayer')}</th><th>{t('btLeft', { n: '' }).trim()}</th><th>{t('btPoints')}</th></tr></thead>
                <tbody>{v.seats.map((s) => <tr key={s.seat} className={s.me ? 'me' : ''}><td>{s.name}</td><td>{v.result!.left[s.seat]}</td><td className={v.result!.points[s.seat] >= 0 ? 'kg-up' : 'kg-down'}>{v.result!.points[s.seat] > 0 ? '+' : ''}{v.result!.points[s.seat]}</td></tr>)}</tbody></table>
              {v.host ? <button className="hdbtn primary" onClick={() => send({ k: 'lobby' })}>{t('btAgain')}</button> : <p className="kg-note">{t('btWaitHost')}</p>}
            </div>
          ) : (
            <>
              <div className="btplay">{v.current ? <>{v.current.cards.map((c) => <Card key={c} c={c} />)}</> : <span className="pkslot" />}</div>
              {v.current && <div className="muted small">{v.seats[v.current.seat].name} · {t('btt.' + v.current.type)}</div>}
              <div className="hdmsg">{msg}</div>
            </>
          )}
        </div>
      </div>

      {watcher ? (
        <div className="bthand btwatch" role="group" aria-label="watching">
          <div className="btseat bottom"><div className="bttag">{v.seats[ref].name}</div><div className="btcount">{t('btCards', { n: v.seats[ref].count })}</div></div>
        </div>
      ) : (
      <div className="bthand" role="group" aria-label="hand">
        {hand.map((c) => <button key={c} className={'btcard' + (sel.includes(c) ? ' sel' : '')} onClick={() => toggle(c)} disabled={v.status !== 'playing'}><Card c={c} /></button>)}
      </div>
      )}
      <div className="hdbar">
        {watcher ? (
          <div className="hdactions"><span className="muted small">{t('hdSpectating')}{v.watching > 0 ? ` · ${t('btWatchers', { n: v.watching })}` : ''}</span><button className="hdbtn primary" onClick={() => send({ k: 'sit' })}>{t('hdSit')}</button></div>
        ) : (
        <div className="hdactions">
          <button className="hdbtn" disabled={!myTurn || !v.canPass} onClick={() => send({ k: 'pass' })}>{t('btPassBtn')}</button>
          <button className="hdbtn primary" disabled={!myTurn || !legal} onClick={() => send({ k: 'play', cards: sel })}>{t('btPlayBtn')}{chosen ? ` · ${t('btt.' + chosen.type)}` : ''}</button>
        </div>
        )}
      </div>
      {room !== 'practice' && <TalkBox lines={talk} say={say} />}
    </div></div>
  )
}
