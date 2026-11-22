import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../i18n'
import type { TalkMsg } from './cashClient'

// name colours: blues, silver, amber, rose, violet. No green anywhere on this site.
const HUES = ['#8fb4ff', '#f0a0ac', '#e7c27d', '#b9a4f0', '#7fd0e8', '#d8dee9']
const colourOf = (name: string) => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return HUES[h % HUES.length] }
const FADE_MS = 7000

/**
 * Table chat as a translucent overlay in the bottom-left corner, in the manner of an in-game chat:
 * the last few lines are always visible and dim when nothing new has arrived; Enter jumps to the input, Escape leaves it.
 * Clicks pass through the feed, so it never blocks the table.
 */
export function TalkBox({ lines, say }: { lines: TalkMsg[]; say: (text: string) => void }) {
  const { t } = useLang()
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
  useEffect(() => {
    // sit above whatever lives in the bottom-left of the table (action bar, your hand or seat, bet chips) so it never covers a control
    const place = () => {
      const w = box.current?.getBoundingClientRect().width ?? 330
      let top = innerHeight
      for (const el of Array.from(document.querySelectorAll('.hdbar button, .hdbar input, .bthand, .hdseat:not(.empty), .bjseat, .bjchips, .bjchip, .btseat'))) {
        const r = el.getBoundingClientRect()
        if (r.height > 0 && r.left < w + 12 && r.right > 0 && r.top > innerHeight * 0.3 && r.top < top) top = r.top
      }
      box.current?.style.setProperty('--lift', top < innerHeight ? Math.max(0, innerHeight - top) + 8 + 'px' : '0px')
    }
    document.body.classList.add('has-kgchat') // lobby pages scroll: they get room at the bottom so nothing is stuck under the chat
    place()
    const id = setInterval(place, 100)
    addEventListener('resize', place)
    return () => { clearInterval(id); removeEventListener('resize', place); document.body.classList.remove('has-kgchat') }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing) return
      const el = document.activeElement as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName)) return
      e.preventDefault(); input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const recent = lines.slice(-6)
  const fresh = (n: number) => now - (arrived.current.get(n) ?? 0) < FADE_MS
  return (
    <div ref={box} className={'kgchat' + (focus ? ' on' : '')} role="log" aria-live="polite" aria-label={t('talkTitle')}>
      <div className="kgfeed">
        {recent.map((l) => (
          <div key={l.n} className={'kgline' + (fresh(l.n) || focus ? '' : ' old')}>
            <span className="kgtag">[{t('talkTable')}]</span> <b style={{ color: colourOf(l.name) }}>{l.name}:</b> {l.text}
          </div>
        ))}
      </div>
      <form className="kgin" onSubmit={(e) => { e.preventDefault(); const x = text.trim(); if (x) { say(x); setText('') } }}>
        <span className="kgtag">{t('talkTable')}</span>
        <input ref={input} value={text} maxLength={140} autoComplete="off" enterKeyHint="send" placeholder={t('talkPlaceholder')} aria-label={t('talkTitle')}
          onChange={(e) => setText(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') input.current?.blur() }} />
      </form>
    </div>
  )
}
