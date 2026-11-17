import type { TableView } from '../engine/table'
import { CHAT_KEYS } from '../engine/table'
import { useLang, yakuName } from '../i18n'

type Game = NonNullable<TableView['game']>
export const EMOJI: Record<string, string> = { e1: '👍', e2: '😂', e3: '😮', e4: '🙏' }

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useLang()
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="btn sm alt" onClick={onClose}>{t('close')}</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function HistoryModal({ v, you, onClose }: { v: Game; you: number; onClose: () => void }) {
  const { lang, t } = useLang()
  const unit = t(v.rule.id === 'riichi' ? 'han' : v.rule.id === 'hk' ? 'fan' : 'tai')
  const n = v.players.length
  const rows = [...v.history].reverse()
  return (
    <Modal title={t('history')} onClose={onClose}>
      {rows.length === 0 ? <p className="muted">{t('noHistory')}</p> : (
        <div className="hist">
          {rows.map((h, i) => {
            const round = t('roundName', { wind: t('wind.' + Math.min(3, Math.floor(h.roundIndex / n))), n: (h.roundIndex % n) + 1 })
            const who = h.kind === 'win'
              ? (h.tsumo ? t('winsTsumo', { name: v.players[h.winners[0]].name }) : t('winsRon', { name: v.players[h.winners[0]].name, from: h.from !== null ? v.players[h.from].name : '' }))
              : t('drawShort')
            return (
              <div key={i} className="histrow">
                <div className="hmain">
                  <b>#{h.handNo} · {round}</b>
                  <div>{who}</div>
                  {h.kind === 'win' && <div className="muted small">{h.names.map((y) => yakuName(y, lang)).join(' · ')}{h.total ? ` — ${h.total} ${unit}` : ''}</div>}
                </div>
                <div className="hpts" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
                  {v.players.map((p, k) => (
                    <div key={k} className={k === you ? 'me' : ''}>
                      <span className="muted small">{p.name}</span>
                      <b>{h.points[k]}</b>
                      <span className={h.deltas[k] >= 0 ? 'pos' : 'neg'}>{h.deltas[k] >= 0 ? '+' : ''}{h.deltas[k]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const { t } = useLang()
  const rows: [string, string][] = [
    ['← →', t('sc.move')], ['Enter', t('sc.discard')], ['D', t('sc.tsumogiri')], ['T', t('sc.tsumo')],
    ['R', t('sc.ron')], ['P', t('sc.pon')], ['C / 1-3', t('sc.chi')], ['K', t('sc.kan')],
    ['Space / Esc', t('sc.pass')], ['I', t('sc.riichi')], ['Enter', t('sc.next')],
  ]
  return (
    <Modal title={t('shortcuts')} onClose={onClose}>
      <table className="ref"><tbody>{rows.map(([k, d], i) => <tr key={i}><td><kbd>{k}</kbd></td><td>{d}</td></tr>)}</tbody></table>
    </Modal>
  )
}

export function ChatPicker({ onPick }: { onPick: (key: string) => void }) {
  const { t } = useLang()
  return (
    <div className="chatpop">
      {CHAT_KEYS.map((k) => <button key={k} className="chatbtn" onClick={() => onPick(k)}>{EMOJI[k] ?? t('chat.' + k)}</button>)}
    </div>
  )
}
