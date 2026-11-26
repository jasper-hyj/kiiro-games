import puppeteer from 'puppeteer-core'
import { tableUrl } from '../lib/table'
// Run: npx tsx scripts/site/url-test.ts   (wrangler :8787 + vite :5200)
// Every address the site uses (see src/route.ts): the right page opens, and every older address is rewritten to its current form.
setTimeout(() => {
  console.log('TIMEOUT')
  process.exit(1)
}, 240000)
const BASE = process.env.BASE ?? 'http://localhost:5200'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const open = async (path: string, wait?: string) => {
  const p = await (await b.createBrowserContext()).newPage()
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  const errors: string[] = []
  p.on('pageerror', (e: unknown) => errors.push((e as Error).message))
  await p.goto(BASE + path, { waitUntil: 'domcontentloaded' })
  if (wait) await p.waitForSelector(wait, { timeout: 20000 }).catch(() => {})
  await sleep(600)
  return {
    p,
    errors,
    where: () => {
      const u = new URL(p.url())
      return u.pathname + u.search
    },
  }
}
const check = async (label: string, path: string, wait: string, expect: string | RegExp, title?: RegExp) => {
  const { p, errors, where } = await open(path, wait)
  const here = where()
  ok(typeof expect === 'string' ? here === expect : expect.test(here), `${label}: ${path} -> ${here}`)
  ok(!!(await p.$(wait)), `${label}: the page shows its content (${wait})`)
  if (title) ok(title.test(await p.title()), `${label}: tab title "${await p.title()}"`)
  ok(errors.length === 0, `${label}: no page errors ${errors[0] ?? ''}`)
  await p.browserContext().close()
}

// current addresses
await check('hub', '/', '.kg-table', '/', /Kiiro Games$/)
await check('room landing', '/room', '.kg-solo', '/room', /Room/)
await check('new room', '/room/new?game=holdem', '.rmpeople', /^\/room\/\d{4}$/, /Room/)
await check('holdem practice', '/holdem/practice', '.hd-actions', '/holdem/practice', /Hold/)
await check('blackjack practice', '/blackjack/practice', '.bjtable', '/blackjack/practice', /Blackjack/)
await check('bigtwo practice', '/bigtwo/practice', '.bthand .btcard', '/bigtwo/practice', /Big Two/)
await check('gomoku practice', '/gomoku/practice', '.gmboard', '/gomoku/practice', /Gomoku/)
await check('mahjong practice', '/mahjong/practice', '.handrow .tile', '/mahjong/practice', /Mahjong/)
{
  // a table made by a room opens at /<game>/<code>
  for (const [game, cfg, sel] of [
    ['holdem', { sb: 25, bb: 50, casual: true }, '.hdfelt'],
    ['blackjack', { bb: 10, casual: true }, '.bjtable'],
    ['bigtwo', {}, '.btlobby, .bttable, .plseats'],
    ['mahjong', { rule: 'taiwan' }, '.board, .roomtag, .seatcard, .lobby'],
    ['gomoku', { size: 15 }, '.btlobby, .bttable, .plseats'],
  ] as const) {
    const url = await tableUrl(game, cfg)
    await check(`${game} table`, url.replace(BASE, ''), sel, url.replace(BASE, ''))
  }
}
{
  const url = await tableUrl('bigtwo', {})
  await check('watch link', url.replace(BASE, '') + '?watch=1', '.btlobby, .bttable, .plseats', /\?watch=1$/)
}
await check('a code nobody has', '/holdem/9999', '.k-empty', '/holdem/9999')
await check('admin tab in the path', '/admin/users', '.adwrap', '/admin/users')

// old addresses are rewritten
await check('old: bare game page', '/holdem', '.rmpeople', /^\/room\/\d{4}$/)
await check('old: hub with a room', '/?room=1234', '.kg-solo, .rmtable', /^\/room(\/1234)?$/) // no such room: the address is rewritten, then the room page says so
await check('old: room with a code', '/room?room=1234', '.kg-solo, .rmtable', /^\/room(\/1234)?$/) // no such room: the address is rewritten, then the room page says so
await check('old: create with a pick', '/room?create=1&pick=bigtwo', '.rmpeople', /^\/room\/\d{4}$/)
await check('old: practice flag', '/holdem?practice=1', '.hd-actions', '/holdem/practice')
await check('old: solo mahjong', '/?solo=1&rule=taiwan&speed=0.02', '.handrow .tile', /^\/mahjong\/practice\?/)
{
  const url = await tableUrl('bigtwo', {})
  const code = url.split('/').pop()
  await check('old: table with a room flag', `/bigtwo?room=${code}&from=room&watch=1`, '.btlobby, .bttable, .plseats', `/bigtwo/${code}?watch=1`)
}
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
