import { useEffect, useState } from 'react'
import { useLang } from '../i18n'
import { api, ApiError, type BoardRow } from './api'
import { fmt, useAccount } from './Account'

export function Leaderboard() {
  const { t } = useLang()
  const { me } = useAccount()
  const [rows, setRows] = useState<BoardRow[] | null>(null)
  const [season, setSeason] = useState('')
  useEffect(() => { api<{ season: string; rows: BoardRow[] }>('/leaderboard').then((r) => { setRows(r.rows); setSeason(r.season) }).catch(() => setRows([])) }, [me?.id, me?.profit])
  if (rows === null) return null
  return (
    <section>
      <h2>{t('acBoard')} <span>{t('acSeason', { s: season })}</span></h2>
      {rows.length === 0 ? <p className="kg-empty">{t('acEmpty')}</p> : (
        <table className="kgt">
          <thead><tr><th>{t('acRank')}</th><th>{t('acPlayer')}</th><th>{t('acLevel')}</th><th>{t('acProfit')}</th></tr></thead>
          <tbody>{rows.slice(0, 20).map((r) => (
            <tr key={r.rank} className={r.me ? 'me' : ''}><td>{r.rank}</td><td>{r.name}{r.me ? ` (${t('acYou')})` : ''}</td><td>{r.level}</td><td className={r.profit >= 0 ? 'kg-up' : 'kg-down'}>{fmt(r.profit)}</td></tr>
          ))}</tbody>
        </table>
      )}
      <p className="kg-note">{t('acBoardNote')}</p>
    </section>
  )
}

interface Hist { id: string; game: string; rule: string; ranked: number; at: number; place: number; points: number; chips: number }

export function Profile({ onClose }: { onClose(): void }) {
  const { t } = useLang()
  const { me, signOut, refresh } = useAccount()
  const [hist, setHist] = useState<Hist[] | null>(null)
  const [name, setName] = useState(me?.name ?? '')
  const [err, setErr] = useState('')
  useEffect(() => { api<{ matches: Hist[] }>('/me/matches').then((r) => setHist(r.matches)).catch(() => setHist([])) }, [])
  if (!me) return null
  const save = async () => { setErr(''); try { await api('/me/name', { name }); await refresh() } catch (e) { setErr(t(e instanceof ApiError ? e.code : 'offline')) } }
  return (
    <div className="acmodal" onClick={onClose}>
      <div className="acbox wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2>{me.name}</h2>
        <div className="acstats">
          <div><b>{me.balance.toLocaleString()}</b><span>{t('acChips')}</span></div>
          <div><b className={me.profit >= 0 ? 'kg-up' : 'kg-down'}>{fmt(me.profit)}</b><span>{t('acProfit')}</span></div>
          <div><b>{me.level}</b><span>{t('acLevel')}</span></div>
          <div><b>{me.games}</b><span>{t('acGames')}</span></div>
        </div>
        <form className="acform" onSubmit={(e) => { e.preventDefault(); void save() }}>
          <input aria-label={t('acRename')} value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
          <button className="primary" disabled={!name || name === me.name}>{t('acSave')}</button>
        </form>
        {err && <p className="acerr" role="alert">{err}</p>}
        {me.username && <PasswordForm />}
        <h3>{t('acHistory')}</h3>
        {hist === null ? null : hist.length === 0 ? <p className="muted small">{t('acNoHistory')}</p> : (
          <ul className="achist">{hist.map((h) => (
            <li key={h.id}><span>{new Date(h.at).toLocaleDateString()}</span><span>{h.rule}</span><span>{h.ranked ? t('acRanked') : t('acCasual')}</span><span>{t('acPlace', { n: h.place })}</span>
              <span className={h.chips >= 0 ? 'kg-up' : 'kg-down'}>{h.ranked ? fmt(h.chips) : ''}</span></li>
          ))}</ul>
        )}
        <div className="acrow">
          {me.admin && <a className="ghost" href="/admin">{t('acAdmin')}</a>}
          <button className="ghost" onClick={() => { void signOut(); onClose() }}>{t('acSignOut')}</button>
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
        ? <button className="kg-acct" onClick={() => setOpen(true)}>{me.name}<small>{me.balance.toLocaleString()}</small></button>
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
      try { await api('/me/password', { current: cur, next }); setDone(true); setCur(''); setNext('') } catch (x) { setMsg(t(x instanceof ApiError ? x.code : 'offline')) }
    }}>
      <input type="password" autoComplete="current-password" placeholder={t('acCurrentPw')} aria-label={t('acCurrentPw')} maxLength={72} value={cur} onChange={(e) => setCur(e.target.value)} />
      <input type="password" autoComplete="new-password" placeholder={t('acNewPw')} aria-label={t('acNewPw')} maxLength={72} value={next} onChange={(e) => setNext(e.target.value)} />
      <button className="primary" disabled={!cur || next.length < 8}>{t('acSave')}</button>
      {done && <p className="acok">{t('acPwChanged')}</p>}
      {msg && <p className="acerr" role="alert">{msg}</p>}
    </form>
  )
}
