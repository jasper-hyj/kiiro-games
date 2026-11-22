import { useLang } from '../i18n'
import { MAHJONG_PATH } from '../route'
import './hub.css'

/** The front page of the site: pick a game. Mahjong needs no sign-in. */
export function Hub() {
  const { lang, setLang, simplified, setSimplified, t } = useLang()
  return (
    <div className="page menu parlour hub">
      <div className="floatbar">
        <div className="seg langsw">
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
          <button className={lang === 'zh' && !simplified ? 'on' : ''} onClick={() => { setLang('zh'); setSimplified(false) }}>繁中</button>
          <button className={lang === 'zh' && simplified ? 'on' : ''} onClick={() => { setLang('zh'); setSimplified(true) }}>简中</button>
          <button className={lang === 'ja' ? 'on' : ''} onClick={() => setLang('ja')}>日本語</button>
        </div>
      </div>
      <header className="hero">
        <h1 className="title"><span className="latin hubname">{t('hubName')}</span></h1>
        <p className="tagline">{t('hubTagline')}</p>
      </header>
      <div className="hubgrid">
        <a className="hubcard" href={MAHJONG_PATH} data-rule="riichi">
          <span className="hubglyph" aria-hidden="true">麻雀</span>
          <b>{t('hubMahjong')}</b>
          <span className="muted small">{t('hubMahjongBlurb')}</span>
          <span className="tags"><span className="tg rec">{t('hubOpen')}</span><span className="tg">{t('hubNoSignin')}</span></span>
        </a>
        <div className="hubcard soon" aria-disabled="true">
          <span className="hubglyph" aria-hidden="true">♠</span>
          <b>{t('hubHoldem')}</b>
          <span className="muted small">{t('hubHoldemBlurb')}</span>
          <span className="tags"><span className="tg">{t('hubSoon')}</span></span>
        </div>
      </div>
    </div>
  )
}
