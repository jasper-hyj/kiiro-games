import { useState } from 'react'
import type { RoomConfig, TableView } from '../engine/table'
import { RULESETS, type RuleId } from '../engine/rules'
import type { ClientMsg } from '../net/protocol'
import { RulesHelp } from './RulesHelp'

const IDS: RuleId[] = ['riichi', 'hk', 'taiwan']

export function ConfigEditor({ config, onChange, readOnly }: { config: RoomConfig; onChange: (c: Partial<RoomConfig>) => void; readOnly?: boolean }) {
  const [help, setHelp] = useState(false)
  return (
    <div>
      <div className="grid3">
        {IDS.map((id) => {
          const r = RULESETS[id]
          return (
            <div key={id} className={'card rule' + (config.rule === id ? ' on' : '')} onClick={() => !readOnly && onChange({ rule: id, rounds: id === 'taiwan' ? (config.rounds === 2 ? 4 : config.rounds) : (config.rounds === 4 ? 2 : config.rounds) } as Partial<RoomConfig>)}>
              <div className="zh">{r.zh}</div>
              <b>{r.name}</b>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{r.blurb}</div>
            </div>
          )
        })}
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <span>Length</span>
        <div className="seg">
          {(config.rule === 'taiwan' ? [[1, 'East round'], [4, 'Full (4 winds)']] : [[1, 'East only'], [2, 'East + South']] as [number, string][]).map(([n, label]) => (
            <button key={n} disabled={readOnly} className={config.rounds === n ? 'on' : ''} onClick={() => onChange({ rounds: n as 1 | 2 | 4 })}>{label}</button>
          ))}
        </div>
        {config.rule === 'riichi' && (
          <div className="seg">
            {([4, 3] as const).map((n) => <button key={n} disabled={readOnly} className={(config.players ?? 4) === n ? 'on' : ''} onClick={() => onChange({ players: n })}>{n === 4 ? '4 players' : '3 players (sanma)'}</button>)}
          </div>
        )}
        {config.rule === 'riichi' && (
          <label><input type="checkbox" disabled={readOnly} checked={config.aka} onChange={(e) => onChange({ aka: e.target.checked })} /> Red fives</label>
        )}
        {config.rule === 'hk' && (
          <label>Min fan{' '}
            <select disabled={readOnly} value={config.minFan} onChange={(e) => onChange({ minFan: +e.target.value })}>
              {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        <label>Bots{' '}
          <select disabled={readOnly} value={config.botLevel ?? 'normal'} onChange={(e) => onChange({ botLevel: e.target.value as 'easy' | 'normal' })}>
            <option value="easy">Easy</option><option value="normal">Normal</option>
          </select>
        </label>
        <button className="btn sm alt" onClick={() => setHelp(true)}>Rules reference</button>
      </div>
      {help && <RulesHelp initial={config.rule} onClose={() => setHelp(false)} />}
    </div>
  )
}

type Mode = 'menu' | 'online'

export function Menu({ name, setName, config, setConfig, onSolo, onCreate, onJoin }: {
  name: string; setName: (s: string) => void; config: RoomConfig; setConfig: (c: RoomConfig) => void
  onSolo: () => void; onCreate: () => void; onJoin: (code: string) => void
}) {
  const [mode, setMode] = useState<Mode>('menu')
  const [code, setCode] = useState('')
  return (
    <div className="page">
      <h1>🀄 Kiiro Mahjong</h1>
      <p className="muted">Japanese Riichi, Hong Kong and Taiwanese mahjong. Play against bots, or invite friends to a room (bots fill empty seats).</p>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row"><span>Nickname</span><input type="text" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} /></div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h2>Ruleset</h2>
        <ConfigEditor config={config} onChange={(c) => setConfig({ ...config, ...c })} />
      </div>
      <div className="card">
        <div className="tabs">
          <button className={'btn ' + (mode === 'menu' ? 'gold' : 'alt')} onClick={() => setMode('menu')}>Play vs bots</button>
          <button className={'btn ' + (mode === 'online' ? 'gold' : 'alt')} onClick={() => setMode('online')}>Online room</button>
        </div>
        {mode === 'menu' ? (
          <div className="row"><button className="btn gold" onClick={onSolo}>Start game</button><span className="muted">You vs 3 bots, runs entirely in your browser.</span></div>
        ) : (
          <div className="row">
            <button className="btn gold" onClick={onCreate}>Create room</button>
            <span className="muted">or join:</span>
            <input type="text" placeholder="Room code" value={code} maxLength={8} onChange={(e) => setCode(e.target.value.toUpperCase())} style={{ width: 130 }} />
            <button className="btn" disabled={code.length < 3} onClick={() => onJoin(code)}>Join</button>
          </div>
        )}
      </div>
    </div>
  )
}

export function RoomLobby({ view, room, send, onLeave }: { view: TableView; room: string; send: (m: ClientMsg) => void; onLeave: () => void }) {
  const link = `${location.origin}${location.pathname}?room=${room}`
  const [copied, setCopied] = useState(false)
  const humans = view.seats.filter((s) => s.human).length
  return (
    <div className="page">
      <h1>Room <span style={{ color: 'var(--accent)' }}>{room}</span></h1>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row">
          <input type="text" readOnly value={link} style={{ flex: 1, minWidth: 220 }} onFocus={(e) => e.currentTarget.select()} />
          <button className="btn" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? 'Copied!' : 'Copy invite link'}</button>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h2>Seats ({humans}/{view.seats.length} humans — empty seats play as bots)</h2>
        <div className="seatlist">
          {view.seats.map((s, i) => (
            <div className="seatbox" key={i}>
              <span className={'status-dot' + (s.human ? ' open' : '')} />{s.name}{i === view.you ? ' (you)' : ''}
              <div className="muted" style={{ fontSize: 12 }}>{s.human ? 'Human' : s.bot ? 'Bot (reserved)' : 'Open — bot if nobody joins'}</div>
              {view.host && !s.human && <button className="btn sm alt" style={{ marginTop: 6 }} onClick={() => send({ t: 'toggleBot', seat: i })}>{s.bot ? 'Open this seat' : 'Make bot'}</button>}
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h2>Game settings {view.host ? '' : '(host decides)'}</h2>
        <ConfigEditor config={view.config} readOnly={!view.host} onChange={(c) => send({ t: 'config', config: c })} />
      </div>
      <div className="row">
        {view.host ? <button className="btn gold" onClick={() => send({ t: 'start' })}>Start game</button> : <span className="muted">Waiting for the host to start…</span>}
        <button className="btn alt" onClick={onLeave}>Leave</button>
      </div>
    </div>
  )
}
