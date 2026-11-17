import { useEffect, useState } from 'react'
import type { TableView } from '../engine/table'
import { kindOf } from '../engine/tiles'
import { useLang, yakuName } from '../i18n'
import { Modal } from './Panels'
import { Tile } from './Tile'

type Game = NonNullable<TableView['game']>

/** Step through every hand of a finished game: ponds and melds grow discard by discard, the last step shows the final hands. */
export function ReplayModal({ v, you, onClose }: { v: Game; you: number; onClose: () => void }) {
  const { lang, t } = useLang()
  const replays = v.replays ?? []
  const n = v.players.length
  const [hi, setHi] = useState(Math.max(0, replays.length - 1))
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const r = replays[hi]
  const total = r ? r.steps.length + 1 : 0 // + the final-hands step
  const last = step >= total - 1
  useEffect(() => { setStep(0); setPlaying(false) }, [hi])
  useEffect(() => {
    if (!playing) return
    if (last) { setPlaying(false); return }
    const i = setTimeout(() => setStep((s) => s + 1), 650)
    return () => clearTimeout(i)
  }, [playing, step, last])
  if (!r) return <Modal title={t('replay')} onClose={onClose}><p className="muted">{t('noHistory')}</p></Modal>
  const unit = t(v.rule.id === 'riichi' ? 'han' : v.rule.id === 'hk' ? 'fan' : 'tai')
  const s = r.steps[Math.min(step, r.steps.length - 1)]
  const atEnd = step === r.steps.length
  const round = t('roundName', { wind: t('wind.' + Math.min(3, Math.floor(r.roundIndex / n))), n: (r.roundIndex % n) + 1 })
  const who = r.kind === 'win'
    ? (r.tsumo ? t('winsTsumo', { name: v.players[r.winners[0]].name }) : t('winsRon', { name: v.players[r.winners[0]].name, from: r.from !== null ? v.players[r.from].name : '' }))
    : t('drawShort')
  const order = Array.from({ length: n }, (_, i) => (you + i) % n)
  return (
    <Modal title={t('replay')} onClose={onClose}>
      <div className="rp-hands">
        {replays.map((h, i) => <button key={i} className={'btn sm ' + (i === hi ? 'gold' : 'alt')} onClick={() => setHi(i)}>#{h.handNo}</button>)}
      </div>
      <div className="rp-head"><b>{round}</b> · {who}{r.kind === 'win' && r.total ? ` — ${r.total} ${unit}` : ''}</div>
      <div className="rp-board">
        {order.map((seat) => {
          const pl = v.players[seat]
          const snap = atEnd ? null : s?.p[seat]
          const hand = atEnd ? r.hands[seat] : null
          const active = !atEnd && s?.seat === seat
          return (
            <div key={seat} className={'rp-row' + (active ? ' on' : '')}>
              <div className="rp-name"><b>{pl.name}</b>{seat === you ? ` (${t('you')})` : ''}<span className="muted small"> {r.deltas[seat] >= 0 ? '+' : ''}{r.deltas[seat]}</span></div>
              <div className="rp-tiles">
                {(atEnd ? r.steps[r.steps.length - 1]?.p[seat].d ?? [] : snap!.d).map(([tile, riichi], i, arr) => (
                  <Tile key={i} id={tile} hot={active && i === arr.length - 1} className={riichi ? 'rp-riichi' : ''} />
                ))}
              </div>
              {(atEnd ? hand!.melds : snap!.m).length > 0 && (
                <div className="rp-melds">{(atEnd ? hand!.melds : snap!.m).map((m, i) => <span key={i} className="meld">{m.tiles.map((x) => <Tile key={x} id={x} />)}</span>)}</div>
              )}
              {hand && <div className="rp-final">{[...hand.hand].sort((a, b) => kindOf(a) - kindOf(b)).map((id) => <Tile key={id} id={id} hot={id === r.winTile && r.winners.includes(seat)} />)}</div>}
            </div>
          )
        })}
      </div>
      {atEnd && r.kind === 'win' && <div className="muted small">{r.yaku.map((y) => yakuName(y, lang)).join(' · ')}</div>}
      <div className="rp-ctl">
        <button className="btn sm alt" onClick={() => { setPlaying(false); setStep(0) }} aria-label={t('replayStart')}>⏮</button>
        <button className="btn sm alt" onClick={() => { setPlaying(false); setStep((x) => Math.max(0, x - 1)) }} aria-label={t('replayPrev')}>◀</button>
        <button className="btn sm gold" onClick={() => { if (last) setStep(0); setPlaying((p) => !p) }}>{playing ? '❚❚' : '▶'}</button>
        <button className="btn sm alt" onClick={() => { setPlaying(false); setStep((x) => Math.min(total - 1, x + 1)) }} aria-label={t('replayNext')}>▶▏</button>
        <input type="range" min={0} max={Math.max(0, total - 1)} value={step} onChange={(e) => { setPlaying(false); setStep(+e.target.value) }} aria-label={t('replay')} />
        <span className="muted small">{step + 1}/{total}</span>
      </div>
    </Modal>
  )
}
