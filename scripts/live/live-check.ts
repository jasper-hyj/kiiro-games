export {}
// Run: npx tsx scripts/live/live-check.ts [workerHost]   Read-only checks of the deployed Worker: accounts API, and that both Durable Object parties (main, room) accept connections.
const host = process.argv[2] || 'kiiro-games.jasper-hyj.workers.dev'
const tryWs = (party: string) =>
  new Promise<string>((res) => {
    const ws = new WebSocket(`wss://${host}/parties/${party}/${Math.floor(1000 + Math.random() * 9000)}`)
    const t = setTimeout(() => {
      res('timeout')
      try {
        ws.close()
      } catch {
        /* ignore */
      }
    }, 8000)
    ws.onopen = () => {
      ws.send(JSON.stringify({ t: 'ping', ts: 1 }))
      setTimeout(() => {
        clearTimeout(t)
        res('open')
        ws.close()
      }, 700)
    }
    ws.onerror = () => {
      clearTimeout(t)
      res('error')
    }
  })
console.log('config  :', await (await fetch(`https://${host}/api/config`)).text())
console.log('main    :', await tryWs('main'))
console.log('room    :', await tryWs('room'))
process.exit(0)
