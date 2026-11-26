import { useEffect, useState } from 'react'
import { useLang } from '../../i18n'
import { Resign } from '../frame/Resign'
import type { BoardProps } from '../frame/types'
import './strings'
import './styles.css'

/* ---------------------------------------------------------------- Checkers */
export function CheckersBoard({ v, send }: BoardProps) {
  const { t } = useLang()
  const s = v.state as {
    board: number[]
    first: number
    last: number[] | null
    moves: { from: number; to: number; via: number[]; caps: number[] }[]
    quiet: number
  }
  const side = v.you < 0 ? 0 : v.you === s.first ? 0 : 1
  const myTurn = v.status === 'playing' && v.turn === v.you
  const [sel, setSel] = useState<number | null>(null)
  useEffect(() => {
    setSel(null)
  }, [s.board.join(''), v.game])
  const froms = new Set(myTurn ? s.moves.map((m) => m.from) : [])
  const dests = sel === null ? [] : s.moves.filter((m) => m.from === sel)
  const flip = !v.local && side === 1
  const order = Array.from({ length: 64 }, (_, i) => (flip ? 63 - i : i))
  const tap = (i: number) => {
    if (!myTurn) return
    const hit = dests.find((m) => m.to === i)
    if (hit) {
      send({ k: 'act', a: { from: hit.from, to: hit.to, via: hit.via } })
      setSel(null)
      return
    }
    setSel(froms.has(i) && i !== sel ? i : null)
  }
  const mustCapture = myTurn && s.moves.some((m) => m.caps.length > 0)
  return (
    <div className="gmwrap">
      <div className="gmside" aria-live="polite">
        {v.you >= 0 && (!v.local || v.status === 'playing') && (
          <span className="gmchip">
            <i className={'ckdot p' + (side === 0 ? 1 : 3)} aria-hidden="true" />
            {t(v.local ? 'chToMove' : 'ckYouAre', { side: side === 0 ? t('ckRed') : t('ckIvory') })}
          </span>
        )}
        {mustCapture && <b>{t('ckMust')}</b>}
      </div>
      <div className="ckboard" role="grid" aria-label={t('checkers')}>
        {order.map((i) => {
          const x = i % 8,
            y = Math.floor(i / 8),
            dark = (x + y) % 2 === 1,
            p = s.board[i]
          const last = s.last && (s.last[0] === i || s.last[s.last.length - 1] === i)
          const isDest = dests.some((m) => m.to === i)
          return (
            <button
              key={i}
              className={
                'cksq' + (dark ? ' dark' : '') + (sel === i ? ' sel' : '') + (last ? ' last' : '') + (isDest ? ' tgt' : '') + (froms.has(i) ? ' mv' : '')
              }
              disabled={!dark || !myTurn}
              onClick={() => tap(i)}
              aria-label={`${x + 1},${y + 1}`}
            >
              {p > 0 && <i className={'ckp p' + p}>{p === 2 || p === 4 ? '♛' : ''}</i>}
            </button>
          )
        })}
      </div>
      <div className="chfoot">
        {myTurn && !sel && <span className="muted small">{t('ckSelect')}</span>}
        {v.you >= 0 && v.status === 'playing' && <Resign send={send} />}
      </div>
    </div>
  )
}
