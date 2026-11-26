import { useEffect, useState } from 'react'
import { useLang } from '../../i18n'
import { Hotkeys, Kbd } from '../../ui/components'
import type { BoardProps } from '../frame/types'
import { PIPS } from '../frame/dice'
import './strings'
import './styles.css'

/* ---------------------------------------------------------------- Liar's Dice */
function MiniDie({ n, size = 34 }: { n: number; size?: number }) {
  return (
    <span className="ldmini" style={{ width: size, height: size, ['--s' as string]: `${size}px` }} aria-label={String(n)}>
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={PIPS[n]?.includes(i) ? 'on' : ''} />
      ))}
    </span>
  )
}
export function LiarsBoard({ v, send, name }: BoardProps) {
  const { t } = useLang()
  const s = v.state as {
    left: number[]
    mine: number[]
    bid: { seat: number; qty: number; face: number } | null
    round: number
    reveal: { bid: { seat: number; qty: number; face: number }; caller: number; dice: number[][]; total: number; liar: boolean; loser: number } | null
    out: number[]
    wild: boolean
    total: number
    dice: number[][] | null
  }
  const myTurn = v.status === 'playing' && v.turn === v.you
  const minQty = (face: number) => (!s.bid ? 1 : face > s.bid.face ? s.bid.qty : s.bid.qty + 1)
  const [face, setFace] = useState(2)
  const [qty, setQty] = useState(1)
  const bidKey = s.bid ? `${s.bid.qty}-${s.bid.face}` : 'none'
  // after every bid, offer the smallest raise: the next face up, or one more die when the face is already a six
  useEffect(() => {
    if (!s.bid) {
      setFace(2)
      setQty(1)
    } else if (s.bid.face < 6) {
      setFace(s.bid.face + 1)
      setQty(s.bid.qty)
    } else {
      setFace(6)
      setQty(s.bid.qty + 1)
    }
  }, [bidKey, v.game])
  const q = Math.min(s.total, Math.max(qty, minQty(face)))
  const bid = () => {
    if (myTurn) send({ k: 'act', a: { qty: q, face } })
  }
  const liar = () => {
    if (myTurn && s.bid) send({ k: 'act', a: { liar: true } })
  }
  const nm = (seat: number) => name(v.seats[seat].name)
  const rv = s.reveal
  return (
    <div className="ld">
      <Hotkeys enabled={myTurn} keys={{ l: liar, enter: bid, arrowup: () => setQty(q + 1), arrowdown: () => setQty(Math.max(minQty(face), q - 1)) }} />
      <div className="ldplayers">
        {v.seats.map((x) => (
          <div key={x.seat} className={'ldp' + (v.turn === x.seat ? ' turn' : '') + (s.left[x.seat] === 0 ? ' out' : '') + (x.me ? ' me' : '')}>
            <b>{name(x.name)}</b>
            <span className="ldcup">{s.left[x.seat] === 0 ? t('ldOutTag') : Array.from({ length: s.left[x.seat] }, (_, i) => <i key={i} />)}</span>
            <span className="muted small">{t('ldLeft', { n: s.left[x.seat] })}</span>
          </div>
        ))}
      </div>
      <div className="ldbid k-felt" aria-live="polite">
        <span className="muted small">
          {t('ldRound', { n: s.round })}
          {s.wild ? ` · ${t('ldWildNote')}` : ''}
        </span>
        {s.bid ? (
          <div className="ldbidline">
            <span>{nm(s.bid.seat)}</span>
            <b>{s.bid.qty} ×</b>
            <MiniDie n={s.bid.face} size={44} />
          </div>
        ) : v.status === 'playing' ? (
          <span>{t('ldNoBid')}</span>
        ) : null}
      </div>
      {rv && (
        <div className="ldreveal">
          <b>{t('ldRevealTitle')}</b>
          <p className="small">
            {t('ldReveal', { caller: nm(rv.caller), bidder: nm(rv.bid.seat), qty: rv.bid.qty, face: rv.bid.face, total: rv.total, loser: nm(rv.loser) })}
          </p>
          <div className="ldrows">
            {rv.dice.map((d, i) =>
              d.length ? (
                <div key={i} className="ldrow">
                  <span className="small">{nm(i)}</span>
                  <span>
                    {d.map((x, k) => (
                      <i key={k} className={'ldr' + (x === rv.bid.face || (s.wild && rv.bid.face !== 1 && x === 1) ? ' hit' : '')}>
                        <MiniDie n={x} size={26} />
                      </i>
                    ))}
                  </span>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}
      {v.you >= 0 && s.mine.length > 0 && (
        <div className="ldmine">
          <span className="muted small">{t('ldYourDice')}</span>
          <div className="yzrow">
            {s.mine.map((d, i) => (
              <MiniDie key={i} n={d} size={46} />
            ))}
          </div>
        </div>
      )}
      {myTurn && (
        <div className="ldctl">
          <div className="ldqty">
            <button onClick={() => setQty(Math.max(minQty(face), q - 1))} aria-label="−">
              −
            </button>
            <b>{q}</b>
            <button onClick={() => setQty(Math.min(s.total, q + 1))} aria-label="+">
              +
            </button>
          </div>
          <div className="ldfaces" role="group" aria-label={t('ldFace')}>
            {[1, 2, 3, 4, 5, 6].map((f) => (
              <button
                key={f}
                className={f === face ? 'on' : ''}
                onClick={() => {
                  setFace(f)
                  setQty(Math.max(minQty(f), q))
                }}
                aria-pressed={f === face}
              >
                <MiniDie n={f} size={36} />
              </button>
            ))}
          </div>
          <div className="ldbtns">
            <button className="hdbtn primary" onClick={bid}>
              {t('ldBid')} {q} × {face}
              <Kbd k="↵" />
            </button>
            {s.bid && (
              <button className="hdbtn" onClick={liar}>
                {t('ldLiar')}
                <Kbd k="L" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
