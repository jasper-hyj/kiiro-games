import { useEffect, useState } from 'react'
import { useLang } from '../i18n'

/** Like Mahjong Soul on a phone: the table is played in landscape. In portrait a clear prompt asks for a turn (it can be dismissed). */
export function RotatePrompt() {
  const { t } = useLang()
  const [portrait, setPortrait] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    const check = () => {
      const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
      setPortrait(coarse && window.innerHeight > window.innerWidth && Math.min(window.innerWidth, window.innerHeight) < 700)
    }
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => { window.removeEventListener('resize', check); window.removeEventListener('orientationchange', check) }
  }, [])
  if (!portrait || dismissed) return null
  return (
    <div className="rotateprompt" role="dialog" aria-live="polite">
      <div className="rpphone" aria-hidden="true"><span /></div>
      <h2>{t('rotateTitle')}</h2>
      <p>{t('rotateBody')}</p>
      <button className="btn alt" onClick={() => setDismissed(true)}>{t('rotateAnyway')}</button>
    </div>
  )
}
