import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../i18n'
import type { TalkMsg } from './cashClient'

// name colours: blues, silver, amber, rose, violet. No green anywhere on this site.
const HUES = ['#8fb4ff', '#f0a0ac', '#e7c27d', '#b9a4f0', '#7fd0e8', '#d8dee9']
const colourOf = (name: string) => {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return HUES[h % HUES.length]
}
const FADE_MS = 7000

/**
 * Table chat as a translucent overlay in the bottom-left corner, in the manner of an in-game chat:
 * the last few lines are always visible and dim when nothing new has arrived; Enter jumps to the input, Escape leaves it.
 * Clicks pass through the feed, so it never blocks the table.
 */
/** True on phones, tablets held upright and short windows, where a permanent chat block would sit on the game. */
function useSmall() {
  const q = '(max-width: 900px), (max-height: 760px)'
  const [c, setC] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches)
  useEffect(() => {
    const m = matchMedia(q)
    const on = () => setC(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return c
}

/** what the chat must not lie on: everything that can be tapped, and every piece of a game that has to be seen */
const KEEP_CLEAR =
  'button, a, input, select, .tile, .pkcard, .k-seat, .chip, .statusbar, .gmchip, .plline, .rmdigits, .rmpeople li, .yzsheet, .k-result, .cgrid, .dock summary, .roomchip, .rulechip, .connbadge, svg[role=grid], [role=grid], .gmboard, .xqboard, .ccboard, .hdcenter, .bjdealer, .btcenter, .tkcross, .ddtable, .brtable, .c8table, .yzdice, .ldbid'
function obstacles(self: Element): DOMRect[] {
  const out: DOMRect[] = []
  for (const e of document.querySelectorAll(KEEP_CLEAR)) {
    if (self.contains(e)) continue
    const r = e.getBoundingClientRect()
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue
    if (getComputedStyle(e).visibility === 'hidden') continue
    out.push(r)
  }
  return out
}
const MARGIN = 2
function covers(taken: DOMRect[], at: { x: number; b: number }, w: number, h: number): boolean {
  const left = at.x - MARGIN,
    right = at.x + w + MARGIN,
    bottom = innerHeight - at.b + MARGIN,
    top = innerHeight - at.b - h - MARGIN
  return top < 0 || at.x < 0 || at.x + w > innerWidth || taken.some((r) => r.left < right && r.right > left && r.top < bottom && r.bottom > top)
}
/** the lowest empty place along the left edge, then the right edge */
function freeSpot(taken: DOMRect[], w: number, h: number): { x: number; b: number } | null {
  for (let b = 8; b < innerHeight - h; b += 6)
    for (const x of [4, innerWidth - w - 4]) {
      if (!covers(taken, { x, b }, w, h)) return { x, b }
    }
  return null
}
function apply(c: HTMLElement, at: { x: number; b: number }) {
  c.style.left = at.x + 'px'
  c.style.setProperty('--lift', at.b + 'px')
}

export function TalkBox({ lines, say }: { lines: TalkMsg[]; say: (text: string) => void }) {
  const { t } = useLang()
  const small = useSmall()
  const [crowded, setCrowded] = useState(false) // the full box found no empty spot on this screen
  const compact = small || crowded
  const [open, setOpen] = useState(false)
  const [seenN, setSeenN] = useState(0)
  const lastN = lines.length ? lines[lines.length - 1].n : 0
  useEffect(() => {
    if (open) setSeenN(lastN)
  }, [open, lastN])
  const unread = compact && !open ? lines.filter((l) => l.n > seenN).length : 0
  const [text, setText] = useState('')
  const [focus, setFocus] = useState(false)
  const [, tick] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const arrived = useRef(new Map<number, number>()) // when each line first showed up here, to fade it later
  const now = Date.now()
  for (const l of lines) if (!arrived.current.has(l.n)) arrived.current.set(l.n, now)
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const state = useRef({ compact, open })
  state.current = { compact, open }
  useEffect(() => {
    // find a spot where nothing of the game is underneath, and stay there while it stays empty
    let spot: { x: number; b: number } | null = null
    let roomFor = 0 // how long the full box would have fitted again
    const place = () => {
      const c = box.current
      if (!c) return
      if (state.current.compact && state.current.open) {
        // opened on purpose: it may lie over the table until it is closed again
        c.style.removeProperty('left')
        c.style.setProperty('--lift', '0px')
        return
      }
      const r = c.getBoundingClientRect()
      const w = r.width || (state.current.compact ? 44 : 330),
        h = r.height || (state.current.compact ? 44 : 60)
      const taken = obstacles(c)
      if (spot && !covers(taken, spot, w, h)) return apply(c, spot)
      const found = freeSpot(taken, w, h)
      if (!state.current.compact) {
        if (!found || found.b > innerHeight * 0.3) {
          roomFor = 0
          return setCrowded(true)
        }
      } else if (!small) {
        // on a large screen the full box comes back once there has been room for it for a while
        const full = freeSpot(taken, 330, 90)
        roomFor = full && full.b <= innerHeight * 0.2 ? roomFor + 1 : 0
        if (roomFor > 12) return setCrowded(false)
      }
      spot = found ?? { x: 8, b: 8 }
      apply(c, spot)
    }
    document.body.classList.add('has-kgchat') // lobby pages scroll: they get room at the bottom so nothing is stuck under the chat
    place()
    const id = setInterval(place, 250)
    addEventListener('resize', place)
    return () => {
      clearInterval(id)
      removeEventListener('resize', place)
      document.body.classList.remove('has-kgchat')
    }
  }, [small, compact])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing) return
      const el = document.activeElement as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName)) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const recent = lines.slice(-6)
  const fresh = (n: number) => now - (arrived.current.get(n) ?? 0) < FADE_MS
  return (
    <div
      ref={box}
      className={'kgchat' + (focus ? ' on' : '') + (compact ? (open ? ' compact open' : ' compact') : '')}
      role="log"
      aria-live="polite"
      aria-label={t('talkTitle')}
    >
      {compact && !open && (
        <button className="kgchat-pill" onClick={() => setOpen(true)} aria-label={t('talkTitle')}>
          <span aria-hidden="true">💬</span>
          {unread > 0 && <b>{unread}</b>}
        </button>
      )}
      <div className="kgchat-body">
        <div className="kgfeed">
          {recent.map((l) => (
            <div key={l.n} className={'kgline' + (fresh(l.n) || focus ? '' : ' old')}>
              <span className="kgtag">[{t('talkTable')}]</span> <b style={{ color: colourOf(l.name) }}>{l.name}:</b> {l.text}
            </div>
          ))}
        </div>
        <form
          className="kgin"
          onSubmit={(e) => {
            e.preventDefault()
            const x = text.trim()
            if (x) {
              say(x)
              setText('')
            }
          }}
        >
          <span className="kgtag">{t('talkTable')}</span>
          <input
            ref={input}
            value={text}
            maxLength={140}
            autoComplete="off"
            enterKeyHint="send"
            placeholder={t('talkPlaceholder')}
            aria-label={t('talkTitle')}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') input.current?.blur()
            }}
          />
        </form>
        {compact && open && (
          <button className="kgchat-close" onClick={() => setOpen(false)} aria-label={t('acClose')}>
            ×
          </button>
        )}
      </div>
    </div>
  )
}
