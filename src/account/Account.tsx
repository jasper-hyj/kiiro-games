import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { LangSwitch } from '../ui/LangSwitch'
import { useLang } from '../i18n'
import { accountsAvailable, api, ApiError, getToken, setToken, type Me } from './api'
import './strings'
import './account.css'

interface Ctx {
  me: Me | null
  ready: boolean
  available: boolean
  refresh(): Promise<void>
  signOut(): Promise<void>
  openSignIn(): void
}
const C = createContext<Ctx>({ me: null, ready: true, available: false, refresh: async () => {}, signOut: async () => {}, openSignIn: () => {} })
export const useAccount = () => useContext(C)

/** Where to return after a sign-in that was asked for with ?signin=1&next=/somewhere (only paths on this site). */
function safeNext(): string | null {
  try {
    const n = new URLSearchParams(location.search).get('next')
    return n && n.startsWith('/') && !n.startsWith('//') ? n : null
  } catch {
    return null
  }
}
function dropSigninParams() {
  try {
    const u = new URL(location.href)
    if (u.searchParams.has('signin')) {
      u.searchParams.delete('signin')
      u.searchParams.delete('next')
      history.replaceState(null, '', u.pathname + u.search)
    }
  } catch {
    /* ignore */
  }
}
function goBack() {
  const n = safeNext()
  if (n) location.replace(n)
  else dropSigninParams()
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [ready, setReady] = useState(!accountsAvailable || !getToken())
  // an address like /?signin=1&next=/room/1234 opens the sign-in dialog, and afterwards returns to the page the person came from
  const [open, setOpen] = useState(() => {
    try {
      return new URLSearchParams(location.search).get('signin') === '1'
    } catch {
      return false
    }
  })

  const refresh = useCallback(async () => {
    if (!accountsAvailable || !getToken()) {
      setMe(null)
      setReady(true)
      return
    }
    try {
      setMe(await api<Me>('/me'))
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setToken(null)
        setMe(null)
      }
    }
    setReady(true)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signOut = useCallback(async () => {
    try {
      await api('/auth/logout', {})
    } catch {
      /* the token is dropped locally either way */
    }
    setToken(null)
    setMe(null)
  }, [])
  return (
    <C.Provider value={{ me, ready, available: accountsAvailable, refresh, signOut, openSignIn: () => setOpen(true) }}>
      {children}
      {open && (
        <SignIn
          onClose={() => {
            setOpen(false)
            dropSigninParams()
          }}
          onDone={async () => {
            setOpen(false)
            await refresh()
            goBack()
          }}
        />
      )}
    </C.Provider>
  )
}

/** Escape closes a dialog. */
export function useEscape(onClose: () => void) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, [onClose])
}

/** A password field with a show/hide toggle and a Caps Lock warning. */
export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus,
}: {
  value: string
  onChange(v: string): void
  placeholder: string
  autoComplete: string
  autoFocus?: boolean
}) {
  const { t } = useLang()
  const [show, setShow] = useState(false)
  const [caps, setCaps] = useState(false)
  return (
    <div className="acpw">
      <div className="acpwbox">
        <input
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={72}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={(e) => setCaps(e.getModifierState?.('CapsLock') ?? false)}
          onBlur={() => setCaps(false)}
        />
        <button type="button" className="acshow" onClick={() => setShow(!show)} aria-pressed={show}>
          {show ? t('acHide') : t('acShow')}
        </button>
      </div>
      {caps && (
        <span className="acwarn" role="status">
          {t('acCaps')}
        </span>
      )}
    </div>
  )
}

declare global {
  interface Window {
    google?: any
  }
}
let gsiLoading: Promise<void> | null = null
function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  return (gsiLoading ??= new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => res()
    s.onerror = () => rej(new Error('gsi'))
    document.head.appendChild(s)
  }))
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
    api<{ google: string | null }>('/config')
      .then(async (c) => {
        if (!c.google || dead) return
        setHasGoogle(true)
        await loadGsi()
        if (dead || !gbtn.current) return
        window.google.accounts.id.initialize({
          client_id: c.google,
          callback: async (r: { credential: string }) => {
            try {
              const out = await api<{ token: string }>('/auth/google', { credential: r.credential })
              setToken(out.token)
              onDone()
            } catch (e) {
              setMsg(t(e instanceof ApiError ? e.code : 'invalid'))
            }
          },
        })
        window.google.accounts.id.renderButton(gbtn.current, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: 280 })
      })
      .catch(() => {
        /* Google is optional */
      })
    return () => {
      dead = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setBusy(true)
    setMsg('')
    try {
      const out = await api<{ token: string }>(mode === 'login' ? '/auth/login' : '/auth/register', { username: user, password: pw })
      setToken(out.token)
      onDone()
    } catch (e) {
      setMsg(t(e instanceof ApiError ? e.code : 'offline'))
    }
    setBusy(false)
  }
  useEscape(onClose)
  const u = user.trim()
  const userBad = u.length > 0 && !/^[A-Za-z0-9_.-]{3,20}$/.test(u)
  const pwShort = mode === 'register' && pw.length > 0 && pw.length < 8
  const ready = u.length > 0 && pw.length > 0 // the server explains what is wrong; a silently disabled button looked like a bug
  const switchTo = (m: 'login' | 'register') => {
    setMode(m)
    setMsg('')
  }
  return (
    <div className="acmodal" onClick={onClose}>
      <div className="acbox" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('acSignIn')}>
        <div className="actabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => switchTo('login')}>
            {t('acSignIn')}
          </button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => switchTo('register')}>
            {t('acCreate')}
          </button>
        </div>
        <p className="muted small">{mode === 'login' ? t('acWelcomeBack') : t('acWhy')}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (ready && !busy) void submit()
          }}
          className="acstack"
        >
          <div className="acfield">
            <input
              autoFocus
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={t('acUsername')}
              aria-label={t('acUsername')}
              aria-invalid={userBad && mode === 'register'}
              maxLength={20}
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
            {mode === 'register' && <span className={'achint' + (userBad ? ' bad' : '')}>{t('acUserHint')}</span>}
          </div>
          <div className="acfield">
            <PasswordInput value={pw} onChange={setPw} placeholder={t('acPassword')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            {mode === 'register' && <span className={'achint' + (pwShort ? ' bad' : '')}>{t('acPwHint')}</span>}
          </div>
          <button className="primary" disabled={busy || !ready}>
            {busy ? t('acWorking') : mode === 'login' ? t('acSignIn') : t('acCreate')}
          </button>
        </form>
        {msg && (
          <p className="acerr" role="alert">
            {msg}
          </p>
        )}
        {hasGoogle && (
          <>
            <p className="muted small acor">{t('acOr')}</p>
            <div ref={gbtn} className="gbtn" />
          </>
        )}
        <p className="muted small">{t('acNoChips')}</p>
        <LangSwitch />
        <button className="ghost" onClick={onClose}>
          {t('acGuest')}
        </button>
      </div>
    </div>
  )
}

export const fmt = (n: number) => (n > 0 ? '+' : '') + n.toLocaleString()
