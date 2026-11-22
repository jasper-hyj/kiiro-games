import { useState } from 'react'
import type { RoomConfig, TableView } from '../engine/table'
import { RULESETS, type RuleId } from '../engine/rules'
import type { ClientMsg } from '../net/protocol'
import { useLang } from '../i18n'
import { onlineConfigured } from '../net/client'
import { MAHJONG_PATH } from '../route'
import { Tile } from './Tile'

const TAGS: Record<RuleId, string[]> = { taiwan: ['tg.t16', 'tg.flowers', 'tg.tai'], hk: ['tg.t13', 'tg.min3', 'tg.flowers'], riichi: ['tg.yaku', 'tg.dora', 'tg.riichi'], mcr: ['tg.fan81', 'tg.min8'], sichuan: ['tg.t108', 'tg.swap', 'tg.blood'] } as Record<RuleId, string[]>
const WINDS = ['東', '南', '西', '北']
const IDS: RuleId[] = ['taiwan', 'hk', 'riichi', 'mcr', 'sichuan']
const GLYPH: Record<RuleId, string> = { taiwan: '台', hk: '港', riichi: '日', mcr: '國', sichuan: '川' } as Record<RuleId, string>
type Change = (c: Partial<RoomConfig>) => void

export function RuleCards({ config, onChange, readOnly }: { config: RoomConfig; onChange: Change; readOnly?: boolean }) {
  const { lang, t } = useLang()
  return (
    <div className="grid3">
      {IDS.map((id) => {
        const r = RULESETS[id]
        return (
          <button key={id} type="button" disabled={readOnly} data-rule={id} className={'rule' + (config.rule === id ? ' on' : '')}
            onClick={() => onChange({ rule: id, rounds: id === 'taiwan' ? (config.rounds === 2 ? 4 : config.rounds) : (config.rounds === 4 ? 2 : config.rounds) } as Partial<RoomConfig>)}>
            <span className="glyph" aria-hidden="true">{GLYPH[id]}</span>
            <span className="zh">{lang === 'zh' ? r.zh : t(id + '.name')}</span>
            <span className="muted small">{t(id + '.blurb')}</span>
            <span className="tags">{TAGS[id].map((k) => <span className="tg" key={k}>{t(k)}</span>)}</span>
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

export function Options({ config, onChange, readOnly, open, flat }: { config: RoomConfig; onChange: Change; readOnly?: boolean; open?: boolean; flat?: boolean }) {
  const { t } = useLang()
  const tw = config.rule === 'taiwan'
  const Wrap = flat ? 'div' : 'details'
  return (
    <Wrap className={'options' + (flat ? ' flat' : '')} {...(flat ? {} : { open })}>
      {!flat && <summary>{t('options')}</summary>}
      <div className="optgrid">
        <div className="opt"><span>{t('length')}</span>
          <Seg disabled={readOnly} value={config.rounds as number} onPick={(n) => onChange({ rounds: n as 1 | 2 | 4 })}
            items={tw ? [[1, t('eastRound')], [4, t('fullGame')]] : [[1, t('eastOnly')], [2, t('eastSouth')]]} />
        </div>
        {(config.rule === 'riichi' || config.rule === 'hk') && (
          <div className="opt"><span>{t('players')}</span>
            <Seg disabled={readOnly} value={config.players ?? 4} onPick={(n) => onChange({ players: n as 3 | 4 })} items={[[4, '4'], [3, t('sanma')]]} />
          </div>
        )}
        {config.rule === 'sichuan' && (
          <div className="opt"><span>{t('swapOpt')}</span>
            <Seg disabled={readOnly} value={config.swap !== false} onPick={(v) => onChange({ swap: v })} items={[[true, t('on')], [false, t('off')]]} />
          </div>
        )}
        {config.rule === 'riichi' && (
          <div className="opt"><span>{t('redFives')}</span>
            <Seg disabled={readOnly} value={config.aka} onPick={(v) => onChange({ aka: v })} items={[[true, t('on')], [false, t('off')]]} />
          </div>
        )}
        {(config.rule === 'hk' || config.rule === 'mcr') && (
          <div className="opt"><span>{t('minFan')}</span>
            <select disabled={readOnly} value={config.minFan} onChange={(e) => onChange({ minFan: +e.target.value })}>
              {(config.rule === 'mcr' ? [0, 4, 6, 8] : [0, 1, 2, 3, 4, 5]).map((n) => <option key={n} value={n}>{n === 0 && config.rule === 'hk' ? t('casualFan') : n}</option>)}
            </select>
          </div>
        )}
        <div className="opt"><span>{t('coachOpt')}</span>
          <Seg disabled={readOnly} value={config.coach !== false} onPick={(v) => onChange({ coach: v })} items={[[true, t('allowed')], [false, t('off')]]} />
        </div>
        <div className="opt"><span>{t('bots')}</span>
          <Seg disabled={readOnly} value={config.botLevel ?? 'normal'} onPick={(l) => onChange({ botLevel: l })} items={[['easy', t('easy')], ['normal', t('normal')], ['hard', t('hard')]]} />
        </div>
      </div>
    </Wrap>
  )
}

type Step = 'start' | 'rules' | 'options' | 'code' | 'name'
type Mode = 'play' | 'join'
const FLOW: Record<Mode, Step[]> = { play: ['rules', 'options', 'name'], join: ['code', 'name'] }

export function Menu({ name, setName, config, setConfig, onSolo, onTutorial, onCreate, onJoin }: {
  name: string; setName: (s: string) => void; config: RoomConfig; setConfig: (c: RoomConfig) => void
  onSolo: () => void; onTutorial: () => void; onCreate: () => void; onJoin: (code: string) => void
}) {
  const { t } = useLang()
  const [step, setStep] = useState<Step>('start')
  const [mode, setMode] = useState<Mode>('play')
  const [code, setCode] = useState('')
  const change: Change = (c) => setConfig({ ...config, ...c })
  const seq = FLOW[mode]
  const idx = seq.indexOf(step)
  const go = (m: Mode) => { setMode(m); setStep(FLOW[m][0]) }
  const next = () => { if (idx >= 0 && idx < seq.length - 1) setStep(seq[idx + 1]) }
  const back = () => setStep(idx > 0 ? seq[idx - 1] : 'start')
  // one Play button: an online room whose empty seats are bots (a room with nobody else is just a game against bots); without a server it runs in the browser
  const finish = () => (mode === 'play' ? (onlineConfigured ? onCreate() : onSolo()) : onJoin(code))
  const fan = [3, 13, 31, 32, 33, 26]
  const pickRule = (id: RuleId) => {
    setConfig({ ...config, rule: id, rounds: (id === 'taiwan' ? (config.rounds === 2 ? 4 : config.rounds) : (config.rounds === 4 ? 2 : config.rounds)) as 1 | 2 | 4, minFan: id === 'mcr' ? 8 : id === 'hk' ? 3 : config.minFan })
    next()
  }
  return (
    <div className="page menu parlour">
      {step !== 'start' && <button className="backbtn" onClick={back} aria-label={t('back')}><span aria-hidden="true">←</span></button>}
      <div className="stepbox" key={step}>
        {step === 'start' && (
          <>
            <header className="hero">
              <div className="fan" aria-hidden="true">
                {fan.map((k, i) => <div key={i} className="fantile" style={{ ['--i' as string]: i - (fan.length - 1) / 2 }}><Tile kind={k} /></div>)}
              </div>
              <h1 className="title"><span className="cjk">麻雀</span><span className="latin">{t('brand')}</span></h1>
              <p className="tagline">{t('tagline')}</p>
            </header>
            <div className="rulestrip" aria-hidden="true">
              {IDS.map((id) => <span key={id} data-rule={id}><b>{GLYPH[id]}</b><span className="rn">{ruleName(id, t)}</span></span>)}
            </div>
            <div className="playrow">
              <button className="btn gold big" onClick={() => go('play')}>{t('play')}</button>
            </div>
            <div className="linkrow">
              <button className="linkbtn" onClick={() => go('join')} disabled={!onlineConfigured}>{t('haveCode')}</button>
              <button className="linkbtn" onClick={onTutorial}>{t('learnPlay')}</button>
              <a className="linkbtn" href="/">{t('hubAll')}</a>
            </div>
          </>
        )}
        {step === 'rules' && (
          <section className="shelf">
            <h2 className="eyebrow">{t('chooseRules')}</h2>
            <div className="grid3">
              {IDS.map((id) => (
                <button key={id} type="button" data-rule={id} className={'rule' + (config.rule === id ? ' on' : '')} onClick={() => pickRule(id)}>
                  <span className="glyph" aria-hidden="true">{GLYPH[id]}</span>
                  <span className="zh">{RULESETS[id] ? ruleName(id, t) : id}</span>
                  <span className="muted small">{t(id + '.blurb')}</span>
                  <span className="tags">{TAGS[id].map((k) => <span className="tg" key={k}>{t(k)}</span>)}</span>
                </button>
              ))}
            </div>
            <p className="rulehelp muted">{t('ruleHelp')}</p>
          </section>
        )}
        {step === 'options' && (
          <section className="shelf narrow">
            <h2 className="eyebrow">{t('options')}</h2>
            <Options config={config} onChange={change} flat />
            <div className="summarycard" data-rule={config.rule}><b>{t('summaryTitle')}</b><span>{ruleName(config.rule, t)} · {summary(config, t)}</span></div>
            <button className="btn gold big" onClick={next}>{t('continue')}</button>
          </section>
        )}
        {step === 'code' && (
          <section className="shelf narrow">
            <h2 className="eyebrow">{t('roomCode')}</h2>
            <input className="bigcode" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" autoFocus placeholder="0000" value={code} maxLength={4} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 4) next() }} aria-label={t('roomCode')} />
            <button className="btn gold big" disabled={code.length !== 4} onClick={next}>{t('continue')}</button>
          </section>
        )}
        {step === 'name' && (
          <section className="shelf narrow">
            <h2 className="eyebrow">{t('nickname')}</h2>
            <input className="bigname" type="text" autoFocus value={name === 'Player' ? '' : name} placeholder={t('yourName')} maxLength={16} onChange={(e) => setName(e.target.value || 'Player')} onKeyDown={(e) => { if (e.key === 'Enter') finish() }} aria-label={t('nickname')} />
            {mode === 'play' && !onlineConfigured && (
              <div className="seatpreview" aria-label={t('seatPreview')}>
                {[name === 'Player' ? t('you') : name, t('botName', { n: 1 }), t('botName', { n: 2 }), t('botName', { n: 3 })].map((n, i) => <span key={i} className={i === 0 ? 'me' : ''}><b>{WINDS[i]}</b>{n}</span>)}
              </div>
            )}
            <button className="btn gold big" onClick={finish}>{mode === 'play' ? (onlineConfigured ? t('createRoom') : t('startGame')) : t('joinRoom')}</button>
          </section>
        )}
      </div>
      {idx >= 0 && <div className="stepdots" aria-hidden="true">{seq.map((st, i) => <i key={st} className={i === idx ? 'on' : i < idx ? 'done' : ''} />)}</div>}
    </div>
  )
}

function ruleName(id: RuleId, t: (k: string) => string) { return t(id + '.name') }

function summary(c: RoomConfig, t: (k: string) => string): string {
  const len = c.rule === 'taiwan' ? (c.rounds === 4 ? t('fullGame') : t('eastRound')) : (c.rounds === 2 ? t('eastSouth') : t('eastOnly'))
  const parts = [len]
  if (c.rule === 'riichi') parts.push(c.players === 3 ? t('sanma') : '4P', c.aka ? t('redFives') : '')
  if (c.rule === 'hk' && c.players === 3) parts.push(t('sanma'))
  if (c.rule === 'hk' || c.rule === 'mcr') parts.push(`${t('minFan')} ${c.minFan}`)
  if (c.rule === 'sichuan') parts.push(c.swap !== false ? t('swapOpt') : '')
  if (c.coach === false) parts.push(t('coachOffShort'))
  parts.push(`${t('bots')}: ${t(c.botLevel ?? 'normal')}`)
  return parts.filter(Boolean).join(' · ')
}

export function RoomLobby({ view, room, send, onLeave }: { view: TableView; room: string; send: (m: ClientMsg) => void; onLeave: () => void }) {
  const { t, lang } = useLang()
  const link = `${location.origin}${MAHJONG_PATH}?room=${room}`
  const [copied, setCopied] = useState(false)
  const humans = view.seats.filter((s) => s.human).length
  const copy = () => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div className="page lobby">
      <div className="roomhead">
        <span className="eyebrow">{t('room')}</span>
        <div className="bigroom" aria-label={t('room')}>{room}</div>
        <div className="copyrow">
          <input type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label={t('inviteLink')} />
          <button className="btn" onClick={copy}>{copied ? t('copied') : t('inviteLink')}</button>
        </div>
      </div>
      <div className="seatcards">
        {view.seats.map((s, i) => (
          <div className={'seatcard' + (i === view.you ? ' you' : '') + (s.human ? '' : ' open')} key={i}>
            <span className="wind">{WINDS[i] ?? ''}</span>
            <b>{s.human ? s.name : t('seatOpen')}</b>
            <span className={'badge' + (i === view.you ? ' ac' : '')}>{i === view.you ? (view.host ? t('seatYouHost') : t('seatYou')) : s.human ? t('seatJoined') : `${t('seatBot')} · ${s.name}`}</span>
          </div>
        ))}
      </div>
      <p className="muted small seatsnote">{humans}/{view.seats.length} · {t('seatsNote')}</p>
      <div className="rulebanner">
        <span className="glyph" aria-hidden="true">{GLYPH[view.config.rule]}</span>
        <div className="rbtext">
          <span className="eyebrow">{t('playingNow')}</span>
          <b className="rbname">{lang === 'zh' ? RULESETS[view.config.rule].zh : t(view.config.rule + '.name')}</b>
          <span className="muted small">{summary(view.config, t)}</span>
        </div>
      </div>
      <div className="row lobbyactions">
        {view.host ? <button className="btn gold big" onClick={() => send({ t: 'start' })}>{t('startGame')}</button> : <span className="muted">{t('waitHost')}</span>}
        <button className="btn alt" onClick={onLeave}>{t('leave')}</button>
      </div>
      <section className="tablesettings always">
        <h2 className="eyebrow">{view.host ? t('changeRules') : t('hostDecides')}</h2>
        <RuleCards config={view.config} readOnly={!view.host} onChange={(c) => send({ t: 'config', config: c })} />
        <Options flat config={view.config} readOnly={!view.host} onChange={(c) => send({ t: 'config', config: c })} />
      </section>
    </div>
  )
}
