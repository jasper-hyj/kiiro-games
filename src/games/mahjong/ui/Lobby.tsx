import { useState } from 'react'
import { fromRoom } from '../../shared/fromRoom'
import { SeatChip, TableHeader } from '../../../ui/components'
import '../../../room/strings'
import type { RoomConfig, TableView } from '../engine/table'
import { RULESETS } from '../engine/rules'
import type { ClientMsg } from '../net/protocol'
import { useLang } from '../../../i18n'
import { roomUrl } from '../../../route'
import { RULE_COLOR, RULE_GLYPH } from '../ruleMeta'

const WINDS = ['東', '南', '西', '北']
const GLYPH = RULE_GLYPH

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
  const link = `${location.origin}${roomUrl(room)}`
  const [copied, setCopied] = useState(false)
  const humans = view.seats.filter((s) => s.human).length
  const copy = () => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div className="page lobby kg-scene">
      <TableHeader title={`${t('room')} ${room}`} sub={`${humans}/${view.seats.length}`} watching={view.watching} copied={copied} onCopy={copy} onLeave={onLeave} leaveLabel={fromRoom() ? t('rmBack') : t('leave')} />
      <div className="kg-table mjtable" data-rule={view.config.rule} style={{ ['--rc' as string]: RULE_COLOR[view.config.rule] }}>
        <section>
          <h2>{t('rmPeople')}</h2>
          <div className="seatcards">
            {view.seats.map((s, i) => (
              <SeatChip key={i} className="mj-seatchip" name={s.human ? s.name : t('seatOpen')} state={(i === view.you ? 'me ' : '') + (s.human ? '' : 'away')}
                badge={<span className="mj-wind" aria-hidden="true">{WINDS[i] ?? ''}</span>}
                sub={<span className="mj-seatsub">{i === view.you ? (view.host ? t('seatYouHost') : t('seatYou')) : s.human ? t('seatJoined') : `${t('seatBot')} · ${s.name}`}</span>} />
            ))}
          </div>
          <p className="muted small seatsnote">{humans}/{view.seats.length} · {t('seatsNote')}</p>
        </section>
        <section>
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
          </div>
          {fromRoom() && <p className="muted small seatsnote">{view.host ? t('rulesInRoomHost') : t('hostDecides')} <a href={roomUrl(room)}>{t('rmBack')}</a></p>}
        </section>
      </div>
    </div>
  )
}
