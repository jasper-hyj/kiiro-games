import { useLang } from '../i18n'
import { useState } from 'react'
import { HOLDEM_PATH, MAHJONG_PATH } from '../route'
import { AccountChip, Leaderboard } from '../account/Panels'
import './hub.css'
import './strings'

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

/** The front page: a plain list of games next to the season leaderboard. Mahjong needs no sign-in. */
export function Hub() {
  const { t } = useLang()
  return (
    <div className="kg">
      <div className="kg-wrap">
        <Bar />
        <h1>{t('hubHeadline')}</h1>
        <p className="kg-lead">{t('hubTagline')}</p>
        <div className="kg-cols">
          <section>
            <h2>{t('hubGames')}</h2>
            <ul className="kg-games">
              <li><a className="kg-game" href={MAHJONG_PATH}>
                <b>{t('hubMahjong')}</b><span className="kg-go">{t('hubOpen')} →</span>
                <p>{t('hubMahjongBlurb')}</p>
              </a></li>
              <li><a className="kg-game" href={HOLDEM_PATH}>
                <b>{t('hubHoldem')}</b><span className="kg-go">{t('hubOpen')} →</span>
                <p>{t('hubHoldemBlurb')}</p>
              </a></li>
            </ul>
            <p className="kg-note">{t('hubNoSignin')}</p>
            <JoinCode />
          </section>
          <Leaderboard />
        </div>
      </div>
    </div>
  )
}
