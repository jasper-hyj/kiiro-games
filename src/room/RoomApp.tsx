import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { nameOrGuest, writeName } from '../games/shared/name'
import { useLang } from '../i18n'
import { Bar } from '../hub/Hub'
import { useAccount } from '../account/Account'
import { getToken } from '../account/api'
import { api } from '../account/api'
import { BLINDS } from '../games/holdem/engine/table'
import { MIN_BETS } from '../games/blackjack/engine/table'
import { TalkBox } from '../games/shared/TalkBox'
import { TableHeader } from '../ui/components'
import { Rules as HowTo } from '../games/shared/Rules'
import { getClientId } from '../games/shared/cashClient'
import { connectRoom, gameUrl, type RoomCfg, type RoomConn, type RoomGame, type RoomView, type TalkLine } from './roomClient'
import '../games/holdem/strings'
import '../games/holdem/holdem.css'
import '../games/mahjong/strings'
import '../games/mahjong/strings.ja'
import '../games/blackjack/strings'
import '../games/bigtwo/strings'
import './strings'
import './room.css'

const GAMES: { id: RoomGame; name: string }[] = [
  { id: 'mahjong', name: 'rmMahjong' }, { id: 'holdem', name: 'rmHoldem' }, { id: 'blackjack', name: 'rmBlackjack' }, { id: 'bigtwo', name: 'rmBigtwo' },
]
const HOW: Record<'holdem' | 'blackjack' | 'bigtwo', { title: string; lines: string[] }> = {
  holdem: { title: 'hdHow', lines: ['hdR1', 'hdR2', 'hdR3', 'hdR4', 'hdR5'] }, blackjack: { title: 'bjHow', lines: ['bjR1', 'bjR2', 'bjR3', 'bjR4', 'bjR5'] }, bigtwo: { title: 'btHow', lines: ['btR1', 'btR2', 'btR3', 'btR4', 'btR5'] },
}
const RULESETS = ['taiwan', 'hk', 'riichi', 'mcr', 'sichuan']
const DEFAULTS: Record<RoomGame, RoomCfg> = { mahjong: { rule: 'taiwan' }, holdem: { sb: 25, bb: 50, casual: true }, blackjack: { bb: MIN_BETS[0], casual: true }, bigtwo: {} }
const newCode = () => String(1000 + Math.floor(Math.random() * 9000))

/** The room: gather first, then choose the game and its rules together. Starting sends everyone to the table under this code. */
export default function RoomApp() {
  const { t } = useLang()
  const { me } = useAccount()
  const q = useMemo(() => new URLSearchParams(location.search), [])
  const urlRoom = q.get('room')
  // a guest gets a distinct default name, kept for the games that follow
  const [name, setName] = useState(nameOrGuest)
  useEffect(() => { if (me?.name) setName(me.name) }, [me?.name])
  const [room, setRoom] = useState<string | null>(null)
  const [view, setView] = useState<RoomView | null>(null)
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('closed')
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [talk, setTalk] = useState<TalkLine[]>([])
  const [copied, setCopied] = useState(false)
  const conn = useRef<RoomConn | null>(null)
  const retry = useRef<(() => void) | null>(null)
  const roomRef = useRef<string | null>(null)
  const pickOnce = useRef(q.get('pick') as RoomGame | null)

  const handlers = useMemo(() => ({
    onView: (v: RoomView) => {
      retry.current = null; setView(v); setError('')
      if (pickOnce.current && v.host && !v.game) { const g = pickOnce.current; pickOnce.current = null; conn.current?.send({ t: 'pick', game: g, cfg: g === 'mahjong' && q.get('rule') ? { rule: q.get('rule')! } : DEFAULTS[g] }) }
    },
    onStatus: setStatus,
    onTalk: (m: TalkLine) => setTalk((l) => [...l.filter((x) => x.n !== m.n), m].slice(-60)),
    onTalkLog: (ms: TalkLine[]) => setTalk(ms),
    onGo: (g: Parameters<typeof gameUrl>[1]) => { location.href = gameUrl(roomRef.current!, g) },
    onError: (m: string) => {
      if (m === 'code_taken' && retry.current) { retry.current(); return }
      if (m === 'room_not_found' && !q.get('create')) { location.href = `/mahjong?room=${roomRef.current}`; return } // not a room: maybe a direct game table, whose page finds the right game
      setError(m)
      if (m === 'room_not_found' || m === 'code_taken') { conn.current?.close(); conn.current = null; setRoom(null); setView(null); history.replaceState(null, '', location.pathname) }
      setTimeout(() => setError((e) => (e === m ? '' : e)), 5000)
    },
  }), [q])

  const open = useCallback((rm: string, create = false) => {
    conn.current?.close(); roomRef.current = rm; setRoom(rm); setView(null); setTalk([])
    history.replaceState(null, '', `${location.pathname}?room=${rm}`)
    conn.current = connectRoom(rm, getClientId(), (name.trim() || me?.name || 'Player').slice(0, 16), handlers, create)
  }, [name, me?.name, handlers])
  const create = () => {
    writeName(name); let n = 0
    const go = async () => {
      retry.current = n++ < 8 ? () => { void go() } : null
      let code = newCode()
      // skip codes a game table already uses (a room and a table on the same digits would send people into the wrong game)
      for (let i = 0; i < 6; i++) { try { const r = await api<{ free: boolean }>('/code/' + code); if (r.free) break } catch { break } code = newCode() }
      open(code, true)
    }
    void go()
  }
  const join = (c: string) => { retry.current = null; writeName(name); open(c.trim()) }
  useEffect(() => { if (urlRoom && !conn.current) join(urlRoom); else if (q.get('create') === '1' && !urlRoom && !conn.current) create() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => conn.current?.close(), [])
  // signing in while in the room: reconnect so the room knows who you are
  const first = useRef(getToken()) // the token the connection was made with
  useEffect(() => { if (getToken() === first.current) return; first.current = getToken(); if (room && room !== 'practice') open(room) }, [me?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const leave = () => { conn.current?.close(); conn.current = null; setRoom(null); setView(null); location.href = '/' }
  const send = (m: unknown) => conn.current?.send(m)

  if (!room) {
    return (
      <div className="kg hd">
        <div className="kg-wrap">
          <Bar />
          <h1>{t('rmTitle')}</h1>
          <p className="kg-lead">{t('rmTagline')}</p>
          {error && <p className="acerr" role="alert">{t(error)}</p>}
          <div className="hdform rmentry">
            <button className="hdbtn primary rmbig" onClick={create}>{t('rmCreateBtn')}</button>
            <p className="kg-note rmsep">{t('rmJoin')}</p>
            <form onSubmit={(e) => { e.preventDefault(); if (/^\d{4}$/.test(code)) join(code) }} className="hdrow">
              <input inputMode="numeric" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="1234" aria-label={t('hdCode')} />
              <button className="hdbtn primary" disabled={!/^\d{4}$/.test(code)}>{t('hdJoinBtn')}</button>
            </form>
          </div>
        </div>
      </div>
    )
  }
  if (!view) return <div className="kg hd"><div className="kg-wrap"><Bar /><p className="kg-lead hdstatus">{status === 'closed' ? t('rmLost') : t('rmConnecting')}</p>{error && <p className="acerr">{t(error)}</p>}</div></div>

  const link = `${location.origin}/room?room=${room}`
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ } }
  const meNow = view.members.find((m) => m.me)
  const gameName = (g: RoomGame) => t(GAMES.find((x) => x.id === g)!.name)
  const setCfg = (patch: RoomCfg) => view.game && send({ t: 'pick', game: view.game, cfg: { ...view.cfg, ...patch } })
  const goNow = (role: 'play' | 'watch') => { writeName(name || me?.name || ''); location.href = gameUrl(room, { game: view.game!, cfg: view.cfg, role }) }

  return (
    <div className="kg hd rm">
      <div className="kg-wrap hdwrap">
        <Bar />
        <TableHeader title={`${t('rmName')} ${room}`} sub={`${view.members.length} ${t('rmPeople').toLowerCase()}`} copied={copied} onCopy={copy} onLeave={leave} leaveLabel={t('rmLeave')} status={status} />
        {error && <p className="acerr hdbanner" role="alert">{t(error)}</p>}
        <div className="kg-cols rmcols">
          <section>
            <h2>{t('rmPeople')}</h2>
            <ul className="rmpeople">
              {view.members.map((m, i) => (
                <li key={i} className={m.me ? 'me' : ''}>
                  <span className="rmname">{m.name}{m.me && <span className="muted"> · {t('rmYou')}</span>}</span>
                  {m.host && <span className="rmtag">{t('rmHost')}</span>}
                  <span className={'rmtag' + (m.watching ? '' : ' on')}>{m.watching ? t('rmWatching') : t('rmPlaying')}</span>
                </li>
              ))}
            </ul>
            {!meNow?.signedIn && <label className="rmrename">{t('hdNick')}<input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} onBlur={() => { if (name.trim().length >= 2) { writeName(name.trim()); send({ t: 'rename', name: name.trim() }) } }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} /></label>}
            <div className="hdseg rmmode">
              <button className={!meNow?.watching ? 'on' : ''} onClick={() => send({ t: 'mode', watching: false })}>{t('rmIPlay')}</button>
              <button className={meNow?.watching ? 'on' : ''} onClick={() => send({ t: 'mode', watching: true })}>{t('rmIWatch')}</button>
            </div>
          </section>
          <section>
            {view.host ? (
              <>
                <h2>{t('rmChoose')}</h2>
                <div className="rmgames" role="group">
                  {GAMES.map((g) => (
                    <button key={g.id} className={'rmgame' + (view.game === g.id ? ' on' : '')} onClick={() => send({ t: 'pick', game: g.id, cfg: view.game === g.id ? view.cfg : DEFAULTS[g.id] })}>{t(g.name)}</button>
                  ))}
                </div>
                {view.game && <Rules game={view.game} cfg={view.cfg} set={setCfg} signedIn={!!meNow?.signedIn} />}
                <div className="rmstart">
                  <button className="hdbtn primary" disabled={!view.game} onClick={() => send({ t: 'launch' })}>{view.game ? t('rmStart', { game: gameName(view.game) }) : t('rmPickFirst')}</button>
                </div>
              </>
            ) : (
              <>
                <h2>{t('rmChoose')}</h2>
                {view.game ? (
                  <>
                    <p className="rmpicked"><b>{gameName(view.game)}</b></p>
                    <Summary game={view.game} cfg={view.cfg} />
                  </>
                ) : <p className="kg-note">{t('rmNoGame')}</p>}
              </>
            )}
            {view.game && view.game !== 'mahjong' && <HowTo title={HOW[view.game].title} lines={HOW[view.game].lines} />}
            {view.launched && view.game && (
              <div className="rmrunning">
                <p className="kg-note">{t('rmRunning')}</p>
                <div className="hdrow"><button className="hdbtn primary" onClick={() => goNow('play')}>{t('rmJoinGame')}</button><button className="hdbtn" onClick={() => goNow('watch')}>{t('rmWatchGame')}</button></div>
              </div>
            )}
          </section>
        </div>
        <TalkBox lines={talk} say={(x) => conn.current?.say(x)} />
      </div>
    </div>
  )
}

function Summary({ game, cfg }: { game: RoomGame; cfg: RoomCfg }) {
  const { t } = useLang()
  const mode = (c: boolean) => (c ? t('rmCasual') : t('rmCash'))
  const parts = game === 'mahjong' ? [t(`${cfg.rule}.name`), cfg.ranked ? t('rmRanked') : t('rmCasual')]
    : game === 'holdem' ? [`${cfg.sb}/${cfg.bb}`, mode(cfg.casual !== false)]
      : game === 'blackjack' ? [`${t('rmMinBet')} ${cfg.bb}`, mode(cfg.casual !== false)]
        : [cfg.ranked ? t('rmRanked') : t('rmCasual')]
  return <p className="kg-note">{parts.join(' · ')}</p>
}

/** The host's rules for the chosen game, the same choices each game's own menu used to offer. */
function Rules({ game, cfg, set, signedIn }: { game: RoomGame; cfg: RoomCfg; set(p: RoomCfg): void; signedIn: boolean }) {
  const { t } = useLang()
  const modeSeg = () => (
    <div className="hdseg"><button className={!cfg.ranked ? 'on' : ''} onClick={() => set({ ranked: false })}>{t('rmCasual')}</button><button className={cfg.ranked ? 'on' : ''} disabled={!signedIn} onClick={() => set({ ranked: true })}>{t('rmRanked')}</button></div>
  )
  const cashSeg = (
    <div className="hdseg"><button className={cfg.casual !== false ? 'on' : ''} onClick={() => set({ casual: true })}>{t('rmCasual')}</button><button className={cfg.casual === false ? 'on' : ''} onClick={() => set({ casual: false })}>{t('rmCash')}</button></div>
  )
  return (
    <div className="hdform rmrules">
      <h3>{t('rmRules')}</h3>
      {game === 'mahjong' && <label>{t('rmRuleset')}<select value={String(cfg.rule)} onChange={(e) => set({ rule: e.target.value })}>{RULESETS.map((r) => <option key={r} value={r}>{t(`${r}.name`)}</option>)}</select></label>}
      {game === 'holdem' && <label>{t('rmBlinds')}<select value={`${cfg.sb}/${cfg.bb}`} onChange={(e) => { const [sb, bb] = e.target.value.split('/').map(Number); set({ sb, bb }) }}>{BLINDS.map(([sb, bb]) => <option key={sb} value={`${sb}/${bb}`}>{sb}/{bb}</option>)}</select></label>}
      {game === 'blackjack' && <label>{t('rmMinBet')}<select value={Number(cfg.bb)} onChange={(e) => set({ bb: Number(e.target.value) })}>{MIN_BETS.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>}
      {(game === 'mahjong' || game === 'bigtwo') ? modeSeg() : cashSeg}
      {(game === 'mahjong' || game === 'bigtwo') && !signedIn && <p className="kg-note">{t('acRankedLocked')}</p>}
    </div>
  )
}
