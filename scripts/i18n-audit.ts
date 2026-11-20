import puppeteer from 'puppeteer-core'

/** Lists visible English text on every screen in Chinese and Japanese: anything printed here is not translated yet. */
const BASE = process.env.BASE ?? 'http://localhost:5199'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const ALLOWED = /^(Bot \d|Kiiro Mahjong|E|S|W|N|OK|ON|OFF|AI|HK|MCR|\d+)$/
const click = (p: any, sel: string) => p.evaluate((s: string) => (document.querySelector(s) as HTMLElement | null)?.click(), sel)
const english = (p: any): Promise<string[]> => p.evaluate(() => {
  const out = new Set<string>()
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n: Node | null
  while ((n = w.nextNode())) {
    const el = n.parentElement
    const t = (n.textContent ?? '').trim()
    if (!el || !t) continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2 || getComputedStyle(el).visibility === 'hidden') continue
    if (/[A-Za-z]{3,}/.test(t)) out.add(t.slice(0, 90))
  }
  for (const el of document.querySelectorAll('[title],[aria-label],[placeholder]')) {
    for (const a of ['title', 'aria-label', 'placeholder']) { const v = el.getAttribute(a); if (v && /[A-Za-z]{3,}/.test(v)) out.add(`[${a}] ${v.slice(0, 80)}`) }
  }
  return [...out]
})
const seenAll = new Map<string, Set<string>>()
const record = (lang: string, where: string, list: string[]) => {
  for (const s of list) {
    if (ALLOWED.test(s)) continue
    const key = `${lang} ${s}`
    if (!seenAll.has(key)) seenAll.set(key, new Set())
    seenAll.get(key)!.add(where)
  }
}
for (const lang of ['zh', 'ja']) {
  const open = async (url: string, w = 1280, h = 720) => {
    const p = await b.newPage()
    await p.setViewport({ width: w, height: h })
    await p.evaluateOnNewDocument((l) => { localStorage.setItem('kiiro-lang', l) }, lang)
    await p.goto(BASE + url, { waitUntil: 'networkidle0' })
    await sleep(400)
    return p
  }
  let p = await open('/')
  record(lang, 'home', await english(p))
  await click(p, '.btn.gold.big'); await sleep(500)
  record(lang, 'rules step', await english(p))
  await click(p, 'button.rule'); await sleep(500)
  record(lang, 'options step', await english(p))
  await click(p, '.btn.big'); await sleep(500)
  record(lang, 'name step', await english(p))
  await p.close()
  p = await open('/?stress=full&players=4&rule=riichi')
  record(lang, 'game riichi', await english(p))
  await click(p, '.dock summary'); await sleep(300)
  record(lang, 'game menu', await english(p))
  await click(p, '.rulechip'); await sleep(400)
  for (const tab of [0, 1, 2, 3, 4, 5]) {
    await p.evaluate((i) => (document.querySelectorAll('.tabs button')[i] as HTMLElement | undefined)?.click(), tab)
    await sleep(250)
    record(lang, `rules tab ${tab}`, await english(p))
  }
  await p.close()
  for (const rule of ['taiwan', 'hk', 'mcr', 'sichuan']) {
    p = await open(`/?stress=${rule === 'sichuan' ? 'swap' : 'call'}&players=4&rule=${rule}`)
    record(lang, `game ${rule}`, await english(p))
    await p.close()
  }
  p = await open('/?solo=1&rule=taiwan&speed=0.02')
  for (let i = 0; i < 700 && !(await p.$('.overlay .modal')); i++) {
    if (await p.$('.cbtn.ron')) await click(p, '.cbtn.ron'); else if (await p.$('.cbtn.pass')) await click(p, '.cbtn.pass')
    else { const t = await p.$$('.handrow .tile.clickable'); if (t.length) { await t[t.length - 1].click().catch(() => {}); await sleep(30); await click(p, '.handrow .tile.sel') } }
    await sleep(40)
    if (i === 40) { await click(p, '.dock summary'); await sleep(200); record(lang, 'dock open mid game', await english(p)); await click(p, '.dock summary') }
  }
  record(lang, 'result', await english(p))
  await p.evaluate(() => { const bs = [...document.querySelectorAll('.modal button')] as HTMLElement[]; bs.find((x) => /replay|レプレイ|リプレイ|回放|重播/i.test(x.textContent ?? ''))?.click() })
  await sleep(400)
  record(lang, 'result after click', await english(p))
  await p.close()
}
await b.close()
const rows = [...seenAll.entries()].sort()
for (const [k, where] of rows) console.log(`${k}   <- ${[...where].slice(0, 3).join(', ')}`)
console.log(`\n${rows.length} untranslated strings`)
