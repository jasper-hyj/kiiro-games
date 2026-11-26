import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../../i18n'
import { Hotkeys, Kbd } from '../../ui/components'
import { Card } from '../holdem/ui/Cards'
import { rankOf, suitOf, SUITS } from '../holdem/engine/cards'
import type { BoardProps } from '../frame/types'
import './strings'
import './styles.css'

/* ---------------------------------------------------------------- Crazy Eights */
const SUIT_RED = [false, true, true, false]
export function CrazyBoard({ v, send, name }: BoardProps) {
  const { t } = useLang()
  const s = v.state as {
    hand: number[]
    counts: number[]
    top: number
    suit: number
    dir: 1 | -1
    drawCount: number
    drew: boolean
    playable: number[]
    last: { seat: number; what: string; card?: number } | null
    winner: number
    hands: number[][] | null
  }
  const myTurn = v.status === 'playing' && v.turn === v.you
  const [choose, setChoose] = useState<number | null>(null)
  useEffect(() => {
    setChoose(null)
  }, [v.turn, v.game])
  const hand = useMemo(() => [...s.hand].sort((a, b) => suitOf(a) - suitOf(b) || rankOf(a) - rankOf(b)), [s.hand])
  const ok = new Set(s.playable)
  const canDraw = myTurn && !s.drew
  const mustPass = myTurn && s.drew && s.playable.length === 0
  const play = (c: number) => {
    if (!myTurn || !ok.has(c)) return
    if (rankOf(c) === 6) setChoose(c)
    else send({ k: 'act', a: { card: c } })
  }
  const draw = () => {
    if (canDraw) send({ k: 'act', a: { draw: true } })
  }
  const pass = () => {
    if (mustPass) send({ k: 'act', a: { pass: true } })
  }
  const last = s.last ? (
    s.last.what === 'play' ? (
      <>
        {t('c8LastPlay', { name: name(v.seats[s.last.seat].name) })} <Card c={s.last.card} small />
      </>
    ) : s.last.what === 'draw' ? (
      t('c8LastDraw', { name: name(v.seats[s.last.seat].name) })
    ) : (
      t('c8LastPass', { name: name(v.seats[s.last.seat].name) })
    )
  ) : null
  return (
    <div className="c8">
      <Hotkeys enabled={myTurn} keys={{ d: draw, p: pass }} />
      <div className="c8others">
        {v.seats
          .filter((x) => !x.me)
          .map((x) => (
            <div key={x.seat} className={'c8opp' + (v.turn === x.seat ? ' turn' : '')}>
              <b>{name(x.name)}</b>
              <span className="c8fan">
                {Array.from({ length: Math.min(s.counts[x.seat], 9) }, (_, i) => (
                  <i key={i} className="pkcard back small" />
                ))}
              </span>
              <span className="muted small">{s.counts[x.seat] === 1 ? t('c8Card1') : t('c8Cards', { n: s.counts[x.seat] })}</span>
            </div>
          ))}
      </div>
      <div className="c8table k-felt">
        <button className={'c8pile' + (canDraw ? ' live' : '')} disabled={!canDraw} onClick={draw} aria-label={t('c8Draw')}>
          <Card back />
          <span className="c8count">{s.drawCount}</span>
          <span className="c8lbl">
            {t('c8Draw')}
            <Kbd k="D" />
          </span>
        </button>
        <div className="c8top">
          <Card c={s.top} />
          <span className={'c8suit' + (SUIT_RED[s.suit] ? ' red' : '')} title={t('c8Suit')}>
            {SUITS[s.suit]}
          </span>
          <span className="c8lbl">{t('c8Top')}</span>
        </div>
        <div className="c8dir" title={t('c8Dir')} aria-hidden="true">
          {s.dir === 1 ? '↻' : '↺'}
        </div>
      </div>
      <div className="c8last muted small" aria-live="polite">
        {last}
      </div>
      {v.you >= 0 && (
        <>
          <div className="c8msg">
            {myTurn ? (mustPass ? t('c8DrewNone') : t('c8Playable')) : ''}
            {mustPass && (
              <button className="hdbtn primary" onClick={pass}>
                {t('c8Pass')}
                <Kbd k="P" />
              </button>
            )}
          </div>
          <div className="c8hand" role="group" aria-label={t('c8Hand')}>
            {hand.map((c) => (
              <button
                key={c}
                className={'c8card' + (ok.has(c) && myTurn ? ' ok' : '') + (myTurn && !ok.has(c) ? ' dim' : '')}
                disabled={!myTurn || !ok.has(c)}
                onClick={() => play(c)}
              >
                <Card c={c} />
              </button>
            ))}
          </div>
        </>
      )}
      {choose !== null && (
        <div className="acmodal" onClick={() => setChoose(null)}>
          <div className="acbox" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('c8Choose')}>
            <h2>{t('c8Choose')}</h2>
            <div className="c8suits">
              {[0, 1, 2, 3].map((u) => (
                <button
                  key={u}
                  className={SUIT_RED[u] ? 'red' : ''}
                  onClick={() => {
                    send({ k: 'act', a: { card: choose, suit: u } })
                    setChoose(null)
                  }}
                >
                  {SUITS[u]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
