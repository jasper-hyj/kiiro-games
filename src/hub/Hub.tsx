import { useLang } from '../i18n'
import { useState } from 'react'
import { BIGTWO_PATH, BLACKJACK_PATH, HOLDEM_PATH, MAHJONG_PATH } from '../route'
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
      <a className="kg-brand" href="/">Kiiro Games</a>
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
    <form className="kg-join" onSubmit={(e) => { e.preventDefault(); if (/^\d{4}$/.test(c)) location.href = `${MAHJONG_PATH}?room=${c}` }}>
      <label htmlFor="kgcode">{t('hubHaveCode')}</label>
      <div><input id="kgcode" inputMode="numeric" maxLength={4} value={c} onChange={(e) => setC(e.target.value.replace(/\D/g, ''))} placeholder="1234" /><button disabled={!/^\d{4}$/.test(c)}>{t('hubJoin')}</button></div>
    </form>
  )
}

/** Small line pictograms, one per game: silver strokes on the dark panel, nothing decorative beyond the subject. */
const ART: Record<string, JSX.Element> = {
  mahjong: <svg viewBox="0 0 64 48" aria-hidden><rect x="6" y="8" width="22" height="32" rx="4"/><rect x="36" y="8" width="22" height="32" rx="4"/><circle cx="17" cy="24" r="5"/><path d="M47 16v16M41 24h12"/></svg>,
  holdem: <svg viewBox="0 0 64 48" aria-hidden><rect x="8" y="8" width="22" height="32" rx="4" transform="rotate(-8 19 24)"/><rect x="34" y="8" width="22" height="32" rx="4" transform="rotate(8 45 24)"/><path d="M45 18c-3 4-6 5-6 8a3 3 0 0 0 5 2l-1 4h4l-1-4a3 3 0 0 0 5-2c0-3-3-4-6-8z"/></svg>,
  blackjack: <svg viewBox="0 0 64 48" aria-hidden><rect x="8" y="8" width="22" height="32" rx="4"/><rect x="26" y="8" width="22" height="32" rx="4" transform="translate(8 0)"/><path d="M14 18h6M14 22h4M43 30h6M45 26h4"/></svg>,
  bigtwo: <svg viewBox="0 0 64 48" aria-hidden><rect x="5" y="10" width="20" height="30" rx="4"/><rect x="15" y="8" width="20" height="30" rx="4"/><rect x="25" y="6" width="20" height="30" rx="4"/><rect x="35" y="8" width="20" height="30" rx="4"/><path d="M41 16h8l-8 14h8"/></svg>,
}

const GAMES: { key: keyof typeof ART; href: string; name: string; blurb: string; tag: string }[] = [
  { key: 'mahjong', href: MAHJONG_PATH, name: 'hubMahjong', blurb: 'hubMahjongBlurb', tag: 'hubTagMj' },
  { key: 'holdem', href: HOLDEM_PATH, name: 'hubHoldem', blurb: 'hubHoldemBlurb', tag: 'hubTagCards' },
  { key: 'blackjack', href: BLACKJACK_PATH, name: 'bjName', blurb: 'hubBjBlurb', tag: 'hubTagCards' },
  { key: 'bigtwo', href: BIGTWO_PATH, name: 'btName', blurb: 'hubBtBlurb', tag: 'hubTagCards' },
]

/** The front page: a short statement, a 2x2 grid of games, and the season board under it. Mahjong needs no sign-in. */
export function Hub() {
  const { t } = useLang()
  return (
    <div className="kg">
      <div className="kg-wrap">
        <Bar />
        <header className="kg-hero">
          <div>
            <h1>{t('hubHeadline')}</h1>
            <p className="kg-lead">{t('hubTagline')}</p>
          </div>
          <JoinCode />
        </header>
        <section>
          <h2>{t('hubGames')}</h2>
          <ul className="kg-grid">
            {GAMES.map((g) => (
              <li key={g.key}><a className="kg-game" href={g.href}>
                <span className="kg-art">{ART[g.key]}</span>
                <b>{t(g.name)}</b>
                <p>{t(g.blurb)}</p>
                <span className="kg-go">{t('hubOpen')} →</span>
              </a></li>
            ))}
          </ul>
          <p className="kg-note">{t('hubNoSignin')}</p>
        </section>
        <section className="kg-board"><Leaderboard /></section>
      </div>
    </div>
  )
}
