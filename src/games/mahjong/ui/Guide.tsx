import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../../../i18n'
import { Tile } from './Tile'
import { LESSONS, type Pic } from './guideLessons'

const TOKENS = /(\d+)([mpsz])/g
const groupsOf = (notation: string): number[][] =>
  [...notation.matchAll(TOKENS)].map((m) => {
    const base = { m: 0, p: 9, s: 18, z: 27 }[m[2] as 'm' | 'p' | 's' | 'z']
    return [...m[1]].map((d) => base + +d - 1)
  })

function Picture({ pic, L }: { pic: Pic; L: number }) {
  const hot = pic.hot ? groupsOf(pic.hot)[0]?.[0] : undefined
  return (
    <figure className="gpic">
      <div className="exrow">
        {groupsOf(pic.tiles).map((g, gi) => <span className="exgroup" key={gi}>{g.map((k, ki) => <Tile key={ki} kind={k} />)}</span>)}
        {hot !== undefined && <><span className="explus">←</span><span className="exgroup"><Tile kind={hot} hot /></span></>}
      </div>
      {pic.caption && <figcaption className="muted small">{pic.caption[L]}</figcaption>}
    </figure>
  )
}

/** Step-by-step "How to play" lessons: tiles, sets, a turn, calls, winning, waits, scoring, safety, the first game. */
export function Guide({ onClose, onPractice }: { onClose: () => void; onPractice?: () => void }) {
  const { lang, t } = useLang()
  const L = lang === 'zh' ? 1 : lang === 'ja' ? 2 : 0
  const [i, setI] = useState(0)
  const lesson = LESSONS[i]
  const last = i === LESSONS.length - 1
  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="modal guide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('guideBtn')}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>{t('guideBtn')}</h2>
          <button className="btn sm alt" onClick={onClose}>{t('close')}</button>
        </div>
        <div className="gsteps" role="tablist">
          {LESSONS.map((l, k) => (
            <button key={k} role="tab" aria-selected={k === i} className={'gstep' + (k === i ? ' on' : k < i ? ' done' : '')} onClick={() => setI(k)} title={l.title[L]}>{k + 1}</button>
          ))}
        </div>
        <div className="gbody">
        <div className="muted small">{t('guideLesson', { n: i + 1, total: LESSONS.length })}</div>
        <h3 className="gtitle">{lesson.title[L]}</h3>
        {lesson.text.map((p, k) => <p key={k} className="gtext">{p[L]}</p>)}
        {lesson.pics?.map((pic, k) => <Picture key={k} pic={pic} L={L} />)}
        {lesson.tip && <div className="gtip"><b>{t('guideTip')}</b> {lesson.tip[L]}</div>}
        </div>
        <div className="gnav">
          <button className="btn alt" disabled={i === 0} onClick={() => setI(i - 1)}>{t('guidePrev')}</button>
          {last
            ? <button className="btn gold" onClick={() => { onClose(); onPractice?.() }}>{onPractice ? t('guidePractice') : t('close')}</button>
            : <button className="btn gold" onClick={() => setI(i + 1)}>{t('guideNext')}</button>}
        </div>
      </div>
    </div>,
    document.body,
  )
}
