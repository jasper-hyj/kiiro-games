import { useEffect, useRef, useState } from 'react'
import type { Status } from '../net/client'
import { useLang } from '../../../i18n'

/** Always-visible connection state for online rooms: a quiet dot + latency when fine, a clear banner when not. */
export function ConnBadge({ status, latency }: { status: Status; latency: number | null }) {
  const { t } = useLang()
  const prev = useRef<Status>(status)
  const [back, setBack] = useState(false)
  useEffect(() => {
    if (status === 'open' && prev.current !== 'open' && prev.current !== 'connecting') { setBack(true); const id = setTimeout(() => setBack(false), 3000); prev.current = status; return () => clearTimeout(id) }
    prev.current = status
  }, [status])
  if (status === 'open' && back) {
    return <div className="connbadge up" role="status"><span className="cdot" />{t('connBack')}</div>
  }
  if (status === 'open') {
    const slow = latency !== null && latency > 400
    return (
      <div className={'connbadge ok' + (slow ? ' slow' : '')} title={t('connOk')} role="status">
        <span className="cdot" />{latency !== null ? `${latency} ms` : t('connOk')}
      </div>
    )
  }
  return (
    <div className="connbadge down" role="alert">
      <span className="spin" aria-hidden="true" />
      <b>{status === 'connecting' ? t('connConnecting') : t('connLostBanner')}</b>
      <span className="muted small">{t('connKeepOpen')}</span>
    </div>
  )
}
