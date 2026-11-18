import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { TableView } from '../engine/table'
import type { ClientMsg } from '../net/protocol'
import { Tile } from './Tile'
import { doraFrom, kindOf } from '../engine/tiles'
import { useLang, yakuName } from '../i18n'
import { ReplayModal } from './Replay'

function DoraRows({ label, ids, sanma, ura }: { label: string; ids: number[]; sanma: boolean; ura?: boolean }) {
  return (
    <div className={'dorabox result' + (ura ? ' ura' : '')}>
      <div className="dlabel">{label}</div>
      <div className="drow">
        {ids.map((id, i) => (
          <div className="dpair" key={i}><Tile id={id} /><span className="darrow">▼</span><Tile kind={doraFrom(kindOf(id), sanma)} /></div>
        ))}
      </div>
    </div>
  )
}

export function ResultModal({ view, send, onLeave }: { view: TableView; send: (m: ClientMsg) => void; onLeave: () => void }) {
  const { lang, t } = useLang()
  const [review, setReview] = useState(false)
  const v = view.game!
  const r = v.result
  const you = view.you
  const unit = t(v.rule.id === 'riichi' ? 'han' : v.rule.id === 'hk' || v.rule.id === 'mcr' ? 'fan' : 'tai')
  const over = v.phase === 'over'
  const acked = v.acks.includes(you)
  const label = (l?: string) => (l ? (t('label.' + l) !== 'label.' + l ? t('label.' + l) : l) : '')

  const Hand = ({ h, win }: { h: { hand: number[]; melds: { tiles: number[] }[]; flowers: number[] }; win?: number }) => (
    <div className="tilesrow">
      {[...h.hand].sort((a, b) => kindOf(a) - kindOf(b)).map((id) => <Tile key={id} id={id} hot={id === win} />)}
      {h.melds.map((m, i) => <span key={i} className="meld" style={{ marginLeft: 8, display: 'inline-flex' }}>{m.tiles.map((x) => <Tile key={x} id={x} />)}</span>)}
      {h.flowers.length > 0 && <span style={{ marginLeft: 8, display: 'inline-flex' }}>{h.flowers.map((f) => <Tile key={f} id={f} />)}</span>}
    </div>
  )
  const Yaku = ({ items }: { items: { name: string; zh?: string; value: number; yakuman?: boolean }[] }) => (
    <div className="yaku">
      {items.map((y, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <div>{yakuName(y, lang)}</div>
          <div>{y.yakuman ? (y.value >= 26 ? t('doubleYakuman') : t('yakuman')) : `${y.value} ${unit}`}</div>
        </div>
      ))}
    </div>
  )
  const Scores = () => (
    <div className="deltas">
      {v.players.map((p, i) => {
        const d = r?.deltas[i] ?? 0
        return <div key={i}><b>{p.name}{i === you ? ` (${t('you')})` : ''}</b><br />{p.points}{r && <span className={d >= 0 ? 'pos' : 'neg'}> ({d >= 0 ? '+' : ''}{d})</span>}</div>
      })}
    </div>
  )

  if (over) {
    return (
      createPortal(<div className="overlay"><div className="modal">
        <div className="overhead"><span className="eyebrow">{t('finalStandings')}</span><h2>{t('tableWinner', { name: v.standings[0]?.name ?? '' })}</h2></div>
        <div className="podium">{v.standings.map((s, i) => (
          <div key={s.seat} className={'pd p' + (i + 1) + (s.seat === you ? ' me' : '')}>
            <span className="rk">{i + 1}</span>
            <b>{s.name}</b>
            <span className="pp">{s.points.toLocaleString()} {t('pts')}</span>
            {s.seat === you && <span className="pyou">{t('you')}</span>}
          </div>
        ))}</div>
        <div className="row">
          {view.host && <button className="btn gold" onClick={() => send({ t: 'lobby' })}>{t('backLobby')}</button>}
          <button className="btn" onClick={() => setReview(true)}>{t('reviewHands')}</button>
          <button className="btn alt" onClick={onLeave}>{t('leave')}</button>
        </div>
        {review && <ReplayModal v={v} you={you} onClose={() => setReview(false)} />}
      </div></div>, document.body)
    )
  }
  if (!r) return null
  if (v.rule.id === 'sichuan') {
    const wins = r.sc?.wins ?? []
    return createPortal(
      <div className="overlay"><div className="modal">
        <div className={'winbanner' + (wins.some((x) => x.winner === you) ? ' mine' : '') + (wins.length ? '' : ' draw')} role="status"><span className="wbicon" aria-hidden="true">{wins.length ? (lang === 'zh' ? '胡' : lang === 'ja' ? '和' : 'WIN') : (lang === 'zh' ? '流' : lang === 'ja' ? '流' : '—')}</span><div className="wbtext"><div className="wbname">{wins.length ? wins.map((x) => v.players[x.winner].name).join(' · ') : t('scNone')}</div></div></div>
        {wins.map((w) => (
          <div key={w.winner} className="scwin">
            <div className="scwhead">
              <b>#{w.order} {v.players[w.winner].name}{w.winner === you ? ` (${t('you')})` : ''}</b>
              <span className="muted"> — {w.tsumo ? t('selfDraw') : t('winsFrom', { from: v.players[w.from!].name })}</span>
              <span className="scpts pos">+{w.points}</span>
            </div>
            <Hand h={{ hand: w.hand.hand, melds: w.hand.melds, flowers: [] }} win={w.winTile} />
            <div className="howscored">
              <Yaku items={w.score.yaku} />
              <div className="hstotal"><span>{t('hsTotal')}</span><b>{w.score.total} {t('fan')}</b></div>
              <div className="hsline">{t('hsSichuan', { fan: Math.min(w.score.total, 4), pts: w.points, raw: w.score.total })}</div>
              <div className="hsline muted">{w.tsumo ? t('hsSichuanTsumo', { pts: w.points }) : t('hsSichuanRon', { pts: w.points })}</div>
            </div>
          </div>
        ))}
        {(r.sc?.notes ?? []).map((nt, i) => (
          <div key={i} className="scnote">
            <b>{lang === 'en' ? nt.label : nt.zh}</b>
            <span className="muted small"> {nt.deltas.map((d, k) => d ? `${v.players[k].name} ${d > 0 ? '+' : ''}${d}` : '').filter(Boolean).join(' · ')}</span>
          </div>
        ))}
        <Scores />
        <div className="row">
          <button className="btn gold" disabled={acked} onClick={() => send({ t: 'ack' })}>{acked ? t('waitingAck', { n: v.acks.length }) : t('nextHand')}</button>
          <button className="btn alt" onClick={onLeave}>{t('leave')}</button>
        </div>
      </div></div>,
      document.body,
    )
  }
  const win = r.kind === 'win'
  const w = win ? v.players[r.winner!] : null
  return createPortal(
    <div className="overlay"><div className="modal">
      {win && w && r.score ? (
        <>
          <div className={'winbanner' + (r.winner === you ? ' mine' : '')} role="status">
            <span className="wbicon" aria-hidden="true">{lang === 'zh' ? '胡' : lang === 'ja' ? '和' : 'WIN'}</span>
            <div className="wbtext">
              <div className="wbname">{w.name}{r.winner === you ? ` (${t('you')})` : ''}</div>
              <div className="wbtype">{r.tsumo ? t('selfDraw') : t('winsFrom', { from: v.players[r.from!].name })}</div>
            </div>
          </div>
          <Hand h={r.hands[r.winner!]} win={r.tsumo ? undefined : r.winTile} />
          <div className="limit">{label(r.score.label)} {r.score.yakuman ? '' : `${r.score.total} ${unit}`}{r.score.fu ? ` · ${r.score.fu} ${t('fu')}` : ''}</div>
          <div className="howscored">
            <h3>{t('howScored')}</h3>
            {r.dora && r.dora.length > 0 && <DoraRows label={t('doraRow')} ids={r.dora} sanma={v.players.length === 3} />}
            {r.ura && r.ura.length > 0 && <DoraRows label={t('uraRow')} ids={r.ura} sanma={v.players.length === 3} ura />}
            <Yaku items={r.score.yaku} />
            <div className="hstotal"><span>{t('hsTotal')}</span><b>{r.score.yakuman ? (r.score.yakuman > 1 ? t('doubleYakuman') : t('yakuman')) : `${r.score.total} ${unit}`}</b></div>
            {v.rule.id === 'riichi' && !r.score.yakuman && r.score.fuDetail && (
              <div className="hsblock">
                <div className="hshead">{t('hsFu')}</div>
                {r.score.fuDetail.map((f, i) => <div className="hsrow" key={i}><span>{lang === 'en' ? f.label[0] : f.label[1]}</span><span>{f.value > 0 && i > 0 && r.score!.fuDetail!.length > 1 ? '+' : ''}{r.score!.fuDetail!.length > 1 || i > 0 ? f.value : ''}</span></div>)}
                <div className="hsrow strong"><span>{t('hsFuTotal')}</span><span>{r.score.fu}</span></div>
                <div className="hsline">{t('hsBase', { fu: r.score.fu ?? 0, han: Math.min(r.score.total, 13), pow: 2 ** (2 + Math.min(r.score.total, 13)), raw: (r.score.fu ?? 0) * 2 ** (2 + Math.min(r.score.total, 13)) })}</div>
                {r.score.label && <div className="hsline">{t('hsLimit', { label: label(r.score.label), base: r.score.base })}</div>}
                {!r.score.label && <div className="hsline">{t('hsBaseFinal', { base: r.score.base })}</div>}
              </div>
            )}
            {v.rule.id === 'riichi' && r.score.yakuman && <div className="hsline">{t('hsYakuman', { n: r.score.yakuman, base: r.score.base })}</div>}
            {v.rule.id === 'taiwan' && <div className="hsline">{t('calcTw', { n: r.score.total, base: r.score.base })}</div>}
            {v.rule.id === 'hk' && <div className="hsline">{t('calcHk', { n: r.score.total, base: r.score.base })}</div>}
            {v.rule.id === 'mcr' && <div className="hsline">{t('calcMcr', { n: r.score.total })}</div>}
            <div className="hshead">{t('hsPay')}</div>
            {v.rule.id === 'riichi' && <div className="hsline muted">{r.tsumo ? t(r.winner === r.dealerBefore ? 'hsRiichiTsumoDealer' : 'hsRiichiTsumo') : t(r.winner === r.dealerBefore ? 'hsRiichiRonDealer' : 'hsRiichiRon')}</div>}
            {v.players.map((p, i) => r.deltas[i] !== 0 ? <div className="hsrow" key={i}><span>{p.name}</span><span className={r.deltas[i] > 0 ? 'pos' : 'neg'}>{r.deltas[i] > 0 ? '+' : ''}{r.deltas[i]}</span></div> : null)}
            {r.others?.map((o, k) => (
              <div key={k} className="hsother">
                <b>{t('alsoWins', { name: v.players[o.winner].name })}</b>
                <Hand h={o.hand} />
                <Yaku items={o.score.yaku} />
                <b>{o.score.total} {unit}</b>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="winbanner draw" role="status"><span className="wbicon" aria-hidden="true">{lang !== 'en' ? '流' : '—'}</span><div className="wbtext"><div className="wbname">{r.label ? (t('draw.' + r.label) !== 'draw.' + r.label ? t('draw.' + r.label) : r.label) : t('drawTitle')}</div></div></div>
          {v.rule.id === 'riichi' && <p className="muted">{t('tenpaiPlayers', { names: v.players.filter((_, i) => r.tenpai?.[i]).map((p) => p.name).join(', ') || t('nobody') })}</p>}
        </>
      )}
      {r.others && r.others.length > 0 && <div className="muted">{r.others.map((o) => t('alsoWins', { name: v.players[o.winner].name })).join(' · ')}</div>}
      {r.sticksWon ? <div className="muted">{t('riichiSticksWon', { n: r.sticksWon })}</div> : null}
      <Scores />
      <div className="row">
        <button className="btn gold" disabled={acked} onClick={() => send({ t: 'ack' })}>{acked ? t('waitingAck', { n: v.acks.length }) : t('nextHand')}</button>
        <button className="btn alt" onClick={onLeave}>{t('leave')}</button>
      </div>
    </div></div>,
    document.body,
  )
}
