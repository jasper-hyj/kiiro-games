import type { TableView } from '../engine/table'
import type { ClientMsg } from '../net/protocol'
import { Tile } from './Tile'
import { kindOf } from '../engine/tiles'

export function ResultModal({ view, send, onLeave }: { view: TableView; send: (m: ClientMsg) => void; onLeave: () => void }) {
  const v = view.game!
  const r = v.result
  const you = view.you
  const unit = v.rule.id === 'riichi' ? 'han' : v.rule.id === 'hk' ? 'fan' : 'tai'
  const over = v.phase === 'over'
  const acked = v.acks.includes(you)

  const DeltaGrid = () => (
    <div className="deltas">
      {v.players.map((p, i) => {
        const d = r?.deltas[i] ?? 0
        return <div key={i}><b>{p.name}</b><br />{p.points}{r && <span className={d >= 0 ? 'pos' : 'neg'}> ({d >= 0 ? '+' : ''}{d})</span>}</div>
      })}
    </div>
  )

  if (over) {
    return (
      <div className="overlay"><div className="modal">
        <h2>Game over</h2>
        <ol>{v.standings.map((s) => <li key={s.seat}><b>{s.name}</b> — {s.points} pts {s.seat === you && '(you)'}</li>)}</ol>
        <div className="row">
          {view.host && <button className="btn gold" onClick={() => send({ t: 'lobby' })}>Back to lobby</button>}
          <button className="btn alt" onClick={onLeave}>Leave</button>
        </div>
      </div></div>
    )
  }
  if (!r) return null
  const win = r.kind === 'win'
  const w = win ? v.players[r.winner!] : null
  const hand = win ? r.hands[r.winner!] : null
  const nAck = v.acks.length
  return (
    <div className="overlay"><div className="modal">
      {win && w && hand && r.score ? (
        <>
          <h2>{w.name} wins by {r.tsumo ? 'tsumo (自摸)' : `ron (${v.players[r.from!].name} deals in)`}</h2>
          <div className="tilesrow">
            {[...hand.hand].sort((a, b) => kindOf(a) - kindOf(b)).map((id) => <Tile key={id} id={id} hot={id === r.winTile && !r.tsumo} />)}
            {hand.melds.map((m, i) => <span key={i} className="meld" style={{ marginLeft: 8, display: 'inline-flex' }}>{m.tiles.map((t) => <Tile key={t} id={t} />)}</span>)}
            {hand.flowers.length > 0 && <span style={{ marginLeft: 8, display: 'inline-flex' }}>{hand.flowers.map((f) => <Tile key={f} id={f} />)}</span>}
          </div>
          {r.ura && r.ura.length > 0 && <div className="muted">Ura dora: <span className="tilesrow" style={{ display: 'inline-flex' }}>{r.ura.map((t, i) => <Tile key={i} id={t} />)}</span></div>}
          <div className="yaku">
            {r.score.yaku.map((y, i) => (
              <div key={i} style={{ display: 'contents' }}>
                <div>{y.name}{y.zh && <span className="zh">{y.zh}</span>}</div>
                <div>{y.yakuman ? 'Yakuman' : `${y.value} ${unit}`}</div>
              </div>
            ))}
          </div>
          <div className="limit">
            {r.score.label ?? ''} {r.score.yakuman ? '' : `${r.score.total} ${unit}`}{r.score.fu ? ` · ${r.score.fu} fu` : ''}
          </div>
        </>
      ) : (
        <>
          <h2>{r.label && r.label !== 'Exhaustive draw' ? r.label : 'Draw — wall exhausted'}</h2>
          {v.rule.id === 'riichi' && <p className="muted">Tenpai: {v.players.filter((_, i) => r.tenpai?.[i]).map((p) => p.name).join(', ') || 'nobody'}</p>}
        </>
      )}
      {r.others?.map((o, k) => (
        <div key={k} style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          <b>{v.players[o.winner].name}</b> also wins (double ron)
          <div className="tilesrow">{[...o.hand.hand].sort((a, b) => kindOf(a) - kindOf(b)).map((id) => <Tile key={id} id={id} />)}{o.hand.melds.map((m, i) => <span key={i} className="meld" style={{ marginLeft: 8, display: 'inline-flex' }}>{m.tiles.map((t) => <Tile key={t} id={t} />)}</span>)}</div>
          <div className="yaku">{o.score.yaku.map((y, i) => <div key={i} style={{ display: 'contents' }}><div>{y.name}<span className="zh">{y.zh}</span></div><div>{y.value} {unit}</div></div>)}</div>
          <b>{o.score.total} {unit}</b>
        </div>
      ))}
      {r.sticksWon ? <div className="muted">+{r.sticksWon} from riichi sticks</div> : null}
      <DeltaGrid />
      <div className="row">
        <button className="btn gold" disabled={acked} onClick={() => send({ t: 'ack' })}>{acked ? `Waiting… (${nAck})` : 'Next hand'}</button>
        <button className="btn alt" onClick={onLeave}>Leave</button>
      </div>
    </div></div>
  )
}
