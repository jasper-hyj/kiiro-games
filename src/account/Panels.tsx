import { useEffect, useState } from 'react'
import { useLang } from '../i18n'
import { api, ApiError, type BoardRow } from './api'
import { fmt, PasswordInput, useAccount, useEscape } from './Account'
import { Avatar } from '../ui/components'

const GAMES: [string, string][] = [['all', 'acAll'], ['mahjong', 'hubMahjong'], ['holdem', 'hubHoldem'], ['blackjack', 'bjName'], ['bigtwo', 'btName'], ['gomoku', 'gomoku'], ['crazyeights', 'crazyeights'], ['yahtzee', 'yahtzee'], ['liarsdice', 'liarsdice'], ['chess', 'chess'], ['xiangqi', 'xiangqi'], ['doudizhu', 'doudizhu']]

export function Leaderboard() {
  const { t } = useLang()
  const { me } = useAccount()
  const [game, setGame] = useState('all')
  const [rows, setRows] = useState<BoardRow[] | null>(null)
  const [season, setSeason] = useState('')
  const [minGames, setMinGames] = useState(3)
  useEffect(() => { api<{ season: string; rows: BoardRow[]; minGames?: number }>(`/leaderboard?game=${game}`).then((r) => { setRows(r.rows); setSeason(r.season); if (r.minGames) setMinGames(r.minGames) }).catch(() => setRows([])) }, [me?.id, me?.profit, game])
  if (rows === null) return null
  const overall = game === 'all'
  return (
    <section>
      <h2>{t('acBoard')} <span>{t('acSeason', { s: season })}</span></h2>
      <div className="acgames" role="tablist">{GAMES.map(([g, label]) => <button key={g} role="tab" aria-selected={game === g} className={game === g ? 'on' : ''} onClick={() => setGame(g)}>{t(label)}</button>)}</div>
      {rows.length === 0 ? <p className="kg-empty">{t('acEmpty', { n: minGames })}</p> : (
        <table className="kgt">
          <thead><tr><th>{t('acRank')}</th><th>{t('acPlayer')}</th><th>{t('acLevel')}</th><th>{overall ? t('acScore') : t('acProfit')}</th></tr></thead>
          <tbody>{rows.slice(0, 20).map((r) => {
            const v = overall ? (r.score ?? 0) : r.profit
            return <tr key={r.rank} className={r.me ? 'me' : ''}><td>{r.rank}</td><td>{r.name}{r.me ? ` (${t('acYou')})` : ''}</td><td>{r.level}</td><td className={v >= 0 ? 'kg-up' : 'kg-down'}>{overall ? (v > 0 ? '+' : '') + v.toFixed(1) : fmt(v)}</td></tr>
          })}</tbody>
        </table>
      )}
      <p className="kg-note">{overall ? t('acBoardNoteAll', { n: minGames }) : t('acBoardNote', { n: minGames })}</p>
    </section>
  )
}

interface Hist { id: string; game: string; rule: string; ranked: number; at: number; place: number; points: number; chips: number }

export function Profile({ onClose }: { onClose(): void }) {
  const { t } = useLang()
  const { me, signOut, refresh } = useAccount()
  const [hist, setHist] = useState<Hist[] | null>(null)
  const [name, setName] = useState(me?.name ?? '')
  const [err, setErr] = useState(''), [saved, setSaved] = useState(false), [confirmOut, setConfirmOut] = useState(false), [all, setAll] = useState(false)
  useEscape(onClose)
  useEffect(() => { api<{ matches: Hist[] }>('/me/matches').then((r) => setHist(r.matches)).catch(() => setHist([])) }, [])
  if (!me) return null
  const save = async () => { setErr(''); setSaved(false); try { await api('/me', { name }, 'PATCH'); await refresh(); setSaved(true) } catch (e) { setErr(t(e instanceof ApiError ? e.code : 'offline')) } }
  return (
    <div className="acmodal" onClick={onClose}>
      <div className="acbox wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="achead"><Avatar name={me.name} size={48} /><div><h2>{me.name}</h2>{me.username && <span className="muted small">@{me.username}</span>}</div></div>
        <div className="acstats">
          <div><b>{me.balance.toLocaleString()}</b><span>{t('acChips')}</span></div>
          <div><b className={me.profit >= 0 ? 'kg-up' : 'kg-down'}>{fmt(me.profit)}</b><span>{t('acProfit')}</span></div>
          <div><b>{me.level}</b><span>{t('acLevel')}</span></div>
          <div><b>{me.games}</b><span>{t('acGames')}</span></div>
        </div>
        <form className="acform" onSubmit={(e) => { e.preventDefault(); void save() }}>
          <input aria-label={t('acRename')} placeholder={t('acRename')} value={name} maxLength={16} onChange={(e) => { setName(e.target.value); setSaved(false) }} />
          <button className="primary" disabled={!name || name === me.name}>{t('acSave')}</button>
        </form>
        {err && <p className="acerr" role="alert">{err}</p>}
        {saved && <p className="acok" role="status">{t('acNameSaved')}</p>}
        {me.username && <PasswordForm />}
        <h3>{t('acHistory')}</h3>
        {hist === null ? null : hist.length === 0 ? <p className="muted small">{t('acNoHistory')}</p> : (
          <ul className="achist">{(all ? hist : hist.slice(0, 8)).map((h) => (
            <li key={h.id}><span>{new Date(h.at).toLocaleDateString()}</span><span>{h.rule}</span><span>{h.ranked ? t('acRanked') : t('acCasual')}</span><span>{t('acPlace', { n: h.place })}</span>
              <span className={h.chips >= 0 ? 'kg-up' : 'kg-down'}>{h.ranked ? fmt(h.chips) : ''}</span></li>
          ))}</ul>
        )}
        {hist && hist.length > 8 && !all && <button className="ghost" onClick={() => setAll(true)}>{t('acMore')}</button>}
        <div className="acrow">
          {me.admin && <a className="ghost" href="/admin">{t('acAdmin')}</a>}
          {confirmOut
            ? <><span className="muted small">{t('acConfirmOut')}</span><button className="ghost" onClick={() => setConfirmOut(false)}>{t('acCancel')}</button><button className="ghost danger" onClick={() => { void signOut(); onClose() }}>{t('acYesOut')}</button></>
            : <button className="ghost" onClick={() => setConfirmOut(true)}>{t('acSignOut')}</button>}
          <button className="primary" onClick={onClose}>{t('acClose')}</button>
        </div>
      </div>
    </div>
  )
}

/** The little "Sign in" / name + chips button shown on the hub and in the Mahjong menu. */
export function AccountChip() {
  const { t } = useLang()
  const { me, ready, available, openSignIn } = useAccount()
  const [open, setOpen] = useState(false)
  if (!available || !ready) return null
  return (
    <>
      {me
        ? <button className="kg-acct" onClick={() => setOpen(true)}><Avatar name={me.name} size={20} />{me.name}<small>{me.balance.toLocaleString()}</small></button>
        : <button className="kg-acct" onClick={openSignIn}>{t('acSignIn')}</button>}
      {open && <Profile onClose={() => setOpen(false)} />}
    </>
  )
}

/** Change password: the current one is required, and every other device is signed out. */
function PasswordForm() {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [cur, setCur] = useState(''), [next, setNext] = useState('')
  const [msg, setMsg] = useState(''), [done, setDone] = useState(false)
  if (!open) return <button className="ghost" onClick={() => setOpen(true)}>{t('acChangePw')}</button>
  return (
    <form className="acstack" onSubmit={async (e) => {
      e.preventDefault(); setMsg(''); setDone(false)
      try { await api('/me/password', { current: cur, next }, 'PUT'); setDone(true); setCur(''); setNext('') } catch (x) { setMsg(t(x instanceof ApiError ? x.code : 'offline')) }
    }}>
      <PasswordInput autoFocus value={cur} onChange={setCur} placeholder={t('acCurrentPw')} autoComplete="current-password" />
      <PasswordInput value={next} onChange={setNext} placeholder={t('acNewPw')} autoComplete="new-password" />
      <span className="achint">{t('acNewPwHint')}</span>
      <div className="acrow"><button type="button" className="ghost" onClick={() => setOpen(false)}>{t('acCancel')}</button><button className="primary" disabled={!cur || next.length < 8}>{t('acSave')}</button></div>
      {done && <p className="acok">{t('acPwChanged')}</p>}
      {msg && <p className="acerr" role="alert">{msg}</p>}
    </form>
  )
}
