import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/codebox-test.ts [port]   (vite) The four-box room code: typing moves along, backspace goes back, paste fills all four, the fourth digit goes straight to the room.
const port = process.argv[2] || '5200'
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await (await b.createBrowserContext()).newPage()
await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
const vals = () => p.$$eval('.k-codebox', (e) => (e as HTMLInputElement[]).map((x) => x.value).join('|'))
const focused = () => p.evaluate(() => Array.from(document.querySelectorAll('.k-codebox')).indexOf(document.activeElement as Element))
await p.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('.k-codebox')
ok((await p.$$('.k-codebox')).length === 4, 'four boxes')
await p.click('.k-codebox'); await p.keyboard.type('48')
ok(await vals() === '4|8||' && await focused() === 2, `typing fills box by box and moves on (${await vals()}, focus ${await focused()})`)
await p.keyboard.press('Backspace')
ok(await vals() === '4|||' && await focused() === 1, `backspace steps back (${await vals()}, focus ${await focused()})`)
await p.keyboard.type('x'); ok(await vals() === '4|||', 'letters are ignored')
await p.keyboard.type('271')
await p.waitForFunction(() => location.pathname.startsWith('/room/'), { timeout: 5000 }).catch(() => {})
ok(new URL(p.url()).pathname === '/room/4271', `the fourth digit opens the room (${new URL(p.url()).pathname})`)
// paste on the room page
await p.goto(`http://localhost:${port}/room`, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('.k-codebox')
await p.evaluate(() => { const el = document.querySelector('.k-codebox') as HTMLInputElement; el.focus(); const dt = new DataTransfer(); dt.setData('text', '9 3-0'); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })) })
await sleep(300)
ok((await vals()) === '9|3|0|', `pasting fills the boxes (${await vals()})`)
await b.close(); console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
