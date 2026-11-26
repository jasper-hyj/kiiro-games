import { Server, type Connection, type WSMessage } from 'partyserver'
import { AutoStart } from '../lib/autostart'
import { TalkLog } from '../lib/talk'
import type { Env } from '../d1'
import { userFromToken } from '../auth'
import { recordMatch } from '../matches'
import { ENGINES, isGeneric } from '../../src/games/frame/registry'
import type { TurnGame } from '../../src/games/frame/base'

type Conn = Connection<{ id?: string }>
const clean = (s: unknown, n = 140) =>
  String(s ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n)

/**
 * One table of any turn-based game on the shared frame (src/games/frame/base.ts): Gomoku, Yahtzee, Chess ...
 * Same shape as the older tables: a room prepares it (kind, settings, host), the first person to open it sits down,
 * the others join, watch or take a free seat; ranked tables settle chips zero-sum between the signed-in humans.
 */
export class Play extends Server<Env> {
  private game: TurnGame | null = null
  private kind: string | null = null
  private accounts = new Map<string, { userId: string; name: string }>()
  private watchers = new Set<string>()
  private names = new Map<string, string>()
  private chat = new TalkLog()
  private autoStart = new AutoStart()
  /** a table made from a room starts by itself (ranked tables wait for the host: their accounts are checked first) */
  private maybeAutoStart() {
    const g = this.game
    if (!g) return
    this.autoStart.check(g.seats.filter((x) => x.id).length, g.seats.length, () => {
      if (g.status !== 'lobby' || !g.hostId || g.config.ranked) return
      g.start(g.hostId)
      this.pushViews()
    })
  }
  private pending: { game: string; cfg: Record<string, unknown>; host: string; until: number } | null = null
  private recorded: string | null = null
  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private store: { get<T>(k: string): Promise<T | undefined>; put(k: string, v: unknown): Promise<void>; delete(k: string): Promise<unknown> }
  private envv: Env
  constructor(ctx: ConstructorParameters<typeof Server>[0], env: Env) {
    super(ctx, env)
    this.envv = env
    this.store = (ctx as unknown as { storage: Play['store'] }).storage
  }

  async onStart() {
    try {
      this.kind = (await this.store.get<string>('kind')) ?? null
      const saved = await this.store.get<string>('game')
      if (this.kind && isGeneric(this.kind) && saved) {
        this.make(this.kind)
        this.game!.restore(saved)
      }
      this.pending = (await this.store.get<Play['pending']>('pending')) ?? null
      const acc = await this.store.get<[string, { userId: string; name: string }][]>('accounts')
      if (acc) this.accounts = new Map(acc)
      this.recorded = (await this.store.get<string>('recorded')) ?? null
    } catch (e) {
      console.error('play restore failed', e)
    }
  }

  private make(kind: string) {
    const g = ENGINES[kind]()
    g.onChange(() => {
      this.pushViews()
      this.persistSoon()
    })
    g.onOver = (x) => {
      void this.record(x)
    }
    this.game = g
    this.kind = kind
  }
  private persistSoon() {
    if (this.persistTimer) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      const g = this.game
      if (!g || !g.hasPlayers()) {
        void this.store.delete('game')
        void this.store.delete('kind')
        this.kind = null
        this.game = null
        return
      }
      void this.store.put('kind', this.kind)
      void this.store.put('game', g.serialize())
      void this.store.put('accounts', [...this.accounts])
    }, 400)
  }
  private livePending() {
    if (this.pending && this.pending.until < Date.now()) {
      this.pending = null
      void this.store.delete('pending')
    }
    return this.pending
  }

  /** a table with nobody at it, or a prepared one: public status for the room-code check */
  async onRequest(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname
    if (path.endsWith('/status')) return Response.json({ kind: this.kind, taken: !!this.game?.hasPlayers() })
    if (request.method === 'POST' && path.endsWith('/__prepare')) {
      const b = (await request.json().catch(() => ({}))) as { game?: string; cfg?: Record<string, unknown>; host?: string; expect?: number }
      if (!b.game || !isGeneric(b.game) || typeof b.host !== 'string') return Response.json({ error: 'bad_request' }, { status: 400 })
      const here = [...this.getConnections()].length > 0 // seats that only wait out the reconnect grace do not hold the table
      if (this.game?.hasPlayers() && here)
        return Response.json(this.kind === b.game ? { ok: true, existing: true } : { error: 'code_taken', kind: this.kind }, {
          status: this.kind === b.game ? 200 : 409,
        })
      if (this.game) {
        this.game.dispose()
        void this.store.delete('game')
        void this.store.delete('kind')
      }
      this.game = null
      this.kind = null
      this.pending = { game: b.game, cfg: b.cfg && typeof b.cfg === 'object' ? b.cfg : {}, host: b.host, until: Date.now() + 15 * 60e3 }
      void this.store.put('pending', this.pending)
      this.autoStart.expect(b.expect)
      return Response.json({ ok: true })
    }
    return new Response('Not found', { status: 404 })
  }

  private send(c: Connection, m: unknown) {
    c.send(JSON.stringify(m))
  }
  private watching() {
    const ids = new Set<string>()
    for (const c of this.getConnections<{ id?: string }>()) {
      const id = c.state?.id
      if (id && this.watchers.has(id)) ids.add(id)
    }
    return ids.size
  }
  private sendView(c: Connection, id: string) {
    const g = this.game
    if (!g) return
    this.send(c, { t: 'pview', game: this.kind, view: { ...g.view(id), signedIn: this.accounts.has(id), watching: this.watching() } })
  }
  private pushViews() {
    for (const c of this.getConnections<{ id?: string }>()) {
      const id = c.state?.id
      if (id) this.sendView(c, id)
    }
  }

  async onMessage(sender: Conn, raw: WSMessage) {
    let m: any
    try {
      m = JSON.parse(String(raw))
    } catch {
      return
    }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return
    try {
      await this.handle(m, sender)
    } catch (e) {
      console.error('play handler error', e)
    }
  }

  private async handle(m: any, sender: Conn) {
    if (m.t === 'ping') return this.send(sender, { t: 'pong', ts: Number(m.ts) || 0 })
    if (m.t === 'join') {
      const id = typeof m.id === 'string' ? m.id : ''
      if (!id || id.length > 64) return this.send(sender, { t: 'error', message: 'bad_id' })
      const want = String(m.game ?? '')
      const pend = this.livePending()
      if (pend && pend.game !== want) return this.send(sender, { t: 'error', message: 'wrong_game:' + pend.game })
      let create = m.create === true
      if (!this.game) {
        if (!create && !pend) return this.send(sender, { t: 'error', message: 'room_not_found' })
        if (!isGeneric(want)) return this.send(sender, { t: 'error', message: 'bad_game' })
        this.make(want)
        void this.store.put('kind', want)
        create = true
      } else if (this.kind !== want) return this.send(sender, { t: 'error', message: 'wrong_game:' + this.kind })
      else if (pend && !this.game.hasPlayers()) create = true
      const g = this.game!
      const verdict = g.admit(id, create)
      if (verdict !== 'ok') return this.send(sender, { t: 'error', message: verdict })
      // a valid session makes this player a signed-in one (named after the account); anything else plays as a guest
      let name = typeof m.name === 'string' ? m.name : 'Player'
      if (typeof m.token === 'string' && m.token && this.envv.DB) {
        const u = await userFromToken(this.envv.DB, m.token)
        if (u) {
          const other = [...this.accounts].find(([cid, a]) => a.userId === u.id && cid !== id && g.seatOf(cid) >= 0)
          if (other) return this.send(sender, { t: 'error', message: 'already_seated' })
          this.accounts.set(id, { userId: u.id, name: u.name })
          name = u.name
        } else this.accounts.delete(id)
      } else this.accounts.delete(id)
      this.names.set(id, name)
      sender.setState({ id })
      // asked to watch, or no seat is free: watch instead of being turned away
      if (m.watch === true || g.join(id, name) < 0) this.watchers.add(id)
      else this.watchers.delete(id)
      this.applyPending(id)
      this.maybeAutoStart()
      this.pushViews()
      if (this.chat.messages.length) this.send(sender, { t: 'talklog', msgs: this.chat.messages })
      return
    }
    const id = sender.state?.id
    if (!id || !this.game) return
    const g = this.game
    if (m.t === 'talk') return this.talk(id, sender, m.text)
    if (m.t === 'bye') {
      g.leave(id, true)
      this.watchers.delete(id)
      return
    }
    if (m.t !== 'p') return
    const msg = m.m
    const err = (message: string) => this.send(sender, { t: 'error', message })
    if (msg?.k === 'config' && msg.config?.ranked === true && !this.accounts.has(id)) {
      msg.config.ranked = false
      err('ranked_needs_signin')
    }
    if (msg?.k === 'start' && g.config.ranked && id === g.hostId) {
      const humans = g.seats.filter((s) => s.id)
      if (humans.length < 2 || humans.some((s) => !this.accounts.has(s.id!))) return err('ranked_needs_players')
    }
    if (msg?.k === 'sit' && g.seatOf(id) < 0) {
      if (g.join(id, this.accounts.get(id)?.name ?? this.names.get(id) ?? 'Player') < 0) return err('room_full')
      this.watchers.delete(id)
      this.pushViews()
      return
    }
    const e = g.message(id, msg)
    if (e) err(e)
  }

  /** the room's settings go onto the table when someone sits, and the room's host becomes the table's host when they arrive */
  private applyPending(id: string) {
    const pend = this.livePending()
    const g = this.game
    if (!pend || !g || this.kind !== pend.game) return
    if (g.hostId) g.setConfig(g.hostId, pend.cfg)
    if (id === pend.host && g.seatOf(id) >= 0) {
      g.hostId = id
      g.setConfig(id, pend.cfg)
      this.pending = null
      void this.store.delete('pending')
    }
  }

  private talk(id: string, sender: Conn, raw: unknown) {
    const msg = this.chat.say(id, this.accounts.get(id)?.name ?? this.names.get(id) ?? 'Player', raw)
    if (msg === 'slow_down') return this.send(sender, { t: 'error', message: 'slow_down' })
    if (msg) for (const c of this.getConnections<{ id?: string }>()) if (c.state?.id) this.send(c, { t: 'talk', msg })
  }

  /** a finished game is saved once; competitive games move chips zero-sum between the signed-in humans (bots never move chips) */
  private async record(g: TurnGame) {
    if (!this.envv.DB || !g.result || !g.matchId || this.recorded === g.matchId || !this.kind) return
    this.recorded = g.matchId
    void this.store.put('recorded', g.matchId)
    const ranked = g.config.ranked === true
    const players = g.seats.map((s, i) => ({
      seat: i,
      name: s.name,
      userId: s.id && !s.bot ? (this.accounts.get(s.id)?.userId ?? null) : null,
      points: g.result!.points[i] ?? 0,
    }))
    const humans = players.filter((p) => p.userId)
    const mean = humans.length ? humans.reduce((a, p) => a + p.points, 0) / humans.length : 0
    const chips: Record<number, number> = {}
    if (ranked && humans.length >= 2) for (const p of humans) chips[p.seat] = Math.round(g.meta.chipUnit * (p.points - mean))
    try {
      await recordMatch(this.envv.DB, {
        id: g.matchId,
        game: this.kind,
        rule: 'standard',
        ranked,
        room: this.name,
        startedAt: g.startedAt,
        config: g.config,
        players,
        history: { winner: g.result.winner, summary: g.result.summary ?? null },
        replay: null,
        chips,
        settle: true,
      })
    } catch (e) {
      console.error('play record failed', e)
      this.recorded = null
    }
  }

  onClose(conn: Conn) {
    const id = conn.state?.id
    if (!id || !this.game) return
    if ([...this.getConnections<{ id?: string }>()].some((c) => c.id !== conn.id && c.state?.id === id)) return
    this.game.leave(id)
  }
}
