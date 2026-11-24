import { useLang } from '../i18n'
import { useState } from 'react'
import { newRoomUrl, practiceUrl, roomUrl, type GameKey } from '../route'
import { AccountChip, Leaderboard } from '../account/Panels'
import './hub.css'
import './strings'
import '../games/blackjack/strings'
import '../games/bigtwo/strings'

/** Shared top bar: wordmark, language, account. Used by the hub and the admin page. */
export function Bar() {
  const { lang, setLang, simplified, setSimplified } = useLang()
  return (
    <div className="kg-bar">
      <a className="kg-brand" href="/"><img className="kg-logo" src="/favicon.svg" alt="" width="26" height="26" /><span>Kiiro Games</span></a>
      <div className="kg-tools">
        <div className="kg-lang" role="group" aria-label="Language">
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
          <button className={lang === 'zh' && !simplified ? 'on' : ''} onClick={() => { setLang('zh'); setSimplified(false) }}>繁</button>
          <button className={lang === 'zh' && simplified ? 'on' : ''} onClick={() => { setLang('zh'); setSimplified(true) }}>简</button>
          <button className={lang === 'ja' ? 'on' : ''} onClick={() => setLang('ja')}>日</button>
        </div>
        <AccountChip />
      </div>
    </div>
  )
}

/** One room-code box for every game: the code finds the table, and the table says which game it is. */
function JoinCode() {
  const { t } = useLang()
  const [c, setC] = useState('')
  return (
    <form className="kg-join" onSubmit={(e) => { e.preventDefault(); if (/^\d{4}$/.test(c)) location.href = roomUrl(c) }}>
      <label htmlFor="kgcode">{t('hubHaveCode')}</label>
      <div><input id="kgcode" inputMode="numeric" maxLength={4} value={c} onChange={(e) => setC(e.target.value.replace(/\D/g, ''))} placeholder="1234" /><button disabled={!/^\d{4}$/.test(c)}>{t('hubJoin')}</button></div>
    </form>
  )
}

/** Small line pictograms, one per game: silver strokes on the dark panel, nothing decorative beyond the subject. */
export const ART: Record<string, JSX.Element> = {
  mahjong: <svg viewBox="0 0 64 48" aria-hidden><g transform="rotate(-7 19 24)"><rect x="8" y="9" width="22" height="30" rx="4" fill="#1a2240"/><rect x="11" y="12" width="16" height="24" rx="2" opacity=".3"/><circle cx="14.6" cy="29.5" r="2.6"/><circle cx="19" cy="24" r="2.6"/><circle cx="23.4" cy="18.5" r="2.6"/></g><g transform="rotate(6 45 24)"><rect x="34" y="9" width="22" height="30" rx="4" fill="#1a2240"/><rect x="37" y="12" width="16" height="24" rx="2" opacity=".3"/><rect x="40" y="19" width="10" height="9" rx="1"/><path d="M45 15v18"/></g></svg>,
  holdem: <svg viewBox="0 0 64 48" aria-hidden><g transform="rotate(-9 20 24)"><rect x="9" y="7" width="22" height="32" rx="4" fill="#1a2240"/><path d="M12.5 17l2.5-6 2.5 6M13.5 15h3" stroke-width="1.3"/><path d="M20 18.5c-4.2 4-7 5.6-7 8.6a3.2 3.2 0 0 0 5.6 2L17.7 34h4.6l-.9-4.9a3.2 3.2 0 0 0 5.6-2c0-3-2.8-4.6-7-8.6z" transform="translate(0 2)"/></g><g transform="rotate(9 45 24)"><rect x="34" y="7" width="22" height="32" rx="4" fill="#1a2240"/><path d="M38 11v6M38 14l4-3M38 14l4 3" stroke-width="1.3"/><path d="M45 33c-5-3.6-7.6-6.2-7.6-9.2a3.7 3.7 0 0 1 7.6-1.1 3.7 3.7 0 0 1 7.6 1.1c0 3-2.6 5.6-7.6 9.2z" transform="translate(0 -1)"/></g></svg>,
  blackjack: <svg viewBox="0 0 64 48" aria-hidden><g transform="rotate(-8 22 26)"><rect x="6" y="7" width="22" height="32" rx="4" fill="#1a2240"/><path d="M9.5 17l2.5-6 2.5 6M10.5 15h3" stroke-width="1.3"/><path d="M17 17.5c-3.4 3.2-5.6 4.5-5.6 7a2.6 2.6 0 0 0 4.5 1.6L15.2 30h3.6l-.7-3.9a2.6 2.6 0 0 0 4.5-1.6c0-2.5-2.2-3.8-5.6-7z"/></g><g transform="rotate(5 32 26)"><rect x="19" y="7" width="22" height="32" rx="4" fill="#1a2240"/><path d="M23 11v6M23 14l4-3M23 14l4 3" stroke-width="1.3"/><path d="M30 18l5 5-5 5-5-5z"/></g><circle cx="50" cy="33" r="9" fill="#1a2240"/><circle cx="50" cy="33" r="9" stroke-dasharray="4 3.3"/><circle cx="50" cy="33" r="4.6"/></svg>,
  bigtwo: <svg viewBox="0 0 64 48" aria-hidden><rect x="17" y="9" width="20" height="30" rx="4" fill="#1a2240" transform="rotate(-18 27 45)"/><rect x="27" y="9" width="20" height="30" rx="4" fill="#1a2240" transform="rotate(18 37 45)"/><rect x="22" y="6" width="20" height="32" rx="4" fill="#1a2240"/><path d="M27.5 15c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4c0 2.2-1.8 3.6-4.5 6L27.5 24h9"/><path d="M32 27l3 3.5-3 3.5-3-3.5z"/></svg>,
}

const GAMES: { key: GameKey; name: string; blurb: string; practice?: string }[] = [
  { key: 'mahjong', name: 'hubMahjong', blurb: 'hubMahjongBlurb', practice: practiceUrl('mahjong') },
  { key: 'holdem', name: 'hubHoldem', blurb: 'hubHoldemBlurb', practice: practiceUrl('holdem') },
  { key: 'blackjack', name: 'bjName', blurb: 'hubBjBlurb', practice: practiceUrl('blackjack') },
  { key: 'bigtwo', name: 'btName', blurb: 'hubBtBlurb', practice: practiceUrl('bigtwo') },
]

/** The front page is a room you walk into: a lamplit table, the games sit around it like seats, and the middle of the table says what to do next. */
export function Hub() {
  const { t } = useLang()
  const [pick, setPick] = useState<GameKey | null>(null)
  const chosen = GAMES.find((g) => g.key === pick)
  const seat = (g: (typeof GAMES)[number]) => (
    <button key={g.key} className={'kg-obj' + (pick === g.key ? ' on' : '')} aria-pressed={pick === g.key} onClick={() => setPick(pick === g.key ? null : g.key)}>
      <span className="kg-medal">{ART[g.key]}</span><b>{t(g.name)}</b>
    </button>
  )
  return (
    <div className="kg kg-scene">
      <Bar />
      <main className="kg-room">
        <div className="kg-table">
          <div className="kg-seats kg-left">{GAMES.slice(0, 2).map(seat)}</div>
          <div className="kg-center" aria-live="polite">
            {chosen ? (
              <>
                <h1>{t(chosen.name)}</h1>
                <p className="kg-lead">{t(chosen.blurb)}</p>
                <span className="kg-acts">
                  <a className="kg-create" href={newRoomUrl(chosen.key)}>{t('hubPlayFriends')}</a>
                  {chosen.practice && <a className="kg-practice" href={chosen.practice}>{t('hubPractice')}</a>}
                </span>
                <button className="kg-close" onClick={() => setPick(null)}>← {t('acAll')}</button>
              </>
            ) : (
              <>
                <h1>{t('hubHeadline')}</h1>
                <p className="kg-lead">{t('hubTagline')}</p>
                <a className="kg-create" href={newRoomUrl()}>{t('hubCreateRoom')}</a>
                <JoinCode />
              </>
            )}
          </div>
          <div className="kg-seats kg-right">{GAMES.slice(2).map(seat)}</div>
        </div>
        <p className="kg-note">{t('hubNoSignin')}</p>
        <section className="kg-board"><Leaderboard /></section>
      </main>
    </div>
  )
}
