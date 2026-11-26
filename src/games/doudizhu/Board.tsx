import { useEffect, useState } from 'react'
import { useLang } from '../../i18n'
import { Hotkeys, Kbd } from '../../ui/components'
import { Card } from '../holdem/ui/Cards'
import { classify as ddClassify, beats as ddBeats } from './engine'
import type { BoardProps } from '../frame/types'
import './strings'

/* ---------------------------------------------------------------- Dou Dizhu */
/** a Dou Dizhu card id (suit * 13 + rank from 3 up; 52 and 53 are the jokers) as a card face */
function DdCard({ c, small }: { c: number; small?: boolean }) {
  if (c >= 52)
    return (
      <span className={'pkcard joker' + (c === 53 ? ' big' : '') + (small ? ' small' : '')} aria-label={c === 53 ? 'Big joker' : 'Small joker'}>
        <b>{c === 53 ? '★' : '☆'}</b>
        <i>JOKER</i>
      </span>
    )
  return <Card c={Math.floor(c / 13) * 13 + (((c % 13) + 1) % 13)} small={small} />
}
export function DouBoard({ v, send, name }: BoardProps) {
  const { t } = useLang()
  const s = v.state as {
    phase: 'bid' | 'play'
    hand: number[]
    counts: number[]
    landlord: number
    bottom: number[]
    bids: (number | null)[]
    high: number
    last: { seat: number; cards: number[]; type: string } | null
    recent: ({ cards: number[] } | 'pass' | null)[]
    bombs: number
    hint: number[]
    winner: number
    hands: number[][] | null
  }
  const myTurn = v.status === 'playing' && v.turn === v.you
  const [sel, setSel] = useState<number[]>([])
  useEffect(() => {
    setSel([])
  }, [v.turn, v.game, s.hand.length])
  const chosen = sel.length ? ddClassify(sel) : null
  const lastCombo = s.last ? ddClassify(s.last.cards) : null
  const legal = !!chosen && ddBeats(chosen, lastCombo)
  const canPass = myTurn && s.phase === 'play' && !!s.last
  const play = () => {
    if (myTurn && legal) send({ k: 'act', a: { cards: sel } })
  }
  const pass = () => {
    if (canPass) send({ k: 'act', a: { pass: true } })
  }
  const hint = () => {
    if (s.hint.length) setSel(s.hint)
    else if (canPass) pass()
  }
  const toggle = (c: number) => {
    if (myTurn && s.phase === 'play') setSel((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))
  }
  const reason =
    !myTurn || s.phase !== 'play'
      ? ''
      : sel.length === 0
        ? !s.hint.length && canPass
          ? t('ddNothing')
          : s.last
            ? t('ddBeat', { name: name(v.seats[s.last.seat].name) })
            : t('ddYourLead')
        : !chosen
          ? t('ddNotAPlay')
          : !legal
            ? t('ddTooLow')
            : ''
  const role = (i: number) => (s.landlord < 0 ? '' : i === s.landlord ? t('ddLandlord') : t('ddFarmer'))
  const bidTxt = (b: number | null) => (b === null ? '' : b === 0 ? t('ddBidPass') : t('ddBidN', { n: b }))
  const keys: Record<string, (() => void) | undefined> = { enter: play, p: pass, h: hint, escape: () => setSel([]) }
  return (
    <div className="dd">
      <Hotkeys enabled={myTurn && s.phase === 'play'} keys={keys} />
      <div className="ddseats">
        {v.seats.map((x) => (
          <div key={x.seat} className={'ddp' + (v.turn === x.seat ? ' turn' : '') + (x.me ? ' me' : '')}>
            <b>{name(x.name)}</b>
            <span className="muted small">{s.phase === 'bid' ? bidTxt(s.bids[x.seat]) : role(x.seat)}</span>
            <span className="ddcount">{t('ddCards', { n: s.counts[x.seat] })}</span>
            {s.phase === 'play' && x.seat === s.landlord && (
              <span className="ddcrown" aria-hidden="true">
                ♛
              </span>
            )}
          </div>
        ))}
      </div>
      {s.phase === 'play' && s.bottom.length > 0 && (
        <div className="ddbottom">
          <span className="muted small">{t('ddBottom')}</span>
          <span className="ddrow">
            {s.bottom.map((c) => (
              <DdCard key={c} c={c} small />
            ))}
          </span>
        </div>
      )}
      <div className="ddtable k-felt">
        {s.phase === 'bid' ? (
          <span className="muted">{myTurn ? t('ddBid') : v.turn >= 0 ? name(v.seats[v.turn].name) + '…' : ''}</span>
        ) : (
          <div className="ddplays">
            {v.seats.map((x) => {
              const r = s.recent[x.seat]
              return (
                <div key={x.seat} className="ddplay">
                  <span className="muted small">{name(x.name)}</span>
                  <span className="ddrow">
                    {r === 'pass' ? <i className="muted small">{t('ddPassed')}</i> : r && r.cards ? r.cards.map((c) => <DdCard key={c} c={c} small />) : null}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        {s.bombs > 0 && <span className="muted small">{t('ddBombs', { n: s.bombs })}</span>}
      </div>
      {v.you >= 0 && s.phase === 'bid' && myTurn && (
        <div className="ddbid">
          {[1, 2, 3].map((n) => (
            <button key={n} className="hdbtn primary" disabled={n <= s.high} onClick={() => send({ k: 'act', a: { bid: n } })}>
              {t('ddBidN', { n })}
            </button>
          ))}
          <button className="hdbtn" onClick={() => send({ k: 'act', a: { bid: 0 } })}>
            {t('ddPass')}
          </button>
        </div>
      )}
      {v.you >= 0 && s.phase === 'play' && myTurn && (
        <div className="ddctl">
          <div className="muted small" aria-live="polite">
            {reason}
          </div>
          <div className="ddbtns">
            <button className="hdbtn primary" disabled={!legal} onClick={play}>
              {t('ddPlay')}
              <Kbd k="↵" />
            </button>
            <button className={'hdbtn' + (canPass && !s.hint.length ? ' primary' : '')} disabled={!canPass} onClick={pass}>
              {t('ddPassTurn')}
              <Kbd k="P" />
            </button>
            <button className="hdbtn" onClick={hint}>
              {t('ddHint')}
              <Kbd k="H" />
            </button>
            {sel.length > 0 && (
              <button className="hdbtn quiet" onClick={() => setSel([])}>
                {t('ddClear')}
              </button>
            )}
          </div>
        </div>
      )}
      {v.you >= 0 && (
        <div className="ddhand" role="group">
          {s.hand.map((c) => (
            <button key={c} className={'ddcard' + (sel.includes(c) ? ' sel' : '')} onClick={() => toggle(c)} aria-pressed={sel.includes(c)}>
              <DdCard c={c} />
            </button>
          ))}
        </div>
      )}
      {v.status === 'over' && s.winner >= 0 && <p className="muted small">{s.winner === s.landlord ? t('ddWinL') : t('ddWinF')}</p>}
    </div>
  )
}
