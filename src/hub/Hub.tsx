import { useLang } from '../i18n'
import { LangSwitch } from '../ui/LangSwitch'
import { useState } from 'react'
import { localUrl, newRoomUrl, practiceUrl, roomUrl } from '../route'
import { CATALOG, playsOnOneDevice, type GameKey } from '../games/catalog'
import { ART } from '../games/icons'
import { AccountChip, Leaderboard } from '../account/Panels'
import { CodeBoxes } from '../ui/components'
import './hub.css'
import './strings'
import '../games/strings'

/** Shared top bar: wordmark, language, account. Used by the hub and the admin page. */
export function Bar() {
  return (
    <div className="kg-bar">
      <a className="kg-brand" href="/">
        <img className="kg-logo" src="/favicon.svg" alt="" width="26" height="26" />
        <span className="kg-brandname">Kiiro Games</span>
      </a>
      <div className="kg-tools">
        <LangSwitch />
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
      <CodeBoxes
        label={t('hdCode')}
        onDone={(c) => {
          location.href = roomUrl(c)
        }}
      />
    </div>
  )
}

/** The front page is a room you walk into: a lamplit table, the games sit around it like seats, and the middle of the table says what to do next. */
export function Hub() {
  const { t } = useLang()
  const [pick, setPick] = useState<GameKey | null>(null)
  const chosen = CATALOG.find((g) => g.id === pick)
  const seat = (g: (typeof CATALOG)[number]) => (
    <button key={g.id} className={'kg-obj' + (pick === g.id ? ' on' : '')} aria-pressed={pick === g.id} onClick={() => setPick(pick === g.id ? null : g.id)}>
      <span className="kg-medal">{ART[g.id]}</span>
      <b>{t(g.name)}</b>
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
                <span className="kg-acts">
                  <a className="kg-create" href={newRoomUrl(chosen.id)}>
                    {t('hubPlayFriends')}
                  </a>
                  {
                    <a className="kg-practice" href={practiceUrl(chosen.id)}>
                      {t('hubPractice')}
                    </a>
                  }
                  {playsOnOneDevice(chosen.id) && (
                    <a className="kg-practice" href={localUrl(chosen.id)}>
                      {t('hubLocal')}
                    </a>
                  )}
                </span>
                <button className="kg-close" onClick={() => setPick(null)}>
                  ← {t('acAll')}
                </button>
              </>
            ) : (
              <>
                <h1>{t('hubHeadline')}</h1>
                <a className="kg-create" href={newRoomUrl()}>
                  {t('hubCreateRoom')}
                </a>
                <JoinCode />
              </>
            )}
          </div>
          <div className="kg-shelf">{CATALOG.map(seat)}</div>
        </div>
        <section className="kg-board">
          <Leaderboard />
        </section>
      </main>
    </div>
  )
}
