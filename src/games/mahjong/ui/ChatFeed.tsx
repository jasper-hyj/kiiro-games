import { useEffect, useRef, useState } from 'react'
import type { TableView } from '../engine/table'
import type { ClientMsg } from '../net/protocol'
import { useLang } from '../../../i18n'

const SEAT_COLORS = ['#9fc2ff', '#ffb86b', '#7fe0b0', '#e79cff']

/** Valorant-style live chat: the last lines always in view at the bottom left; Enter or / (or the chat button) opens the input. */
export function ChatFeed({ v, send, open, onClose, onOpen }: { v: NonNullable<TableView['game']>; send: (m: ClientMsg) => void; open: boolean; onClose: () => void; onOpen: () => void }) {
  const { t } = useLang()
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const lines = (v.feed ?? []).slice(-6)
  useEffect(() => { if (open) input.current?.focus() }, [open])
  const submit = () => {
    const s = text.trim()
    if (s) send({ t: 'say', text: s })
    setText('')
    onClose()
  }
  return (
    <div className={'chatfeed' + (open ? ' open' : '')} aria-live="polite">
      <ul>
        {lines.map((c, i) => (
          <li key={c.n} style={{ opacity: 0.45 + 0.55 * ((i + 1) / lines.length) }}>
            <b style={{ color: SEAT_COLORS[c.seat % 4] }}>{v.players[c.seat]?.name ?? '?'}</b>
            <span>{c.text ?? t('chat.' + c.key)}</span>
          </li>
        ))}
      </ul>
      {!open && <button type="button" className="chatopen" onClick={onOpen}><span className="kb">{t('chatOpenKey')}</span><span className="tp">{t('chatTitle')}</span></button>}
      {open && (
        <div className="chatinput">
          <input ref={input} type="text" value={text} maxLength={80} placeholder={t('chatPlaceholder')} aria-label={t('chatTitle')}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } else if (e.key === 'Escape') { setText(''); onClose() } }} />
        </div>
      )}
    </div>
  )
}
