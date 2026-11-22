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

  const refresh = useCallback(async () => {
    if (!accountsAvailable || !getToken()) { setMe(null); setReady(true); return }
    try { setMe(await api<Me>('/me')) } catch (e) { if (e instanceof ApiError && e.status === 401) { setToken(null); setMe(null) } }
    setReady(true)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const signOut = useCallback(async () => { try { await api('/auth/logout', {}) } catch { /* the token is dropped locally either way */ } setToken(null); setMe(null) }, [])
  return (
    <C.Provider value={{ me, ready, available: accountsAvailable, refresh, signOut, openSignIn: () => setOpen(true) }}>
      {children}
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
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [user, setUser] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const gbtn = useRef<HTMLDivElement>(null)
  const [hasGoogle, setHasGoogle] = useState(false)

  useEffect(() => {
    let dead = false
    api<{ google: string | null }>('/config').then(async (c) => {
      if (!c.google || dead) return
      setHasGoogle(true)
      await loadGsi()
      if (dead || !gbtn.current) return
      window.google.accounts.id.initialize({
        client_id: c.google,
        callback: async (r: { credential: string }) => {
          try { const out = await api<{ token: string }>('/auth/google', { credential: r.credential }); setToken(out.token); onDone() } catch (e) { setMsg(t(e instanceof ApiError ? e.code : 'invalid')) }
        },
      })
      window.google.accounts.id.renderButton(gbtn.current, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: 280 })
    }).catch(() => { /* Google is optional */ })
    return () => { dead = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setBusy(true); setMsg('')
    try {
      const out = await api<{ token: string }>(mode === 'login' ? '/auth/login' : '/auth/register', { username: user, password: pw })
      setToken(out.token); onDone()
    } catch (e) { setMsg(t(e instanceof ApiError ? e.code : 'offline')) }
    setBusy(false)
  }
  const ready = /^[A-Za-z0-9_]{3,20}$/.test(user.trim()) && pw.length >= (mode === 'register' ? 8 : 1)
  return (
    <div className="acmodal" onClick={onClose}>
      <div className="acbox" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2>{mode === 'login' ? t('acSignIn') : t('acCreate')}</h2>
        <p className="muted small">{t('acWhy')}</p>
        <form onSubmit={(e) => { e.preventDefault(); if (ready) void submit() }} className="acstack">
          <input autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={t('acUsername')} aria-label={t('acUsername')} maxLength={20} value={user} onChange={(e) => setUser(e.target.value)} />
          <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={t('acPassword')} aria-label={t('acPassword')} maxLength={72} value={pw} onChange={(e) => setPw(e.target.value)} />
          {mode === 'register' && <p className="muted small">{t('acRules')}</p>}
          <button className="primary" disabled={busy || !ready}>{mode === 'login' ? t('acSignIn') : t('acCreate')}</button>
        </form>
        {msg && <p className="acerr" role="alert">{msg}</p>}
        <button className="ghost" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMsg('') }}>{mode === 'login' ? t('acToCreate') : t('acToLogin')}</button>
        {hasGoogle && <><p className="muted small acor">{t('acOr')}</p><div ref={gbtn} className="gbtn" /></>}
        <p className="muted small">{t('acNoChips')}</p>
        <button className="ghost" onClick={onClose}>{t('acGuest')}</button>
      </div>
    </div>
  )
}

export const fmt = (n: number) => (n > 0 ? '+' : '') + n.toLocaleString()
