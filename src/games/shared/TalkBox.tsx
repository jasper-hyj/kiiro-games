import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../i18n'
import type { TalkMsg } from './cashClient'

/** Collapsible table chat. `lines` is the running feed; `say` sends a message. */
export function TalkBox({ lines, say }: { lines: TalkMsg[]; say: (text: string) => void }) {
  const { t } = useLang()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(0)
  const end = useRef<HTMLDivElement>(null)
  const last = lines.length ? lines[lines.length - 1].n : 0
  useEffect(() => { if (open) { setSeen(last); end.current?.scrollIntoView({ block: 'nearest' }) } }, [open, last])
  const unread = open ? 0 : lines.filter((l) => l.n > seen).length
  return (
    <details className="hdchat" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>{t('talkTitle')}{unread > 0 && <b className="hdbadge">{unread}</b>}</summary>
      <div className="hdfeed" aria-live="polite">
        {lines.length === 0 && <span className="muted">{t('talkEmpty')}</span>}
        {lines.slice(-30).map((l) => <div key={l.n}><b>{l.name}</b> {l.text}</div>)}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); const x = text.trim(); if (x) { say(x); setText('') } }} className="hdrow">
        <input value={text} maxLength={140} onChange={(e) => setText(e.target.value)} placeholder={t('talkPlaceholder')} aria-label={t('talkTitle')} />
        <button className="hdbtn" disabled={!text.trim()}>{t('talkSend')}</button>
      </form>
    </details>
  )
}
