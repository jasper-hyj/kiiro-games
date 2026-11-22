import { useLang } from '../i18n'
import { MAHJONG_PATH } from '../route'
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
              <li><div className="kg-game soon" aria-disabled="true">
                <b>{t('hubHoldem')}</b><span className="kg-go">{t('hubSoon')}</span>
                <p>{t('hubHoldemBlurb')}</p>
              </div></li>
            </ul>
            <p className="kg-note">{t('hubNoSignin')}</p>
          </section>
          <Leaderboard />
        </div>
      </div>
    </div>
  )
}
