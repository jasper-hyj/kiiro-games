import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useLang } from '../i18n'
import '../room/strings'

/* ------------------------------------------------------------------ avatars */
// warm, friendly colours (no green): amber, rose, lavender, sky, sand, coral
const AVATARS = ['#e8b66a', '#e79aa5', '#b9a4f0', '#8fb4ff', '#d9c39a', '#f0a07a']
const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
export const avatarColor = (name: string) => AVATARS[hash(name) % AVATARS.length]
const initial = (name: string) => (Array.from(name.trim())[0] ?? '?').toUpperCase()

/** A small round avatar with the person's initial. */
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return <span className="k-av" style={{ width: size, height: size, fontSize: size * 0.46, background: avatarColor(name) }} aria-hidden="true">{initial(name)}</span>
}

/* ------------------------------------------------------------------ input devices */
/** True on a screen that is used with a finger: hints about keys are only useful elsewhere. */
export const isTouchPrimary = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

/** A small keyboard hint on a button, only shown where there is a keyboard and a mouse. */
export function Kbd({ k }: { k: string }) { return <kbd className="k-kbd" aria-hidden="true">{k}</kbd> }

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
      if (e.repeat) { e.preventDefault(); return }
      e.preventDefault(); fn()
    }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, [enabled])
}

/** The same shortcuts as a component, for screens where a hook cannot be called (after an early return). */
export function Hotkeys({ keys, enabled = true }: { keys: Record<string, (() => void) | undefined>; enabled?: boolean }) { useHotkeys(keys, enabled); return null }

/* ------------------------------------------------------------------ table header */
/** The one header every table uses: back, room name, who is here, invite. */
export function TableHeader({ title, sub, watching, copied, onCopy, onLeave, leaveLabel, status, help }: {
  title: ReactNode; sub?: ReactNode; watching?: number; copied?: boolean; onCopy?: () => void; onLeave: () => void; leaveLabel: string; status?: 'connecting' | 'open' | 'closed'
  /** a how-to-play panel: its title key and the keys of its lines */
  help?: { title: string; lines: string[] }
}) {
  const { t } = useLang()
  const [helpOpen, setHelpOpen] = useState(false)
  return (
    <div className="k-head">
      <button className="k-back" onClick={onLeave} aria-label={leaveLabel} title={leaveLabel}><span aria-hidden="true">←</span><span className="k-backlabel">{leaveLabel}</span></button>
      <div className="k-title"><b>{title}</b>{sub && <span className="k-sub">{sub}</span>}</div>
      <div className="k-tools">
        {watching != null && watching > 0 && <span className="k-pill" title={t('rmWatching')}>👁 {watching}</span>}
        {status && status !== 'open' && <span className="k-pill warn">{status === 'closed' ? t('rmLost') : t('rmConnecting')}</span>}
        {help && <button className="k-ghost k-help" onClick={() => setHelpOpen(true)} aria-label={t(help.title)} title={t(help.title)}>?</button>}
        {onCopy && <button className="k-ghost" onClick={onCopy}>{copied ? t('rmCopied') : <><span className="k-long">{t('rmCopy')}</span><span className="k-short">{t('rmInvite')}</span></>}</button>}
      </div>
      {helpOpen && help && <HelpModal title={t(help.title)} lines={help.lines.map((k) => t(k))} onClose={() => setHelpOpen(false)} />}
    </div>
  )
}

/* ------------------------------------------------------------------ seat chip */
/** The one player badge: avatar, name, a line of detail (chips or points), and clear states. */
export function SeatChip({ name, sub, state = '', badge, className = '', style, children, title }: {
  name: string; sub?: ReactNode; state?: string; badge?: ReactNode; className?: string; style?: CSSProperties; children?: ReactNode; title?: string
}) {
  return (
    <div className={`k-seat ${state} ${className}`.trim()} style={style} title={title}>
      <Avatar name={name || '?'} size={26} />
      <div className="k-seatname">{badge}<span>{name}</span></div>
      {sub != null && <div className="k-seatsub">{sub}</div>}
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ result */
export interface ResultRow { name: string; value: ReactNode; tone?: 'up' | 'down' | 'flat'; me?: boolean; detail?: ReactNode }
/** The one end-of-round panel: who won, a row per player, what happens next. */
export function ResultPanel({ title, rows, columns, note, children }: { title: ReactNode; rows: ResultRow[]; columns?: [string, string]; note?: ReactNode; children?: ReactNode }) {
  return (
    <div className="k-result" role="status" aria-live="polite">
      <div className="k-resulttitle">{title}</div>
      <ul className="k-rows">
        {columns && <li className="k-rowhead"><span>{columns[0]}</span><span>{columns[1]}</span></li>}
        {rows.map((r, i) => (
          <li key={i} className={'k-row' + (r.me ? ' me' : '')}>
            <span className="k-rowname"><Avatar name={r.name} size={22} />{r.name}{r.detail != null && <span className="k-rowdetail">{r.detail}</span>}</span>
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
            <a className="hdbtn primary k-linkbtn" href={`/room?create=1&pick=${game}`}>{t('rmCreateBtn')}</a>
            <a className="hdbtn k-linkbtn" href="/">{t('acHome')}</a>
          </div>
        </div>
      </div>
    </div>
  )
}

/** A how-to-play panel over the table. Escape or a tap outside closes it. */
export function HelpModal({ title, lines, onClose }: { title: string; lines: string[]; onClose: () => void }) {
  const { t } = useLang()
  useEffect(() => { const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; addEventListener('keydown', on); return () => removeEventListener('keydown', on) }, [onClose])
  return (
    <div className="acmodal" onClick={onClose}>
      <div className="acbox" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <ul className="k-help">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        <button className="primary" onClick={onClose}>{t('acClose')}</button>
      </div>
    </div>
  )
}
