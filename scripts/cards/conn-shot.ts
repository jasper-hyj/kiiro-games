import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/conn-shot.ts <outDir> [port]   The waiting screen at 1s and 13s, on a phone (no server needs to be running: the table never answers).
const out = process.argv[2] || '.'
const port = process.argv[3] || '5200'
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: 390, height: 600, hasTouch: true, isMobile: true })
await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
await p.evaluateOnNewDocument(() => {
  ;(window as any).WebSocket = class {
    readyState = 0
    send() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  }
})
await p.goto(`http://localhost:${port}/holdem/4271`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('.k-conn', { timeout: 15000 })
await new Promise((r) => setTimeout(r, 1200))
await p.screenshot({ path: `${out}/conn1.png` })
await new Promise((r) => setTimeout(r, 12500))
await p.screenshot({ path: `${out}/conn2.png` })
console.log(await p.$eval('.k-conn', (e) => e.textContent))
await b.close()
