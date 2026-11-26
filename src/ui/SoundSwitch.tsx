import { useLang } from '../i18n'
import { setMuted, useMuted } from './sound'
import '../room/strings'

/** the mute switch for the table sounds */
export function SoundSwitch({ className = 'k-ghost k-helpbtn k-sound', labelled }: { className?: string; labelled?: boolean }) {
  const { t } = useLang()
  const muted = useMuted()
  return (
    <button
      className={className}
      onClick={() => setMuted(!muted)}
      aria-pressed={!muted}
      aria-label={t(muted ? 'kgSoundOn' : 'kgSoundOff')}
      title={t(muted ? 'kgSoundOn' : 'kgSoundOff')}
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 9v6h4l5 4V5L8 9z" />
        {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
      </svg>
      {labelled && <span>{t(muted ? 'kgSoundOn' : 'kgSoundOff')}</span>}
    </button>
  )
}
