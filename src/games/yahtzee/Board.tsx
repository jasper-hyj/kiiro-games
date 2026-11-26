import { useEffect, useState } from 'react'
import { useLang } from '../../i18n'
import { Hotkeys, Kbd } from '../../ui/components'
import { CATS } from './engine'
import type { BoardProps } from '../frame/types'
import { PIPS } from '../frame/dice'
import './strings'
import './styles.css'

/* ---------------------------------------------------------------- Yahtzee */
function Die({ n, held, live, onClick }: { n: number; held: boolean; live: boolean; onClick(): void }) {
  return (
    <button className={'yzdie' + (held ? ' held' : '') + (live ? ' live' : '')} disabled={!live} onClick={onClick} aria-pressed={held} aria-label={String(n)}>
      {n > 0 && Array.from({ length: 9 }, (_, i) => <i key={i} className={PIPS[n].includes(i) ? 'on' : ''} />)}
    </button>
  )
}
export function YahtzeeBoard({ v, send, name }: BoardProps) {
  const { t } = useLang()
  const s = v.state as {
    dice: number[]
    rolls: number
    round: number
    sheets: (number | null)[][]
    totals: { upper: number; bonus: number; yahtzeeBonus: number; total: number }[]
    options: Record<string, number>
    last: { seat: number; cat: string; points: number } | null
    joker: boolean
  }
  const myTurn = v.status === 'playing' && v.turn === v.you
  const [held, setHeld] = useState<boolean[]>([false, false, false, false, false])
  useEffect(() => {
    setHeld([false, false, false, false, false])
  }, [v.turn, s.rolls === 0, v.game])
  const dice = s.dice.length === 5 ? s.dice : [0, 0, 0, 0, 0]
  const canRoll = myTurn && s.rolls < 3
  const roll = () => {
    if (canRoll) send({ k: 'act', a: { roll: true, held } })
  }
  const toggle = (i: number) => {
    if (myTurn && s.rolls > 0 && s.rolls < 3) setHeld((h) => h.map((x, k) => (k === i ? !x : x)))
  }
  const score = (cat: string) => {
    if (myTurn && s.rolls > 0 && cat in s.options) send({ k: 'act', a: { score: cat } })
  }
  const keys: Record<string, (() => void) | undefined> = { r: roll, enter: roll }
  for (let i = 0; i < 5; i++) keys[String(i + 1)] = () => toggle(i)
  const upper = CATS.slice(0, 6),
    lower = CATS.slice(6)
  const cell = (seat: number, cat: string, idx: number) => {
    const val = s.sheets[seat]?.[idx]
    if (val !== null && val !== undefined)
      return (
        <td key={seat} className={'yzv' + (seat === v.you ? ' me' : '')}>
          {val}
        </td>
      )
    if (seat === v.you && myTurn && cat in s.options)
      return (
        <td key={seat} className="yzv me opt">
          <button onClick={() => score(cat)} aria-label={`${t('yz.' + cat)} ${s.options[cat]}`}>
            {s.options[cat]}
          </button>
        </td>
      )
    return <td key={seat} className={'yzv' + (seat === v.you ? ' me' : '')} />
  }
  const row = (cat: string, idx: number) => (
    <tr key={cat}>
      <th>{t('yz.' + cat)}</th>
      {v.seats.map((x) => cell(x.seat, cat, idx))}
    </tr>
  )
  const last = s.last ? t('yzLast', { name: name(v.seats[s.last.seat].name), n: s.last.points, cat: t('yz.' + s.last.cat) }) : ''
  return (
    <div className="yz">
      <Hotkeys enabled={myTurn} keys={keys} />
      <div className="muted small">
        {t('yzRound', { n: s.round })}
        {last ? ` · ${last}` : ''}
      </div>
      <div className="yzdice k-felt">
        <div className="yzrow">
          {dice.map((d, i) => (
            <Die key={i} n={d} held={held[i] && s.rolls > 0} live={myTurn && s.rolls > 0 && s.rolls < 3} onClick={() => toggle(i)} />
          ))}
        </div>
        {v.you >= 0 && (
          <div className="yzctl">
            <button className="hdbtn primary" disabled={!canRoll} onClick={roll}>
              {t('yzRoll')}
              <Kbd k="R" />
            </button>
            <span className="muted small">
              {myTurn ? (s.rolls === 0 ? t('yzFirst') : s.rolls < 3 ? `${t('yzRollsLeft', { n: 3 - s.rolls })} · ${t('yzHold')}` : t('yzScoreIt')) : ''}
            </span>
          </div>
        )}
        {myTurn && s.joker && <p className="muted small">{t('yzJoker')}</p>}
      </div>
      <div className="yzsheet">
        <table>
          <thead>
            <tr>
              <th />
              {v.seats.map((x) => (
                <th key={x.seat} className={x.me ? 'me' : v.turn === x.seat ? 'turn' : ''}>
                  {name(x.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {upper.map((c, i) => row(c, i))}
            <tr className="sub">
              <th>{t('yzUpper')}</th>
              {v.seats.map((x) => (
                <td key={x.seat}>{s.totals[x.seat].upper}</td>
              ))}
            </tr>
            <tr className="sub">
              <th>{t('yzBonus')}</th>
              {v.seats.map((x) => (
                <td key={x.seat}>{s.totals[x.seat].bonus || ''}</td>
              ))}
            </tr>
            {lower.map((c, i) => row(c, i + 6))}
            <tr className="sub">
              <th>{t('yzYBonus')}</th>
              {v.seats.map((x) => (
                <td key={x.seat}>{s.totals[x.seat].yahtzeeBonus || ''}</td>
              ))}
            </tr>
            <tr className="tot">
              <th>{t('yzTotal')}</th>
              {v.seats.map((x) => (
                <td key={x.seat}>{s.totals[x.seat].total}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
