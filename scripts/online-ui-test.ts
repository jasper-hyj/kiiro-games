import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:5199'
const SHOTS = process.env.SHOTS ?? '/tmp/shots'
mkdirSync(SHOTS, { recursive: true })
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

let fails = 0
const check = (name: string, ok: boolean, extra = '') => {
  if (!ok) fails++
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : extra)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const text = (p: Page) => p.evaluate(() => document.body.innerText)
const clickText = (p: Page, sel: string, re: RegExp) =>
  p.evaluate((sel, src, fl) => {
    const r = new RegExp(src, fl)
    const el = [...document.querySelectorAll<HTMLElement>(sel)].find((e) => r.test(e.innerText))
    if (!el) return false
    el.click()
    return true
  }, sel, re.source, re.flags)

async function tapSel(p: Page, touch: boolean, sel: string, nth = 0) {
  const h = (await p.$$(sel))[nth]
  if (!h) return false
  await h.evaluate((e) => e.scrollIntoView({ block: 'center' }))
  const b = await h.boundingBox()
  if (!b) return false
  if (touch) await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
  else await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
  return true
}
async function playTurn(p: Page, touch: boolean) {
  if (await p.$('.overlay .btn.gold:not([disabled])')) {
    await p.evaluate(() => (document.querySelector('.overlay .btn.gold') as HTMLElement)?.click())
    return
  }
  if (await p.$('.cbtn.pass')) { await tapSel(p, touch, '.cbtn.pass'); return }
  const tiles = await p.$$('.handrow .tile.clickable')
  if (tiles.length) {
    await tapSel(p, touch, '.handrow .tile.clickable', tiles.length - 1)
    await sleep(150)
    await tapSel(p, touch, '.handrow .tile.sel')
  }
}
const pondCounts = (p: Page) => p.evaluate(() => ['p0', 'p1', 'p2', 'p3'].map((k) => document.querySelectorAll(`.pond.${k} .tile`).length))

async function hostCreate(p: any) {
  await p.evaluate(() => (document.querySelector('.btn.gold') as HTMLElement).click())   // Play with friends
  await p.waitForSelector('button.rule')
  await p.evaluate(() => (document.querySelector('button.rule') as HTMLElement).click())  // pick Taiwanese
  await p.waitForSelector('input.bigname')
  await p.evaluate(() => (document.querySelector('.btn.gold') as HTMLElement).click())   // Create room
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
  try {
    const ctxA = await browser.createBrowserContext()
    const ctxB = await browser.createBrowserContext()
    const A = await ctxA.newPage()
    await A.setViewport({ width: 1280, height: 800 })
    const B = await ctxB.newPage()
    await B.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
    for (const [p, n] of [[A, 'A'], [B, 'B']] as const) {
      p.on('pageerror', (e) => { fails++; console.log('FAIL pageerror', n, String(e).slice(0, 200)) })
      await p.evaluateOnNewDocument(() => { try { localStorage.setItem('kiiro-lang', 'en') } catch { /* ignore */ } })
    }

    // 1. host creates a room
    await A.goto(BASE, { waitUntil: 'networkidle0' })
    await hostCreate(A)
    await A.waitForSelector('.copyrow input[readonly]', { timeout: 8000 })
    const link = await A.$eval('.copyrow input[readonly]', (e) => (e as HTMLInputElement).value)
    check('host: room created with an invite link', /\?room=[A-Z0-9]{5}/.test(link), link)
    const code = (link.match(/room=([A-Z0-9]+)/) ?? [])[1]
    await A.screenshot({ path: `${SHOTS}/online-host-lobby.png` })

    // 2. friend opens the invite link -> asked for a nickname straight away
    await B.goto(link, { waitUntil: 'networkidle0' })
    check('invite link: join page asks for a nickname', /Join room/.test(await text(B)) && (await B.$('#nick')) !== null)
    const focused = await B.evaluate(() => document.activeElement?.id)
    check('invite link: nickname field is focused', focused === 'nick', String(focused))
    await B.screenshot({ path: `${SHOTS}/online-join-page.png` })
    await B.type('#nick', 'Bob')
    await B.keyboard.press('Enter')
    await B.waitForSelector('.seatlist', { timeout: 8000 })
    await sleep(500)
    const seatsA = await A.$$eval('.seatbox', (e) => e.map((x) => (x as HTMLElement).innerText))
    check('both players seated in the lobby', seatsA.filter((s) => /Human/.test(s)).length === 2, seatsA.join(' | '))
    for (const pg of [A, B]) await pg.evaluate(() => { (document.querySelector('.tablesettings') as HTMLDetailsElement).open = true })
    check('guest sees "waiting for the host"', /Waiting for the host/.test(await text(B)))
    check('guest cannot change settings (cards disabled)', await B.$$eval('button.rule', (e) => e.every((x) => (x as HTMLButtonElement).disabled)))
    await B.screenshot({ path: `${SHOTS}/online-guest-lobby.png` })
    await A.screenshot({ path: `${SHOTS}/online-host-lobby2.png` })

    // 3. host changes settings + a seat to bot, starts
    await clickText(A, 'button.rule', /Hong Kong/)
    await sleep(300)
    check('guest sees the host switch to Hong Kong', await B.$eval('button.rule.on', (e) => /Hong Kong/.test((e as HTMLElement).innerText)))
    await clickText(A, 'button.rule', /Taiwanese/)
    await sleep(200)
    await clickText(A, '.seatbox button', /Make bot/)
    await sleep(200)
    check('host can reserve a seat for a bot', /Bot \(reserved\)/.test(await text(A)))
    await clickText(A, '.btn.gold', /Start game/i)
    await A.waitForSelector('.board .handrow .tile', { timeout: 8000 })
    await B.waitForSelector('.board .handrow .tile', { timeout: 8000 })
    check('game started for both', true)
    await sleep(800)
    await A.screenshot({ path: `${SHOTS}/online-host-game.png` })
    await B.screenshot({ path: `${SHOTS}/online-guest-game.png` })

    // 4. chat
    await tapSel(B, true, '.chatopen')
    await sleep(150)
    check('chat picker opens', (await B.$('.chatpop')) !== null)
    await B.screenshot({ path: `${SHOTS}/online-chat-open.png` })
    await tapSel(B, true, '.chatbtn', 0)
    await sleep(700)
    check('host sees the chat bubble from the guest', (await A.$('.bubble')) !== null)
    await A.screenshot({ path: `${SHOTS}/online-chat-bubble.png` })

    // 5. play both sides with real input for a while
    for (let i = 0; i < 70; i++) {
      await playTurn(A, false)
      await playTurn(B, true)
      await sleep(350)
    }
    await sleep(1500)
    const ca = await pondCounts(A)
    const cb = await pondCounts(B)
    // A is seat 0 (rel: p0 = me, p1 = seat1). B is seat 1 (p0 = me, p3 = seat0).
    check(`both screens agree on seat 0's pond (${ca[0]} vs ${cb[3]})`, ca[0] === cb[3])
    check(`both screens agree on seat 1's pond (${ca[1]} vs ${cb[0]})`, ca[1] === cb[0])
    check('discards happened', ca[0] + ca[1] > 4)

    // 6. guest refreshes the page -> rejoins the same seat automatically
    const before = (await text(B)).includes('Bob')
    await B.reload({ waitUntil: 'networkidle0' })
    await B.waitForSelector('.board .handrow .tile', { timeout: 10000 }).catch(() => undefined)
    check('guest page refresh rejoins the running game', (await B.$('.board .handrow .tile')) !== null)
    check('guest keeps their seat/name after refresh', before && /Bob/.test(await text(B)))
    await B.screenshot({ path: `${SHOTS}/online-after-refresh.png` })

    // 7. guest leaves; host's table marks the seat away (bot takes over)
    await B.evaluate(() => { (document.querySelector('.dock summary') as HTMLElement)?.click(); (document.querySelector('.dock .leavebtn') as HTMLElement)?.click() })
    await sleep(1200)
    check('host sees guest as away', /away/i.test(await text(A)))
    await A.screenshot({ path: `${SHOTS}/online-guest-left.png` })
    console.log('room code was', code)
  } finally {
    await browser.close()
  }
  console.log(fails ? `\n${fails} FAILED` : '\nall online UI checks passed')
  process.exit(fails ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
