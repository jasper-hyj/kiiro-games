import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../../i18n'
import { Bar } from '../../hub/Hub'
import { Card } from '../holdem/ui/Cards'
import { TalkBox } from '../shared/TalkBox'
import { fromRoom } from '../shared/fromRoom'
import { Kbd, ResultPanel, SeatChip, TableHeader, useHotkeys } from '../../ui/components'
import { beats, evalCombo, power, THREE_DIAMONDS } from './engine/combos'
import { chooseMove } from './engine/table'
import type { BigTwoView, BtMsg } from './net/protocol'
import type { Status, TalkMsg } from '../shared/cashClient'
import type { useAccount } from '../../account/Account'

interface Props {
  v: BigTwoView; status: Status; room: string; error: string; send: (m: BtMsg) => void; talk: TalkMsg[]; say(text: string): void
  leave(): void; me: ReturnType<typeof useAccount>['me']; openSignIn(): void
}

/** The width of an element, kept up to date (the hand sizes its cards to it). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(340)
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    const on = () => setW(el.clientWidth || 340)
    on()
    const ro = new ResizeObserver(on); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** Big Two: the lobby, the table, your hand and what you can do with it. Same controls with a finger, a mouse or a keyboard. */
export function BtTable({ v, status, room, error, send, talk, say, leave, me, openSignIn }: Props) {
  const { t } = useLang()
  const [sel, setSel] = useState<number[]>([])
  const [copied, setCopied] = useState(false)
  const [, tick] = useState(0)
  const deadline = useRef<number | null>(null)
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(i) }, [])
  useEffect(() => { deadline.current = v.timeLeft != null ? Date.now() + v.timeLeft : null }, [v])
  // a play or a new game clears the selection
  const key = `${v.game}:${v.last.length}:${v.status}`
  useEffect(() => { setSel([]) }, [key])

  const copy = async () => { try { await navigator.clipboard.writeText(`${location.origin}/room?room=${room}`); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ } }
  const watcher = v.you < 0
  const ref = Math.max(0, v.you)
  const rel = (seat: number) => (seat - ref + 4) % 4 // 0 me, 1 left, 2 top, 3 right
  const myTurn = v.status === 'playing' && v.turn === v.you
  const chosen = sel.length ? evalCombo(sel) : null
  const curCombo = v.current ? evalCombo(v.current.cards) : null
  const curName = curCombo ? t('btt.' + curCombo.type) : ''
  const legal = !!chosen && beats(chosen, curCombo) && (!v.mustOpen || sel.includes(THREE_DIAMONDS))
  const secs = deadline.current ? Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)) : null
  const hand = useMemo(() => [...v.hand].sort((a, b) => power(a) - power(b)), [v.hand])

  // why a play is not possible, in plain words (shown right under the hand)
  const reason = !myTurn ? '' : sel.length === 0
    ? (v.mustOpen ? t('btOpen') : !v.current ? t('btLead') : t('btBeatPrompt', { play: curName }))
    : !chosen ? t('btInvalid')
      : v.mustOpen && !sel.includes(THREE_DIAMONDS) ? t('btNeed3')
        : !beats(chosen, curCombo) ? (curCombo && chosen.size !== curCombo.size ? t('btSameCount', { n: curCombo.size, play: curName }) : t('btTooLow', { play: curName })) : ''

  const play = () => { if (myTurn && legal) send({ k: 'play', cards: sel }) }
  const pass = () => { if (myTurn && v.canPass) send({ k: 'pass' }) }
  const hint = () => {
    if (!myTurn) return
    const m = chooseMove(v.hand, curCombo, v.mustOpen)
    if (m) setSel(m.cards)
    else if (v.canPass) setSel([])
  }
  useHotkeys({ enter: v.status === 'playing' ? play : undefined, p: pass, h: hint, escape: () => setSel([]) }, v.status === 'playing' && !watcher)

  const head = (
    <>
      <Bar />
      <TableHeader title={room === 'practice' ? t('practiceTitle') : `${t('hdRoom')} ${room}`} sub={room === 'practice' ? t('btCasual') : v.config.ranked ? t('btRanked') : t('btCasual')}
        watching={v.watching} copied={copied} onCopy={room === 'practice' ? undefined : copy} onLeave={leave} leaveLabel={fromRoom() ? t('rmBack') : t('hdLeave')} status={status} />
      {error && <p className="acerr hdbanner" role="alert">{t(error)}</p>}
    </>
  )

  /* ------------------------------------------------------------ lobby */
  if (v.status === 'lobby') {
    return (
      <div className="kg hd bt"><div className="kg-wrap hdwrap">{head}
        <h2 className="btsec">{t('btSeats')}</h2>
        <ul className="btlobby">
          {v.seats.map((s) => (
            <li key={s.seat} className={s.empty ? 'bot' : ''}>
              <SeatChip name={s.empty ? t('btBot') : s.name} sub={s.empty ? undefined : s.me ? t('btYou') : s.seat === 0 ? t('rmHost') : undefined} state={s.me ? 'me' : s.empty ? 'away' : ''} />
            </li>
          ))}
        </ul>
        {watcher && <p className="kg-note">{t('hdSpectating')} <button className="hdbtn primary" onClick={() => send({ k: 'sit' })}>{t('hdSit')}</button></p>}
        {v.host ? (
          <div className="hdform">
            <div className="hdseg"><button className={!v.config.ranked ? 'on' : ''} onClick={() => send({ k: 'config', config: { ranked: false } })}>{t('btCasual')}</button>
              <button className={v.config.ranked ? 'on' : ''} disabled={!me} onClick={() => send({ k: 'config', config: { ranked: true } })}>{t('btRanked')}</button></div>
            <p className="kg-note">{me ? t('btRankedHint') : <>{t('acRankedLocked')} <button className="hdlink" onClick={openSignIn}>{t('acSignIn')}</button></>}</p>
            <div><button className="hdbtn primary" onClick={() => send({ k: 'start' })}>{t('btStart')}</button></div>
          </div>
        ) : !watcher && <p className="kg-note">{t('btWaitHost')}</p>}
        {v.watching > 0 && <p className="kg-note">{t('btWatchers', { n: v.watching })}</p>}
        <p className="kg-note">{t('btRules')}</p>
        {room !== 'practice' && <TalkBox lines={talk} say={say} />}
      </div></div>
    )
  }

  const msg = v.status === 'over' ? '' : myTurn ? t('btYourTurn') + (secs != null ? ` · ${secs}s` : '') : v.turn >= 0 ? t('btWaitTurn', { name: v.seats[v.turn].name }) : ''
  return (
    <div className="kg hd bt"><div className="kg-wrap hdwrap">{head}
      <div className="bttable k-felt">
        {v.seats.filter((s) => s.seat !== ref).map((s) => (
          <SeatChip key={s.seat} className={'btseat pos' + rel(s.seat)} name={s.name} state={(v.turn === s.seat && v.status === 'playing' ? 'turn' : '') + (!s.connected && !s.bot ? ' away' : '')}
            sub={<span className="bt-count"><i className="bt-cardicon" aria-hidden="true" />{s.count}</span>}>
            {s.passed && v.status === 'playing' && <div className="btpass">{t('btPassed')}</div>}
          </SeatChip>
        ))}
        <div className="btcenter">
          {v.status === 'over' && v.result ? (
            <ResultPanel title={t('btWins', { name: v.seats[v.result.winner].name })} columns={[t('acPlayer'), t('btPoints')]}
              rows={v.seats.map((s) => ({ name: s.name, me: s.me, value: `${v.result!.points[s.seat] > 0 ? '+' : ''}${v.result!.points[s.seat]}`, tone: v.result!.points[s.seat] > 0 ? 'up' : v.result!.points[s.seat] < 0 ? 'down' : 'flat', detail: t('btLeft', { n: v.result!.left[s.seat] }) }))}
              note={v.host ? undefined : t('btWaitHost')}>
              {v.host && <button className="hdbtn primary" onClick={() => send({ k: 'lobby' })}>{t('btAgain')}</button>}
            </ResultPanel>
          ) : (
            <>
              <div className="btplay">{v.current ? v.current.cards.map((c) => <Card key={c} c={c} />) : <span className="pkslot" />}</div>
              {v.current && <div className="muted small">{v.seats[v.current.seat].name} · {curName}</div>}
              <div className={'hdmsg' + (myTurn ? ' mine' : '')} aria-live="polite">{msg}</div>
            </>
          )}
        </div>
      </div>

      {watcher ? (
        <div className="bt-watchbar"><span className="muted small">{t('hdSpectating')}{v.watching > 0 ? ` · ${t('btWatchers', { n: v.watching })}` : ''}</span><button className="hdbtn primary" onClick={() => send({ k: 'sit' })}>{t('hdSit')}</button></div>
      ) : (
        <>
          <MyChip v={v} me={ref} />
          <Hand cards={hand} sel={sel} setSel={setSel} active={v.status === 'playing'} label={t('btHandLabel')} />
          <div className="bt-reason" aria-live="polite">{v.status === 'playing' ? reason : ''}</div>
          <div className="hdbar">
            <div className="hdactions bt-actions">
              <button className="hdbtn" disabled={!myTurn || !v.canPass} onClick={pass}>{t('btPassBtn')}<Kbd k="P" /></button>
              <button className="hdbtn" disabled={!myTurn} onClick={hint}>{t('btHint')}<Kbd k="H" /></button>
              {sel.length > 0 && <button className="hdbtn quiet" onClick={() => setSel([])} aria-label={t('btClear')}>{t('btClear')}<Kbd k="Esc" /></button>}
              <button className="hdbtn primary bt-play" disabled={!myTurn || !legal} onClick={play}>{t('btPlayBtn')}{chosen ? ` · ${t('btt.' + chosen.type)}` : ''}<Kbd k="↵" /></button>
            </div>
          </div>
        </>
      )}
      {room !== 'practice' && <TalkBox lines={talk} say={say} />}
    </div></div>
  )
}

/** Who you are, above your hand: the same name tag as everyone else. */
function MyChip({ v, me }: { v: BigTwoView; me: number }) {
  const { t } = useLang()
  const s = v.seats[me]
  return <div className="bt-me"><SeatChip name={s.name} state={'me' + (v.turn === me && v.status === 'playing' ? ' turn' : '')} sub={<span className="bt-count"><i className="bt-cardicon" aria-hidden="true" />{t('btCards', { n: s.count })}</span>} /></div>
}

/**
 * Your cards, as large as the screen allows (two overlapping rows on a phone). Tap a card to lift it, or press and drag across several to
 * lift or lower them together. With a keyboard: arrows move between cards, Space lifts one.
 */
function Hand({ cards, sel, setSel, active, label }: { cards: number[]; sel: number[]; setSel: (f: (s: number[]) => number[]) => void; active: boolean; label: string }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const drag = useRef<{ mode: boolean } | null>(null)
  const STEP = 0.56 // how much of each card stays visible when they overlap
  const fit = (n: number) => w / (1 + STEP * Math.max(0, n - 1))
  const two = cards.length > 8 && fit(cards.length) < 54
  const rows = two ? [cards.slice(0, Math.ceil(cards.length / 2)), cards.slice(Math.ceil(cards.length / 2))] : [cards]
  const cw = Math.max(34, Math.min(74, Math.floor(fit(Math.max(...rows.map((r) => r.length))))))
  const set = (c: number, on: boolean) => setSel((s) => (on ? (s.includes(c) || s.length >= 5 ? s : [...s, c]) : s.filter((x) => x !== c)))
  const move = (e: React.KeyboardEvent<HTMLButtonElement>, c: number) => {
    if (e.key === ' ') { e.preventDefault(); set(c, !sel.includes(c)); return }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const i = cards.indexOf(c) + (e.key === 'ArrowRight' ? 1 : -1)
      const next = cards[Math.max(0, Math.min(cards.length - 1, i))]
      ;(ref.current?.querySelector(`[data-c="${next}"]`) as HTMLElement | null)?.focus()
    }
  }
  return (
    <div className="bthand" ref={ref} role="group" aria-label={label} style={{ ['--cw' as string]: cw + 'px' }}
      onPointerMove={(e) => { if (!drag.current) return; const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('[data-c]') as HTMLElement | null; if (el) set(Number(el.dataset.c), drag.current.mode) }}
      onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onPointerLeave={() => { drag.current = null }}>
      {rows.map((row, ri) => (
        <div key={ri} className="bthand-row">
          {row.map((c) => (
            <button key={c} data-c={c} className={'btcard' + (sel.includes(c) ? ' sel' : '')} disabled={!active} aria-pressed={sel.includes(c)}
              onPointerDown={(e) => { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); const mode = !sel.includes(c); drag.current = { mode }; set(c, mode) }}
              onKeyDown={(e) => move(e, c)} onClick={(e) => e.preventDefault()}>
              <Card c={c} />
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
