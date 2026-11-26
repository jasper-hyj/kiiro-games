import { getServerByName, Server, type Connection, type WSMessage } from 'partyserver'
import type { Env } from './d1'
import { userFromToken } from './auth'
import { BLINDS } from '../src/games/holdem/engine/table'
import { MIN_BETS } from '../src/games/blackjack/engine/table'
import { DEFAULT_CONFIG } from '../src/games/mahjong/engine/table'

import { ENGINES, isGeneric } from '../src/games/generic/registry'
export type RoomGame = 'mahjong' | 'holdem' | 'blackjack' | 'bigtwo' | (string & {})
const GAMES: RoomGame[] = ['mahjong', 'holdem', 'blackjack', 'bigtwo', ...Object.keys(ENGINES)]
const MJ_RULES = ['taiwan', 'hk', 'riichi', 'mcr', 'sichuan']
const KEEP_MS = 12 * 3600e3 // a room stays findable this long after its last visitor, so people can come back to it after a game

interface Member {
  name: string
  watching: boolean
  signedIn: boolean
}
type Cfg = Record<string, string | number | boolean>

/**
 * A room is where people gather before (and between) games: the host picks the game and its rules, everyone sees it live,
 * chats, and says whether they will play or just watch. Starting sends everyone to that game's table under the same code.
 * Room codes live in their own namespace here, so a room and a table can share digits; the game pages handle that rare clash.
 */
export class Room extends Server<Env> {
  private members = new Map<string, Member>()
  private hostId: string | null = null
  private game: RoomGame | null = null
  private cfg: Cfg = {}
  private launched = false
  private alive = 0
  private talkLog: { n: number; name: string; text: string }[] = []
  private talkN = 0
  private lastTalk = new Map<string, number>()
  private store: { get<T>(k: string): Promise<T | undefined>; put(k: string, v: unknown): Promise<void> }
  private envv: Env
  constructor(ctx: ConstructorParameters<typeof Server>[0], env: Env) {
    super(ctx, env)
    this.envv = env
    this.store = (ctx as unknown as { storage: Room['store'] }).storage
  }

  async onStart() {
    const s = await this.store.get<{ hostId: string | null; game: RoomGame | null; cfg: Cfg; launched: boolean; alive: number; talk: Room['talkLog'] }>('room')
    if (s) {
      this.hostId = s.hostId
      this.game = s.game
      this.cfg = s.cfg ?? {}
      this.launched = !!s.launched
      this.alive = s.alive
      this.talkLog = s.talk ?? []
      this.talkN = this.talkLog.at(-1)?.n ?? 0
    }
  }
  private save() {
    this.alive = Date.now() + KEEP_MS
    void this.store.put('room', { hostId: this.hostId, game: this.game, cfg: this.cfg, launched: this.launched, alive: this.alive, talk: this.talkLog })
  }
  private exists() {
    return this.members.size > 0 || this.alive > Date.now()
  }
  private send(c: Connection, m: unknown) {
    c.send(JSON.stringify(m))
  }
  private err(c: Connection, message: string) {
    this.send(c, { t: 'error', message })
  }

  private view(id: string) {
    return {
      t: 'room',
      you: id,
      host: id === this.hostId,
      game: this.game,
      cfg: this.cfg,
      launched: this.launched,
      members: [...this.members].map(([mid, m]) => ({ name: m.name, host: mid === this.hostId, watching: m.watching, signedIn: m.signedIn, me: mid === id })),
    }
  }
  private pushViews() {
    for (const c of this.getConnections<{ id?: string }>()) if (c.state?.id) this.send(c, this.view(c.state.id))
  }

  /** Only the values each game understands, nothing else a client might send. */
  private clean(game: RoomGame, raw: unknown, host: Member | undefined): { cfg: Cfg; error?: string } {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const cfg: Cfg = {}
    let error: string | undefined
    const ranked = r.ranked === true
    if (game === 'mahjong') {
      const rule = MJ_RULES.includes(String(r.rule)) ? String(r.rule) : 'taiwan'
      cfg.rule = rule
      // every Mahjong setting is chosen here, in the room (the table's lobby only shows them): validated the way the table itself does
      const rounds = Number(r.rounds)
      cfg.rounds = rule === 'taiwan' ? (rounds === 4 ? 4 : 1) : rounds === 2 ? 2 : 1
      cfg.players = (rule === 'riichi' || rule === 'hk') && Number(r.players) === 3 ? 3 : 4
      cfg.botLevel = r.botLevel === 'easy' || r.botLevel === 'hard' ? String(r.botLevel) : 'normal'
      cfg.coach = r.coach !== false
      if (rule === 'riichi') cfg.aka = r.aka !== false
      if (rule === 'sichuan') cfg.swap = r.swap !== false
      if (rule === 'hk' || rule === 'mcr') {
        const f = Number(r.minFan)
        cfg.minFan = Number.isInteger(f) && f >= 0 && f <= 13 ? f : rule === 'mcr' ? 8 : DEFAULT_CONFIG.minFan
      }
      if (ranked && host?.signedIn) cfg.ranked = true
      else if (ranked) error = 'ranked_needs_signin'
    } else if (game === 'bigtwo') {
      if (ranked && host?.signedIn) cfg.ranked = true
      else if (ranked) error = 'ranked_needs_signin'
    } else if (game === 'holdem') {
      const b = BLINDS.find(([sb, bb]) => sb === Number(r.sb) && bb === Number(r.bb)) ?? BLINDS[2]
      cfg.sb = b[0]
      cfg.bb = b[1]
      cfg.casual = r.casual !== false
    } else if (isGeneric(game)) {
      Object.assign(cfg, ENGINES[game]().sanitize(r))
      if (cfg.ranked === true && !host?.signedIn) {
        delete cfg.ranked
        error = 'ranked_needs_signin'
      }
    } else {
      cfg.bb = MIN_BETS.includes(Number(r.bb)) ? Number(r.bb) : MIN_BETS[0]
      cfg.casual = r.casual !== false
    }
    return { cfg, error }
  }

  async onMessage(sender: Connection<{ id?: string }>, raw: WSMessage) {
    let m: Record<string, unknown>
    try {
      m = JSON.parse(String(raw))
    } catch {
      return
    }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return
    try {
      await this.handle(m, sender)
    } catch (e) {
      console.error('room handler error', e)
    }
  }

  private async handle(m: Record<string, unknown>, c: Connection<{ id?: string }>) {
    if (m.t === 'ping') return this.send(c, { t: 'pong', ts: Number(m.ts) || 0 })
    if (m.t === 'join') {
      const id = typeof m.id === 'string' ? m.id : ''
      if (!id || id.length > 64) return this.err(c, 'bad_id')
      const known = this.members.has(id)
      if (!known) {
        if (!this.exists() && m.create !== true) return this.err(c, 'room_not_found')
        if (this.exists() && m.create === true && this.members.size > 0) return this.err(c, 'code_taken')
      }
      let name =
        String(m.name ?? 'Player')
          .replace(/[\u0000-\u001f\u007f<>]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 16) || 'Player'
      let signedIn = false
      if (typeof m.token === 'string' && m.token && this.envv.DB) {
        const u = await userFromToken(this.envv.DB, m.token)
        if (u) {
          name = u.name
          signedIn = true
        }
      }
      if (m.create === true && this.members.size === 0) {
        this.game = null
        this.cfg = {}
        this.launched = false
        this.talkLog = []
        this.hostId = null
      } // an old, empty room code is reused as a fresh room
      const prev = this.members.get(id)
      this.members.set(id, { name, signedIn, watching: prev?.watching ?? false })
      c.setState({ id })
      if (!this.hostId || !this.members.has(this.hostId)) this.hostId = id
      this.save()
      this.pushViews()
      if (this.talkLog.length) this.send(c, { t: 'talklog', msgs: this.talkLog })
      return
    }
    const id = c.state?.id
    if (!id || !this.members.has(id)) return
    const me = this.members.get(id)!
    switch (m.t) {
      case 'rename': {
        if (me.signedIn) return // signed-in people keep their account name
        const n = String(m.name ?? '')
          .replace(/[\u0000-\u001f\u007f<>]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 16)
        if (n.length < 2) return this.err(c, 'bad_name')
        me.name = n
        this.pushViews()
        this.save()
        return
      }
      case 'mode':
        me.watching = m.watching === true
        this.pushViews()
        this.save()
        return
      case 'pick': {
        if (id !== this.hostId) return this.err(c, 'host_only')
        const game = GAMES.find((g) => g === m.game)
        if (!game) return
        const { cfg, error } = this.clean(game, m.cfg, me)
        this.game = game
        this.cfg = cfg
        this.launched = false
        if (error) this.err(c, error)
        this.save()
        this.pushViews()
        return
      }
      case 'launch': {
        if (id !== this.hostId) return this.err(c, 'host_only')
        if (!this.game) return this.err(c, 'pick_first')
        // the table is made here, on the server, with these settings and this host: nobody carries them in a URL, and nobody arrives before it exists
        const ns = isGeneric(this.game) ? this.envv.Play : this.envv.Main
        const party = isGeneric(this.game) ? 'play' : 'main'
        if (ns) {
          try {
            const stub = await getServerByName(ns as never, this.name)
            const r = await stub.fetch(
              new Request(`https://table/parties/${party}/${this.name}/__prepare`, {
                method: 'POST',
                body: JSON.stringify({ game: this.game, cfg: this.cfg, host: id, expect: [...this.members.values()].filter((m) => !m.watching).length }),
              }),
            )
            if (r.status === 409) return this.err(c, 'rmCodeClash')
            if (!r.ok) return this.err(c, 'rmTableFailed')
          } catch {
            return this.err(c, 'rmTableFailed')
          }
        }
        this.launched = true
        this.save()
        this.pushViews()
        for (const conn of this.getConnections<{ id?: string }>()) {
          const cid = conn.state?.id
          if (!cid) continue
          this.send(conn, { t: 'go', game: this.game, cfg: this.cfg, role: cid === this.hostId ? 'host' : this.members.get(cid)?.watching ? 'watch' : 'play' })
        }
        return
      }
      case 'talk': {
        const text = String(m.text ?? '')
          .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 140)
        if (!text) return
        const now = Date.now()
        if (now - (this.lastTalk.get(id) ?? 0) < 1000) return this.err(c, 'slow_down')
        this.lastTalk.set(id, now)
        const msg = { n: ++this.talkN, name: me.name, text }
        this.talkLog.push(msg)
        if (this.talkLog.length > 40) this.talkLog.shift()
        this.save()
        for (const conn of this.getConnections<{ id?: string }>()) if (conn.state?.id) this.send(conn, { t: 'talk', msg })
        return
      }
      case 'bye':
        this.leave(id)
        return
    }
  }

  private leave(id: string) {
    this.members.delete(id)
    if (this.hostId === id) this.hostId = [...this.members.keys()][0] ?? this.hostId // the next person in the room takes over
    if (this.hostId && !this.members.has(this.hostId) && this.members.size > 0) this.hostId = [...this.members.keys()][0]
    this.save()
    this.pushViews()
  }

  onClose(conn: Connection<{ id?: string }>) {
    const id = conn.state?.id
    if (!id) return
    // a refresh or a move to a game page reconnects with the same id: only forget the person if no other socket of theirs is open
    if ([...this.getConnections<{ id?: string }>()].some((c) => c.id !== conn.id && c.state?.id === id)) return
    // keep the member for a short grace period, so a page change does not hand the host role away mid-launch
    setTimeout(
      () => {
        if ([...this.getConnections<{ id?: string }>()].some((c) => c.state?.id === id)) return
        this.leave(id)
      },
      this.launched ? 60000 : 4000,
    )
  }
}
