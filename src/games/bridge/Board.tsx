import { useLang } from '../../i18n'
import { Card } from '../holdem/ui/Cards'
import type { BoardProps } from '../frame/types'
import './strings'

/* ---------------------------------------------------------------- Bridge */
const STRAIN = ['♣', '♦', '♥', '♠', 'NT']
const STRAIN_RED = [false, true, true, false, false]
const BR_SEAT_KEYS = ['brSeatS', 'brSeatW', 'brSeatN', 'brSeatE']
type BrCall = { t: 'pass' } | { t: 'x' } | { t: 'xx' } | { t: 'bid'; level: number; strain: number }
export function BridgeBoard({ v, send, name }: BoardProps) {
  const { t } = useLang()
  const s = v.state as {
    phase: 'bid' | 'play' | 'done'
    dealer: number
    calls: { seat: number; call: BrCall }[]
    contract: { level: number; strain: number; declarer: number; doubled: number } | null
    mine: number[]
    dummy: { seat: number; cards: number[] } | null
    trick: { seat: number; card: number }[]
    last: { seat: number; card: number }[]
    tricks: number[]
    controls: number[]
    mover: number
    canMove: boolean
    legal: number[]
    minBid: number
    canX: boolean
    canXX: boolean
    counts: number[]
    hands: number[][] | null
    score: number | null
  }
  const you = Math.max(0, v.you)
  const pos = (seat: number) => (seat - you + 4) % 4 // 0 bottom, 1 left, 2 top, 3 right
  const seatName = (seat: number) => (seat === v.you ? t('brYou') : seat === (you + 2) % 4 && v.you >= 0 ? t('brPartner') : name(v.seats[seat].name))
  const dir = (seat: number) => t(BR_SEAT_KEYS[seat])
  const callText = (c: BrCall) =>
    c.t === 'pass' ? (
      t('brPass')
    ) : c.t === 'x' ? (
      'X'
    ) : c.t === 'xx' ? (
      'XX'
    ) : (
      <span className={STRAIN_RED[c.strain] ? 'brred' : ''}>
        {c.level}
        {STRAIN[c.strain]}
      </span>
    )
  const sortHand = (cards: number[]) =>
    [...cards].sort((a, b) => [3, 2, 1, 0].indexOf(Math.floor(a / 13)) - [3, 2, 1, 0].indexOf(Math.floor(b / 13)) || (b % 13) - (a % 13))
  const dummySeat = s.contract ? (s.contract.declarer + 2) % 4 : -1
  const canPlay = (c: number) => s.canMove && s.legal.includes(c)
  const play = (c: number) => {
    if (canPlay(c)) send({ k: 'act', a: { card: c } })
  }
  const hands: Record<number, number[]> = { [you]: s.mine }
  if (s.dummy) hands[s.dummy.seat] = s.dummy.cards
  if (s.hands) for (let i = 0; i < 4; i++) hands[i] = s.hands[i]
  const handRow = (seat: number, mine: boolean) => {
    const cs = sortHand(hands[seat] ?? [])
    const live = s.phase === 'play' && s.canMove && s.mover === seat
    return (
      <div className={'brhand' + (mine ? ' mine' : '')}>
        {cs.map((c) => (
          <button
            key={c}
            className={'brcard' + (live && canPlay(c) ? ' ok' : '') + (live && !canPlay(c) ? ' dim' : '')}
            disabled={!(live && canPlay(c))}
            onClick={() => play(c)}
          >
            <Card c={c} />
          </button>
        ))}
      </div>
    )
  }
  const shownSeats = (p: number) => {
    const seat = (you + p) % 4
    return hands[seat] ? (
      handRow(seat, p === 0)
    ) : (
      <span className="brbacks">
        {Array.from({ length: Math.min(13, s.counts[seat] ?? 0) }, (_, i) => (
          <i key={i} className="pkcard back small" />
        ))}
      </span>
    )
  }
  const contractText = s.contract ? (
    <>
      {s.contract.level}
      <span className={STRAIN_RED[s.contract.strain] ? 'brred' : ''}>{STRAIN[s.contract.strain]}</span>
      {s.contract.doubled === 1 ? ' X' : s.contract.doubled === 2 ? ' XX' : ''}
    </>
  ) : null
  const myBid = v.status === 'playing' && s.phase === 'bid' && s.canMove
  const line =
    s.phase === 'bid'
      ? myBid
        ? t('brYourCall')
        : v.turn >= 0
          ? t('brWait', { name: dir(v.turn) })
          : ''
      : s.phase === 'play'
        ? s.canMove
          ? s.mover === dummySeat && s.mover !== v.you
            ? t('brPlayDummy')
            : t('brYourPlay')
          : t('brWait', { name: dir(s.mover) })
        : ''
  const rows: { seat: number; call: BrCall | null }[][] = []
  {
    const cells: { seat: number; call: BrCall | null }[] = []
    for (let i = 0; i < s.dealer; i++) cells.push({ seat: i, call: null })
    for (const c of s.calls) cells.push(c)
    for (let i = 0; i < cells.length; i += 4) rows.push(cells.slice(i, i + 4))
  }
  const ourSide = (seat: number) => seat % 2 === you % 2
  const made = s.contract ? s.tricks[s.contract.declarer % 2] : 0
  return (
    <div className="br">
      <div className="gmside" aria-live="polite">
        {s.contract && (
          <span className="gmchip">
            {t('brContract')}: {contractText} · {t('brDeclarer')} {dir(s.contract.declarer)}
          </span>
        )}
        <span className="muted small">
          {t('brTricksNS', { a: s.tricks[0] })} · {t('brTricksEW', { a: s.tricks[1] })}
        </span>
      </div>
      <div className="brline">{line}</div>
      {s.phase !== 'bid' || s.calls.length > 0 ? (
        <div className="brtable k-felt">
          <div className="brtop">
            <b>{seatName((you + 2) % 4)}</b>
            {s.phase === 'play' || s.phase === 'done' ? shownSeats(2) : null}
          </div>
          <div className="brmid">
            <div className="brside left">
              <b>{seatName((you + 1) % 4)}</b>
              {s.phase !== 'bid' ? shownSeats(1) : null}
            </div>
            <div className="brtrick">
              {s.phase === 'bid' ? (
                <div className="brauction">
                  <div className="brahead">
                    {[0, 1, 2, 3].map((i) => (
                      <b key={i} className={ourSide(i) ? 'us' : ''}>
                        {dir(i)}
                      </b>
                    ))}
                  </div>
                  {rows.map((r, ri) => (
                    <div key={ri} className="brarow">
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i}>{r[i]?.call ? callText(r[i].call!) : ''}</span>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="brcross">
                  {[2, 1, 3, 0].map((p) => {
                    const seat = (you + p) % 4
                    const x = s.trick.find((y) => y.seat === seat)
                    return (
                      <span key={p} className={'brslot p' + p}>
                        {x ? <Card c={x.card} /> : null}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="brside right">
              <b>{seatName((you + 3) % 4)}</b>
              {s.phase !== 'bid' ? shownSeats(3) : null}
            </div>
          </div>
        </div>
      ) : null}
      {myBid && (
        <div className="brbox">
          <div className="brgrid">
            {[1, 2, 3, 4, 5, 6, 7].map((l) => (
              <div key={l} className="brrow">
                {[0, 1, 2, 3, 4].map((st) => (
                  <button
                    key={st}
                    className={STRAIN_RED[st] ? 'brred' : ''}
                    disabled={l * 5 + st < s.minBid}
                    onClick={() => send({ k: 'act', a: { call: { level: l, strain: st } } })}
                  >
                    {l}
                    {STRAIN[st]}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="brbtns">
            <button className="hdbtn" onClick={() => send({ k: 'act', a: { call: 'pass' } })}>
              {t('brPass')}
            </button>
            <button className="hdbtn" disabled={!s.canX} onClick={() => send({ k: 'act', a: { call: 'x' } })}>
              {t('brDouble')}
            </button>
            <button className="hdbtn" disabled={!s.canXX} onClick={() => send({ k: 'act', a: { call: 'xx' } })}>
              {t('brRedouble')}
            </button>
          </div>
        </div>
      )}
      {v.you >= 0 && (s.phase === 'play' || s.phase === 'done') ? null : null}
      {v.you >= 0 && (
        <div className="brmine">
          {handRow(you, true)}
          {you === dummySeat && s.phase === 'play' && <span className="muted small">{t('brDummy')}</span>}
        </div>
      )}
      {s.phase === 'done' && s.contract && (
        <p className="muted small">
          {t('brResult', {
            contract: `${s.contract.level}${STRAIN[s.contract.strain]}${s.contract.doubled === 1 ? ' X' : s.contract.doubled === 2 ? ' XX' : ''}`,
            declarer: dir(s.contract.declarer),
            made: made,
            score: `${(s.score ?? 0) > 0 ? t('brTricksNS', { a: '+' + s.score }) : t('brTricksEW', { a: '+' + -(s.score ?? 0) })}`,
          })}
        </p>
      )}
      {s.phase === 'done' && !s.contract && <p className="muted small">{t('brPassedOut')}</p>}
    </div>
  )
}
