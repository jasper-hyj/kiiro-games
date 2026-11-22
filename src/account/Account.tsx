import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLang } from '../i18n'
import { accountsAvailable, api, ApiError, getToken, setToken, type Me } from './api'
import './strings'
import './account.css'

interface Ctx { me: Me | null; ready: boolean; available: boolean; refresh(): Promise<void>; signOut(): Promise<void>; openSignIn(): void }
const C = createContext<Ctx>({ me: null, ready: true, available: false, refresh: async () => {}, signOut: async () => {}, openSignIn: () => {} })
export const useAccount = () => useContext(C)

export function AccountProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [ready, setReady] = useState(!accountsAvailable || !getToken())
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const { t } = useLang()

  const refresh = useCallback(async () => {
    if (!accountsAvailable || !getToken()) { setMe(null); setReady(true); return }
    try { setMe(await api<Me>('/me')) } catch (e) { if (e instanceof ApiError && e.status === 401) { setToken(null); setMe(null) } }
    setReady(true)
  }, [])

  useEffect(() => {
    // a sign-in link from the email arrives as /?signin=TOKEN: trade it for a session, then clean the address bar
    const q = new URLSearchParams(location.search)
    const link = q.get('signin')
    if (link && accountsAvailable) {
      history.replaceState(null, '', location.pathname)
      api<{ token: string }>('/auth/verify', { token: link }).then((r) => { setToken(r.token); return refresh() }).catch((e) => { setNote(t(e instanceof ApiError ? e.code : 'invalid')); setReady(true) })
    } else void refresh()
  }, [refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = useCallback(async () => { try { await api('/auth/logout', {}) } catch { /* the token is dropped locally either way */ } setToken(null); setMe(null) }, [])
  return (
    <C.Provider value={{ me, ready, available: accountsAvailable, refresh, signOut, openSignIn: () => setOpen(true) }}>
      {children}
      {note && <div className="acnote" role="status" onClick={() => setNote('')}>{note}</div>}
      {open && <SignIn onClose={() => setOpen(false)} onDone={async () => { setOpen(false); await refresh() }} />}
    </C.Provider>
  )
}

declare global { interface Window { google?: any } }
let gsiLoading: Promise<void> | null = null
function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  return gsiLoading ??= new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true
    s.onload = () => res(); s.onerror = () => rej(new Error('gsi')); document.head.appendChild(s)
  })
}

function SignIn({ onClose, onDone }: { onClose(): void; onDone(): void }) {
  const { t } = useLang()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(false)
  const [dev, setDev] = useState('')
  const gbtn = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let dead = false
    api<{ google: string | null }>('/config').then(async (c) => {
      if (!c.google || dead) return
      await loadGsi()
      if (dead || !gbtn.current) return
      window.google.accounts.id.initialize({
        client_id: c.google,
        callback: async (r: { credential: string }) => {
          try { const out = await api<{ token: string }>('/auth/google', { credential: r.credential }); setToken(out.token); onDone() } catch (e) { setMsg(t(e instanceof ApiError ? e.code : 'invalid')) }
        },
      })
      window.google.accounts.id.renderButton(gbtn.current, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: 280 })
    }).catch(() => { /* Google is optional; email still works */ })
    return () => { dead = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    setBusy(true); setMsg('')
    try { const r = await api<{ devLink?: string }>('/auth/email', { email }); setSent(true); setDev(r.devLink || '') } catch (e) { setMsg(t(e instanceof ApiError ? e.code : 'offline')) }
    setBusy(false)
  }
  return (
    <div className="acmodal" onClick={onClose}>
      <div className="acbox" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2>{t('acSignIn')}</h2>
        <p className="muted small">{t('acWhy')}</p>
        <div ref={gbtn} className="gbtn" />
        <p className="muted small acor">{t('acOr')}</p>
        {sent ? (
          <p className="acok">{t('acSent')}{dev && <> <a href={dev}>{t('acDevLink')}</a></>}</p>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void send() }} className="acform">
            <input type="email" inputMode="email" autoComplete="email" placeholder={t('acEmail')} value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button className="primary" disabled={busy || !email}>{t('acSend')}</button>
          </form>
        )}
        {msg && <p className="acerr" role="alert">{msg}</p>}
        <p className="muted small">{t('acNoChips')}</p>
        <button className="ghost" onClick={onClose}>{t('acGuest')}</button>
      </div>
    </div>
  )
}

export const fmt = (n: number) => (n > 0 ? '+' : '') + n.toLocaleString()
