import PartySocket from 'partysocket'

export type LiveStatus = 'connecting' | 'open' | 'closed'
export interface LiveOpts {
  host: string
  party?: string
  room: string
  /** called on every (re)connection: send the join message here, so the server always knows who is back */
  onOpen(send: (m: unknown) => void): void
  onMessage(m: any): void
  onStatus(s: LiveStatus): void
}

/**
 * One connection for every page that talks to a game server, built to ride out the things that really drop connections:
 * phones that sleep or switch between wifi and mobile data, a server restart (every deploy), and half-dead links the browser still calls "open".
 *  - it reconnects forever with short, capped waits, and straight away when the tab wakes, the network returns or the page is restored;
 *  - it pings every 8 s and treats ANY message from the server as proof of life: only 22 s of silence counts as dead (one slow reply never does);
 *  - the "connection lost" state is only shown after 2.5 s without a connection, so a blip that heals itself is never seen;
 *  - the join message is re-sent after every reconnect (the server keeps seats for a while and puts you straight back).
 */
export function liveSocket(o: LiveOpts) {
  const ws = new PartySocket({ host: o.host, ...(o.party ? { party: o.party } : {}), room: o.room, maxRetries: Infinity, minReconnectionDelay: 400, maxReconnectionDelay: 4000, reconnectionDelayGrowFactor: 1.4, connectionTimeout: 7000 })
  let closed = false
  let lastAlive = Date.now()
  let downTimer: ReturnType<typeof setTimeout> | null = null
  const send = (m: unknown) => { try { if (ws.readyState === 1) ws.send(JSON.stringify(m)) } catch { /* the close handler deals with it */ } }
  o.onStatus('connecting')

  const markDown = () => { if (closed || downTimer) return; downTimer = setTimeout(() => { downTimer = null; if (!closed && ws.readyState !== 1) o.onStatus('closed') }, 2500) }
  const markUp = () => { if (downTimer) { clearTimeout(downTimer); downTimer = null } }

  ws.addEventListener('open', () => { lastAlive = Date.now(); markUp(); o.onStatus('open'); o.onOpen(send) })
  ws.addEventListener('close', () => { if (!closed) markDown() })
  ws.addEventListener('error', () => { if (!closed && ws.readyState !== 1) markDown() })
  ws.addEventListener('message', (e) => {
    if (closed) return
    lastAlive = Date.now()
    let m: any; try { m = JSON.parse(String(e.data)) } catch { return }
    if (m && m.t === 'pong') return
    o.onMessage(m)
  })

  const beat = setInterval(() => send({ t: 'ping', ts: Date.now() }), 8000)
  const watchdog = setInterval(() => {
    if (closed) return
    if (ws.readyState === 1 && Date.now() - lastAlive > 22000) { markDown(); ws.reconnect() } // silent for too long: the link is dead even though it says open
    else if (ws.readyState === 3) ws.reconnect() // fully closed and not retrying
  }, 4000)
  const wake = () => {
    if (closed || document.visibilityState === 'hidden') return
    if (ws.readyState !== 1) ws.reconnect()
    else { send({ t: 'ping', ts: Date.now() }); if (Date.now() - lastAlive > 12000) lastAlive -= 11000 } // a long sleep: let the watchdog decide soon
  }
  document.addEventListener('visibilitychange', wake)
  window.addEventListener('online', wake)
  // the browser knows the network is gone long before a half-dead socket gives up: say so after a moment, and reconnect the instant it returns
  const offline = () => { if (!closed) setTimeout(() => { if (!closed && navigator.onLine === false) o.onStatus('closed') }, 1500) }
  window.addEventListener('offline', offline)
  window.addEventListener('pageshow', wake)
  window.addEventListener('focus', wake)

  return {
    ws, send,
    reconnect: () => { o.onStatus('connecting'); ws.reconnect() },
    close: () => {
      closed = true; markUp(); clearInterval(beat); clearInterval(watchdog)
      document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake); window.removeEventListener('offline', offline); window.removeEventListener('pageshow', wake); window.removeEventListener('focus', wake)
      try { ws.send(JSON.stringify({ t: 'bye' })) } catch { /* ignore */ }
      ws.close()
    },
  }
}
