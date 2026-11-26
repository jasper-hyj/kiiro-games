import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useLang } from '../i18n'
import { newRoomUrl, type GameKey } from '../route'
import { AccountChip } from '../account/Panels'
import { SoundSwitch } from './SoundSwitch'
import '../room/strings'

/* ------------------------------------------------------------------ avatars */
// warm, friendly colours (no green): amber, rose, lavender, sky, sand, coral
const AVATARS = ['#e8b66a', '#e79aa5', '#b9a4f0', '#8fb4ff', '#d9c39a', '#f0a07a']
const hash = (s: string) => {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}
export const avatarColor = (name: string) => AVATARS[hash(name) % AVATARS.length]
const initial = (name: string) => (Array.from(name.trim())[0] ?? '?').toUpperCase()

/** A small round avatar with the person's initial. */
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span className="k-av" style={{ width: size, height: size, fontSize: size * 0.46, background: avatarColor(name) }} aria-hidden="true">
      {initial(name)}
    </span>
  )
}

/** Bots are named "Bot 1" by the game servers; show them in the player's language. */
export function useShownName() {
  const { t } = useLang()
  return (name: string) => {
    const m = /^Bot (\d+)$/.exec(name)
    return m ? `${t('kgBot')} ${m[1]}` : name
  }
}

/* ------------------------------------------------------------------ input devices */
/** True on a screen that is used with a finger: hints about keys are only useful elsewhere. */
export const isTouchPrimary = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

/** A small keyboard hint on a button, only shown where there is a keyboard and a mouse. */
export function Kbd({ k }: { k: string }) {
  return (
    <kbd className="k-kbd" aria-hidden="true">
      {k}
    </kbd>
  )
}

/**
 * Keyboard shortcuts for a table. `keys` maps a lower-case key ("f", "enter", "arrowup", " ") to what it does.
 * Typing in a field (chat, sliders, selects) never triggers a shortcut, and held-down keys do not repeat actions.
 */
export function useHotkeys(keys: Record<string, (() => void) | undefined>, enabled = true) {
  const ref = useRef(keys)
  ref.current = keys
  useEffect(() => {
    if (!enabled) return
    const on = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return
      const el = document.activeElement as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && (el as HTMLInputElement).type !== 'range') return
      const fn = ref.current[e.key.toLowerCase()]
      if (!fn) return
      if (e.repeat) {
        e.preventDefault()
        return
      }
      e.preventDefault()
      fn()
    }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, [enabled])
}

/** The same shortcuts as a component, for screens where a hook cannot be called (after an early return). */
export function Hotkeys({ keys, enabled = true }: { keys: Record<string, (() => void) | undefined>; enabled?: boolean }) {
  useHotkeys(keys, enabled)
  return null
}

/* ------------------------------------------------------------------ table header */
/** The one header every table uses: back, room name, who is here, invite. */
export function TableHeader({
  title,
  sub,
  watching,
  copied,
  onCopy,
  onLeave,
  leaveLabel,
  status,
  help,
}: {
  title: ReactNode
  sub?: ReactNode
  watching?: number
  copied?: boolean
  onCopy?: () => void
  onLeave: () => void
  leaveLabel: string
  status?: 'connecting' | 'open' | 'closed'
  /** a how-to-play panel: its title key and the keys of its lines */
  help?: { title: string; lines: string[] }
}) {
  const { t } = useLang()
  const [helpOpen, setHelpOpen] = useState(false)
  return (
    <div className="k-head">
      <button className="k-back" onClick={onLeave} aria-label={leaveLabel} title={leaveLabel}>
        <span aria-hidden="true">←</span>
        <span className="k-backlabel">{leaveLabel}</span>
      </button>
      <div className="k-title">
        <b>{title}</b>
        {sub && <span className="k-sub">{sub}</span>}
      </div>
      <div className="k-tools">
        {watching != null && watching > 0 && (
          <span className="k-pill" title={t('rmWatching')}>
            👁 {watching}
          </span>
        )}
        {status && status !== 'open' && <span className="k-pill warn">{status === 'closed' ? t('rmLost') : t('rmConnecting')}</span>}
        <SoundSwitch />
        <span className="k-acctslot">
          <AccountChip />
        </span>
        {help && (
          <button className="k-ghost k-helpbtn" onClick={() => setHelpOpen(true)} aria-label={t(help.title)} title={t(help.title)}>
            ?
          </button>
        )}
        {onCopy && (
          <button className="k-ghost" onClick={onCopy}>
            {copied ? (
              t('rmCopied')
            ) : (
              <>
                <span className="k-long">{t('rmCopy')}</span>
                <span className="k-short">{t('rmInvite')}</span>
              </>
            )}
          </button>
        )}
      </div>
      {helpOpen && help && <HelpModal title={t(help.title)} lines={help.lines.map((k) => t(k))} onClose={() => setHelpOpen(false)} />}
    </div>
  )
}

/* ------------------------------------------------------------------ seat chip */
/** The one player badge: avatar, name, a line of detail (chips or points), and clear states. */
export function SeatChip({
  name,
  sub,
  state = '',
  badge,
  className = '',
  style,
  children,
  title,
}: {
  name: string
  sub?: ReactNode
  state?: string
  badge?: ReactNode
  className?: string
  style?: CSSProperties
  children?: ReactNode
  title?: string
}) {
  const shown = useShownName()(name)
  return (
    <div className={`k-seat ${state} ${className}`.trim()} style={style} title={title}>
      <Avatar name={shown || '?'} size={26} />
      <div className="k-seatname">
        {badge}
        <span>{shown}</span>
      </div>
      {sub != null && <div className="k-seatsub">{sub}</div>}
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ result */
export interface ResultRow {
  name: string
  value: ReactNode
  tone?: 'up' | 'down' | 'flat'
  me?: boolean
  detail?: ReactNode
}
/** The one end-of-round panel: who won, a row per player, what happens next. */
export function ResultPanel({
  title,
  rows,
  columns,
  note,
  children,
}: {
  title: ReactNode
  rows: ResultRow[]
  columns?: [string, string]
  note?: ReactNode
  children?: ReactNode
}) {
  const shown = useShownName()
  const box = useRef<HTMLDivElement>(null)
  // on a small screen the result may appear below the board: bring it into view
  useEffect(() => {
    const id = setTimeout(() => box.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 350)
    return () => clearTimeout(id)
  }, [])
  return (
    <div ref={box} className="k-result" role="status" aria-live="polite">
      <div className="k-resulttitle">{title}</div>
      <ul className="k-rows">
        {columns && (
          <li className="k-rowhead">
            <span>{columns[0]}</span>
            <span>{columns[1]}</span>
          </li>
        )}
        {rows.map((r, i) => (
          <li key={i} className={'k-row' + (r.me ? ' me' : '')}>
            <span className="k-rowname">
              <Avatar name={shown(r.name)} size={22} />
              {shown(r.name)}
              {r.detail != null && <span className="k-rowdetail">{r.detail}</span>}
            </span>
            <span className={'k-rowval ' + (r.tone ?? 'flat')}>{r.value}</span>
          </li>
        ))}
      </ul>
      {note && <div className="k-resultnote">{note}</div>}
      {children && <div className="k-resultactions">{children}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ no table */
/** What a game page shows when there is no table to open: say why, and offer the one way in (a room). */
export function NoRoom({ game, error }: { game: string; error?: string }) {
  const { t } = useLang()
  return (
    <div className="kg hd">
      <div className="kg-wrap">
        <div className="k-empty">
          <h1>{t('rmNoTableTitle')}</h1>
          <p className="kg-lead">{error ? t(error) : t('rmNoTableBody')}</p>
          <div className="hdrow">
            <a className="hdbtn primary k-linkbtn" href={newRoomUrl(game as GameKey)}>
              {t('rmCreateBtn')}
            </a>
            <a className="hdbtn k-linkbtn" href="/">
              {t('acHome')}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

/** A how-to-play panel over the table. Escape or a tap outside closes it. */
export function HelpModal({ title, lines, onClose }: { title: string; lines: string[]; onClose: () => void }) {
  const { t } = useLang()
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, [onClose])
  return (
    <div className="acmodal" onClick={onClose}>
      <div className="acbox" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <ul className="k-help">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        <button className="primary" onClick={onClose}>
          {t('acClose')}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ out of chips */
/** Casual tables top a broken stack up for free: say so, so the new chips are not a surprise. */
export function RefillNotice({ stack, casual, minStack }: { stack: number | undefined; casual: boolean; minStack: number }) {
  const { t } = useLang()
  const prev = useRef<number | undefined>(undefined)
  const [show, setShow] = useState(false)
  useEffect(() => {
    const before = prev.current
    prev.current = stack
    if (casual && before !== undefined && stack !== undefined && before < minStack && stack > before) {
      setShow(true)
      const id = setTimeout(() => setShow(false), 6000)
      return () => clearTimeout(id)
    }
  }, [stack]) // eslint-disable-line react-hooks/exhaustive-deps
  return show ? (
    <div className="k-notice" role="status">
      {t('kgRefilled', { n: (stack ?? 0).toLocaleString() })}
    </div>
  ) : null
}

/** A ranked table with no chips left in front of you: buy back in from your account, or leave. Says plainly when the account is empty too. */
export function OutOfChips({
  balance,
  min,
  max,
  step,
  onBuy,
  onLeave,
}: {
  balance: number
  min: number
  max: number
  step: number
  onBuy(n: number): void
  onLeave(): void
}) {
  const { t } = useLang()
  const cap = Math.min(max, balance)
  const can = cap >= min
  const [n, setN] = useState(Math.min(cap, min * 20))
  useEffect(() => {
    setN((x) => Math.min(cap, Math.max(min, x)))
  }, [cap, min])
  return (
    <div className="k-bust" role="status">
      <b>{t('kgBustTitle')}</b>
      {can ? (
        <>
          <p>{t('kgBustBody', { n: balance.toLocaleString() })}</p>
          <label className="hdbuy">
            <input
              type="range"
              min={min}
              max={cap}
              step={Math.min(step, cap)}
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              aria-label={t('kgBustBuy', { n: n.toLocaleString() })}
            />
          </label>
          <div className="hdactions">
            <button className="hdbtn" onClick={onLeave}>
              {t('kgBustLeave')}
            </button>
            <button className="hdbtn primary" onClick={() => onBuy(n)}>
              {t('kgBustBuy', { n: n.toLocaleString() })}
            </button>
          </div>
        </>
      ) : (
        <>
          <p>{t('kgBustNone')}</p>
          <div className="hdactions">
            <button className="hdbtn primary" onClick={onLeave}>
              {t('kgBustLeave')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** The room code as four boxes, like a one-time-code field: type or paste digits, focus moves along, and the fourth digit submits. */
export function CodeBoxes({ id, label, onDone, autoFocus }: { id?: string; label: string; onDone: (code: string) => void; autoFocus?: boolean }) {
  const [d, setD] = useState(['', '', '', ''])
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const set = (next: string[]) => {
    setD(next)
    const code = next.join('')
    if (/^\d{4}$/.test(code)) onDone(code)
  }
  const fill = (from: number, digits: string) => {
    const next = d.slice()
    let i = from
    for (const ch of digits.slice(0, 4 - from)) next[i++] = ch
    set(next)
    refs.current[Math.min(i, 3)]?.focus()
  }
  return (
    <div className="k-code" role="group" aria-label={label}>
      {d.map((v, i) => (
        <input
          key={i}
          id={i === 0 ? id : undefined}
          ref={(el) => {
            refs.current[i] = el
          }}
          className="k-codebox"
          value={v}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && i === 0}
          aria-label={`${label} ${i + 1}`}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '')
            if (digits) fill(i, digits)
            else {
              const n = d.slice()
              n[i] = ''
              setD(n)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d[i] && i > 0) {
              const n = d.slice()
              n[i - 1] = ''
              setD(n)
              refs.current[i - 1]?.focus()
              e.preventDefault()
            } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
            else if (e.key === 'ArrowRight' && i < 3) refs.current[i + 1]?.focus()
          }}
          onPaste={(e) => {
            const digits = e.clipboardData.getData('text').replace(/\D/g, '')
            if (digits) {
              e.preventDefault()
              fill(0, digits)
            }
          }}
          onPointerDown={(e) => {
            const at = d.findIndex((x) => !x)
            const to = at < 0 ? 0 : at
            if (to !== i) {
              e.preventDefault()
              refs.current[to]?.focus()
            }
          }}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  )
}

/** The waiting screen: three cards bobbing on a little felt strip, and a line that says more the longer it takes. */
export function Connecting({ status }: { status: 'connecting' | 'open' | 'closed' }) {
  const { t } = useLang()
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const lost = status === 'closed'
  const line = lost ? t('rmLost') : secs < 4 ? t('kgConn1') : secs < 12 ? t('kgConn2') : t('kgConn3')
  return (
    <div className="k-conn" role="status" aria-live="polite">
      <div className={'k-connfelt' + (lost ? ' lost' : '')} aria-hidden>
        <i className="k-conncard a" />
        <i className="k-conncard b" />
        <i className="k-conncard c" />
      </div>
      <p className="k-connline">{line}</p>
      {secs >= 12 && !lost && <p className="k-connsub">{t('kgConnSub')}</p>}
    </div>
  )
}
