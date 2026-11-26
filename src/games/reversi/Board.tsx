import { useLang } from '../../i18n'
import type { BoardProps } from '../frame/types'
import './strings'
import './styles.css'

/* ---------------------------------------------------------------- Reversi */
export function ReversiBoard({ v, send }: BoardProps) {
  const { t } = useLang()
  const s = v.state as { board: number[]; black: number; last: number; passed: boolean; counts: [number, number]; legal: number[] }
  const mine = v.you < 0 ? 0 : v.you === s.black ? 1 : 2
  const myTurn = v.status === 'playing' && v.turn === v.you
  const ok = new Set(myTurn ? s.legal : [])
  const side = (c: number) => (c === 1 ? t('rvBlack') : t('rvWhite'))
  return (
    <div className="gmwrap">
      <div className="gmside" aria-live="polite">
        {mine > 0 && (!v.local || v.status === 'playing') && (
          <span className="gmchip">
            <i className={'gmstone s' + mine} aria-hidden="true" />
            {t(v.local ? 'chToMove' : 'rvYouAre', { side: side(mine) })}
          </span>
        )}
        <span className="gmchip">
          <i className="gmstone s1" aria-hidden="true" />
          {s.counts[0]}
        </span>
        <span className="gmchip">
          <i className="gmstone s2" aria-hidden="true" />
          {s.counts[1]}
        </span>
      </div>
      <div className="rvboard" role="grid" aria-label={t('reversi')}>
        {s.board.map((c, i) => {
          const x = i % 8,
            y = Math.floor(i / 8)
          return (
            <button
              key={i}
              className={'rvsq' + (ok.has(i) ? ' ok' : '') + (s.last === i ? ' last' : '')}
              disabled={!ok.has(i)}
              onClick={() => send({ k: 'act', a: { x, y } })}
              aria-label={`${x + 1},${y + 1}`}
            >
              {c > 0 && <i className={'rvdisc s' + c} />}
            </button>
          )
        })}
      </div>
      {s.passed && v.status === 'playing' && <p className="muted small">{t('rvPassed')}</p>}
    </div>
  )
}
