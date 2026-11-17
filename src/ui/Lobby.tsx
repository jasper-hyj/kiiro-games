import { useState } from 'react'
import type { RoomConfig, TableView } from '../engine/table'
import { RULESETS, type RuleId } from '../engine/rules'
import type { ClientMsg } from '../net/protocol'
import { RulesHelp } from './RulesHelp'
import { useLang } from '../i18n'
import { onlineConfigured } from '../net/client'

const IDS: RuleId[] = ['taiwan', 'hk', 'riichi']
type Change = (c: Partial<RoomConfig>) => void

export function RuleCards({ config, onChange, readOnly }: { config: RoomConfig; onChange: Change; readOnly?: boolean }) {
  const { lang, t } = useLang()
  return (
    <div className="grid3">
      {IDS.map((id) => {
        const r = RULESETS[id]
        return (
          <button key={id} type="button" disabled={readOnly} className={'rule' + (config.rule === id ? ' on' : '')}
            onClick={() => onChange({ rule: id, rounds: id === 'taiwan' ? (config.rounds === 2 ? 4 : config.rounds) : (config.rounds === 4 ? 2 : config.rounds) } as Partial<RoomConfig>)}>
            <span className="zh">{lang === 'zh' ? r.zh : t(id + '.name')}</span>
            <span className="muted small">{t(id + '.blurb')}</span>
          </button>
        )
      })}
    </div>
  )
}

function Seg<T extends string | number | boolean>({ value, items, onPick, disabled }: { value: T; items: [T, string][]; onPick: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="seg">
      {items.map(([v, label]) => <button key={String(v)} disabled={disabled} className={value === v ? 'on' : ''} onClick={() => onPick(v)}>{label}</button>)}
    </div>
  )
}

export function Options({ config, onChange, readOnly, open }: { config: RoomConfig; onChange: Change; readOnly?: boolean; open?: boolean }) {
  const { t } = useLang()
  const [help, setHelp] = useState(false)
  const tw = config.rule === 'taiwan'
  return (
    <details className="options" open={open}>
      <summary>{t('options')}</summary>
      <div className="optgrid">
        <div className="opt"><span>{t('length')}</span>
          <Seg disabled={readOnly} value={config.rounds as number} onPick={(n) => onChange({ rounds: n as 1 | 2 | 4 })}
            items={tw ? [[1, t('eastRound')], [4, t('fullGame')]] : [[1, t('eastOnly')], [2, t('eastSouth')]]} />
        </div>
        {config.rule === 'riichi' && (
          <div className="opt"><span>{t('players')}</span>
            <Seg disabled={readOnly} value={config.players ?? 4} onPick={(n) => onChange({ players: n as 3 | 4 })} items={[[4, '4'], [3, t('sanma')]]} />
          </div>
        )}
        {config.rule === 'riichi' && (
          <div className="opt"><span>{t('redFives')}</span>
            <Seg disabled={readOnly} value={config.aka} onPick={(v) => onChange({ aka: v })} items={[[true, t('on')], [false, t('off')]]} />
          </div>
        )}
        {config.rule === 'hk' && (
          <div className="opt"><span>{t('minFan')}</span>
            <select disabled={readOnly} value={config.minFan} onChange={(e) => onChange({ minFan: +e.target.value })}>
              {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
        <div className="opt"><span>{t('bots')}</span>
          <Seg disabled={readOnly} value={config.botLevel ?? 'normal'} onPick={(l) => onChange({ botLevel: l })} items={[['easy', t('easy')], ['normal', t('normal')]]} />
        </div>
      </div>
      <button className="btn sm alt" onClick={() => setHelp(true)}>{t('rulesRef')}</button>
      {help && <RulesHelp initial={config.rule} onClose={() => setHelp(false)} />}
    </details>
  )
}

export function Menu({ name, setName, config, setConfig, onSolo, onCreate, onJoin }: {
  name: string; setName: (s: string) => void; config: RoomConfig; setConfig: (c: RoomConfig) => void
  onSolo: () => void; onCreate: () => void; onJoin: (code: string) => void
}) {
  const { t } = useLang()
  const [code, setCode] = useState('')
  const change: Change = (c) => setConfig({ ...config, ...c })
  return (
    <div className="page menu">
      <div className="hero">
        <h1>{t('brand')}</h1>
        <p className="muted">{t('tagline')}</p>
      </div>
      <section>
        <h2>{t('step1')}</h2>
        <RuleCards config={config} onChange={change} />
        <Options config={config} onChange={change} />
      </section>
      <section>
        <h2>{t('step2')}</h2>
        <input type="text" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} aria-label={t('nickname')} />
      </section>
      <section>
        <h2>{t('step3')}</h2>
        <div className="playrow">
          <button className="btn gold big" onClick={onCreate} disabled={!onlineConfigured}>{t('playFriends')}</button>
          <button className="btn big" onClick={onSolo}>{t('playBots')}</button>
        </div>
        <div className="row joinrow">
          <span className="muted">{t('haveCode')}</span>
          <input type="text" placeholder={t('roomCode')} value={code} maxLength={8} onChange={(e) => setCode(e.target.value.toUpperCase())} style={{ width: 130 }} aria-label={t('roomCode')} />
          <button className="btn" disabled={code.length < 3} onClick={() => onJoin(code)}>{t('join')}</button>
        </div>
        {!onlineConfigured && <p className="muted small" style={{ marginTop: 10 }}>{t('onlineOff')}</p>}
      </section>
    </div>
  )
}

export function RoomLobby({ view, room, send, onLeave }: { view: TableView; room: string; send: (m: ClientMsg) => void; onLeave: () => void }) {
  const { t } = useLang()
  const link = `${location.origin}${location.pathname}?room=${room}`
  const [copied, setCopied] = useState(false)
  const humans = view.seats.filter((s) => s.human).length
  return (
    <div className="page">
      <h1>{t('room')} <span style={{ color: 'var(--accent)' }}>{room}</span></h1>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row">
          <input type="text" readOnly value={link} style={{ flex: 1, minWidth: 220 }} onFocus={(e) => e.currentTarget.select()} />
          <button className="btn" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? t('copied') : t('inviteLink')}</button>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h2>{t('seats')} · {humans}/{view.seats.length} {t('seatsNote')}</h2>
        <div className="seatlist">
          {view.seats.map((s, i) => (
            <div className="seatbox" key={i}>
              <span className={'status-dot' + (s.human ? ' open' : '')} />{s.name}{i === view.you ? ` (${t('you')})` : ''}
              <div className="muted" style={{ fontSize: 12 }}>{s.human ? t('human') : s.bot ? t('botReserved') : t('openSeat')}</div>
              {view.host && !s.human && <button className="btn sm alt" style={{ marginTop: 6 }} onClick={() => send({ t: 'toggleBot', seat: i })}>{s.bot ? t('openThis') : t('makeBot')}</button>}
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h2>{t('gameSettings')} {view.host ? '' : t('hostDecides')}</h2>
        <RuleCards config={view.config} readOnly={!view.host} onChange={(c) => send({ t: 'config', config: c })} />
        <Options open config={view.config} readOnly={!view.host} onChange={(c) => send({ t: 'config', config: c })} />
      </div>
      <div className="row">
        {view.host ? <button className="btn gold" onClick={() => send({ t: 'start' })}>{t('startGame')}</button> : <span className="muted">{t('waitHost')}</span>}
        <button className="btn alt" onClick={onLeave}>{t('leave')}</button>
      </div>
    </div>
  )
}
