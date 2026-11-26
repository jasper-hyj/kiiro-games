import { useLang } from '../i18n'

/** English, Traditional Chinese, Simplified Chinese, Japanese. In the top bar, and in the account dialog so it is within reach at every table. */
export function LangSwitch() {
  const { lang, setLang, simplified, setSimplified } = useLang()
  const chinese = (simple: boolean) => () => {
    setLang('zh')
    setSimplified(simple)
  }
  return (
    <div className="kg-lang" role="group" aria-label="Language">
      <button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
        EN
      </button>
      <button type="button" className={lang === 'zh' && !simplified ? 'on' : ''} onClick={chinese(false)}>
        繁
      </button>
      <button type="button" className={lang === 'zh' && simplified ? 'on' : ''} onClick={chinese(true)}>
        简
      </button>
      <button type="button" className={lang === 'ja' ? 'on' : ''} onClick={() => setLang('ja')}>
        日
      </button>
    </div>
  )
}
