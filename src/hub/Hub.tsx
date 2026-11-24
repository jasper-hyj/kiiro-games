import { useLang } from '../i18n'
import { useState } from 'react'
import { newRoomUrl, practiceUrl, roomUrl, type GameKey } from '../route'
import { AccountChip, Leaderboard } from '../account/Panels'
import { CodeBoxes } from '../ui/components'
import './hub.css'
import './strings'
import '../games/blackjack/strings'
import '../games/bigtwo/strings'
import '../games/generic/strings'
import '../games/generic/gomokuStrings'
import '../games/generic/crazyStrings'
import '../games/generic/yahtzeeStrings'
import '../games/generic/liarsStrings'
import '../games/generic/chessStrings'
import '../games/generic/xqStrings'
import '../games/generic/ddStrings'
import '../games/generic/bridgeStrings'

/** Shared top bar: wordmark, language, account. Used by the hub and the admin page. */
export function Bar() {
  const { lang, setLang, simplified, setSimplified } = useLang()
  return (
    <div className="kg-bar">
      <a className="kg-brand" href="/"><img className="kg-logo" src="/favicon.svg" alt="" width="26" height="26" /><span className="kg-brandname">Kiiro Games</span></a>
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
  return (
    <div className="kg-join">
      <label>{t('hubHaveCode')}</label>
      <CodeBoxes label={t('hdCode')} onDone={(c) => { location.href = roomUrl(c) }} />
    </div>
  )
}

/** Small line pictograms, one per game: silver strokes on the dark panel, nothing decorative beyond the subject. */
export const ART: Record<string, JSX.Element> = {
  mahjong: <svg viewBox="0 0 64 48" aria-hidden><g transform="rotate(-7 19 24)"><rect x="8" y="9" width="22" height="30" rx="4" fill="#fbf6ea"/><rect x="11" y="12" width="16" height="24" rx="2" opacity=".3"/><circle cx="14.6" cy="29.5" r="2.6"/><circle cx="19" cy="24" r="2.6"/><circle cx="23.4" cy="18.5" r="2.6"/></g><g transform="rotate(6 45 24)"><rect x="34" y="9" width="22" height="30" rx="4" fill="#fbf6ea"/><rect x="37" y="12" width="16" height="24" rx="2" opacity=".3"/><rect x="40" y="19" width="10" height="9" rx="1"/><path d="M45 15v18"/></g></svg>,
  holdem: <svg viewBox="0 0 64 48" aria-hidden><g transform="rotate(-9 20 24)"><rect x="9" y="7" width="22" height="32" rx="4" fill="#fbf6ea"/><path d="M12.5 17l2.5-6 2.5 6M13.5 15h3" stroke-width="1.3"/><path d="M20 18.5c-4.2 4-7 5.6-7 8.6a3.2 3.2 0 0 0 5.6 2L17.7 34h4.6l-.9-4.9a3.2 3.2 0 0 0 5.6-2c0-3-2.8-4.6-7-8.6z" transform="translate(0 2)"/></g><g transform="rotate(9 45 24)"><rect x="34" y="7" width="22" height="32" rx="4" fill="#fbf6ea"/><path d="M38 11v6M38 14l4-3M38 14l4 3" stroke-width="1.3"/><path d="M45 33c-5-3.6-7.6-6.2-7.6-9.2a3.7 3.7 0 0 1 7.6-1.1 3.7 3.7 0 0 1 7.6 1.1c0 3-2.6 5.6-7.6 9.2z" transform="translate(0 -1)"/></g></svg>,
  blackjack: <svg viewBox="0 0 64 48" aria-hidden><g transform="rotate(-8 22 26)"><rect x="6" y="7" width="22" height="32" rx="4" fill="#fbf6ea"/><path d="M9.5 17l2.5-6 2.5 6M10.5 15h3" stroke-width="1.3"/><path d="M17 17.5c-3.4 3.2-5.6 4.5-5.6 7a2.6 2.6 0 0 0 4.5 1.6L15.2 30h3.6l-.7-3.9a2.6 2.6 0 0 0 4.5-1.6c0-2.5-2.2-3.8-5.6-7z"/></g><g transform="rotate(5 32 26)"><rect x="19" y="7" width="22" height="32" rx="4" fill="#fbf6ea"/><path d="M23 11v6M23 14l4-3M23 14l4 3" stroke-width="1.3"/><path d="M30 18l5 5-5 5-5-5z"/></g><circle cx="50" cy="33" r="9" fill="#fbf6ea"/><circle cx="50" cy="33" r="9" stroke-dasharray="4 3.3"/><circle cx="50" cy="33" r="4.6"/></svg>,
  bigtwo: <svg viewBox="0 0 64 48" aria-hidden><rect x="17" y="9" width="20" height="30" rx="4" fill="#fbf6ea" transform="rotate(-18 27 45)"/><rect x="27" y="9" width="20" height="30" rx="4" fill="#fbf6ea" transform="rotate(18 37 45)"/><rect x="22" y="6" width="20" height="32" rx="4" fill="#fbf6ea"/><path d="M27.5 15c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4c0 2.2-1.8 3.6-4.5 6L27.5 24h9"/><path d="M32 27l3 3.5-3 3.5-3-3.5z"/></svg>,
  gomoku: <svg viewBox="0 0 64 48" aria-hidden><path d="M10 6v36M22 6v36M34 6v36M46 6v36M6 12h44M6 24h44M6 36h44" opacity=".4" strokeWidth="1.2"/><circle cx="22" cy="12" r="5" fill="#a9552f"/><circle cx="34" cy="24" r="5" fill="#a9552f"/><circle cx="46" cy="36" r="5" fill="#a9552f"/><circle cx="34" cy="12" r="5" fill="#fbf6ea"/><circle cx="22" cy="24" r="5" fill="#fbf6ea"/><circle cx="22" cy="36" r="5" fill="#fbf6ea"/></svg>,
  crazyeights: <svg viewBox="0 0 64 48" aria-hidden><g transform="rotate(-14 24 44)"><rect x="12" y="7" width="22" height="32" rx="4" fill="#fbf6ea"/><path d="M23 18l5 6-5 6-5-6z"/></g><g transform="rotate(8 40 44)"><rect x="29" y="5" width="22" height="34" rx="4" fill="#fbf6ea"/><circle cx="40" cy="17" r="4"/><circle cx="40" cy="28" r="5"/><path d="M34 11h0M46 33h0" strokeWidth="2.4"/></g></svg>,
  yahtzee: <svg viewBox="0 0 64 48" aria-hidden><g transform="rotate(-10 22 26)"><rect x="8" y="12" width="24" height="24" rx="5" fill="#fbf6ea"/><circle cx="15" cy="19" r="2.2" fill="#a9552f"/><circle cx="20" cy="24" r="2.2" fill="#a9552f"/><circle cx="25" cy="29" r="2.2" fill="#a9552f"/></g><g transform="rotate(12 44 24)"><rect x="32" y="8" width="24" height="24" rx="5" fill="#fbf6ea"/><circle cx="39" cy="15" r="2.2" fill="#a9552f"/><circle cx="49" cy="15" r="2.2" fill="#a9552f"/><circle cx="44" cy="20" r="2.2" fill="#a9552f"/><circle cx="39" cy="25" r="2.2" fill="#a9552f"/><circle cx="49" cy="25" r="2.2" fill="#a9552f"/></g></svg>,
  liarsdice: <svg viewBox="0 0 64 48" aria-hidden><path d="M14 40V26a14 14 0 0 1 28 0v14z" fill="#fbf6ea"/><path d="M10 40h36" strokeWidth="2.2"/><circle cx="28" cy="10" r="2.6" fill="#a9552f"/><rect x="40" y="22" width="18" height="18" rx="4" fill="#fbf6ea" transform="rotate(10 49 31)"/><g transform="rotate(10 49 31)"><circle cx="44" cy="27" r="1.8" fill="#a9552f"/><circle cx="49" cy="31" r="1.8" fill="#a9552f"/><circle cx="54" cy="35" r="1.8" fill="#a9552f"/></g></svg>,
  chess: <svg viewBox="0 0 64 48" aria-hidden><path d="M20 40c0-8 4-11 8-14-4-1-7-3-7-7l5-7V8l4 3c2-2 5-2 8-1 6 2 10 9 10 29z" fill="#fbf6ea"/><circle cx="31" cy="17" r="1.6" fill="#a9552f"/><path d="M17 43h32" strokeWidth="2.2"/></svg>,
  xiangqi: <svg viewBox="0 0 64 48" aria-hidden><circle cx="32" cy="24" r="18" fill="#fbf6ea"/><circle cx="32" cy="24" r="14.5"/><path d="M24 17h16M32 17v16M25 25h14M23 33h18" strokeWidth="2.2"/></svg>,
  doudizhu: <svg viewBox="0 0 64 48" aria-hidden><g transform="rotate(-12 18 44)"><rect x="7" y="8" width="20" height="30" rx="4" fill="#fbf6ea"/><path d="M14 20l3-4 3 4 3-4v8H14z"/></g><g transform="rotate(0 32 44)"><rect x="22" y="5" width="20" height="32" rx="4" fill="#fbf6ea"/><path d="M27 17l5-6 5 6M32 11v10" strokeWidth="1.4"/><circle cx="32" cy="27" r="3.4"/></g><g transform="rotate(12 46 44)"><rect x="37" y="8" width="20" height="30" rx="4" fill="#fbf6ea"/><path d="M47 14v14M42 19h10" /></g></svg>,
  bridge: <svg viewBox="0 0 64 48" aria-hidden><rect x="22" y="4" width="20" height="14" rx="3" fill="#fbf6ea"/><rect x="22" y="30" width="20" height="14" rx="3" fill="#fbf6ea"/><rect x="4" y="17" width="14" height="14" rx="3" fill="#fbf6ea"/><rect x="46" y="17" width="14" height="14" rx="3" fill="#fbf6ea"/><path d="M32 11v0M32 37v0M11 24v0M53 24v0" strokeWidth="3"/><path d="M26 24h12M32 20v8" strokeWidth="1.6"/></svg>,
}

const GAMES: { key: GameKey; name: string; blurb: string; practice?: string }[] = [
  { key: 'mahjong', name: 'hubMahjong', blurb: 'hubMahjongBlurb', practice: practiceUrl('mahjong') },
  { key: 'holdem', name: 'hubHoldem', blurb: 'hubHoldemBlurb', practice: practiceUrl('holdem') },
  { key: 'blackjack', name: 'bjName', blurb: 'hubBjBlurb', practice: practiceUrl('blackjack') },
  { key: 'bigtwo', name: 'btName', blurb: 'hubBtBlurb', practice: practiceUrl('bigtwo') },
  { key: 'gomoku', name: 'gomoku', blurb: 'gomokuBlurb', practice: practiceUrl('gomoku') },
  { key: 'crazyeights', name: 'crazyeights', blurb: 'crazyeightsBlurb', practice: practiceUrl('crazyeights') },
  { key: 'yahtzee', name: 'yahtzee', blurb: 'yahtzeeBlurb', practice: practiceUrl('yahtzee') },
  { key: 'liarsdice', name: 'liarsdice', blurb: 'liarsdiceBlurb', practice: practiceUrl('liarsdice') },
  { key: 'chess', name: 'chess', blurb: 'chessBlurb', practice: practiceUrl('chess') },
  { key: 'xiangqi', name: 'xiangqi', blurb: 'xiangqiBlurb', practice: practiceUrl('xiangqi') },
  { key: 'doudizhu', name: 'doudizhu', blurb: 'doudizhuBlurb', practice: practiceUrl('doudizhu') },
  { key: 'bridge', name: 'bridge', blurb: 'bridgeBlurb', practice: practiceUrl('bridge') },
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
        <div className="kg-table kg-hubtable">
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
          <div className="kg-shelf">{GAMES.map(seat)}</div>
        </div>
        <p className="kg-note">{t('hubNoSignin')}</p>
        <section className="kg-board"><Leaderboard /></section>
      </main>
    </div>
  )
}
