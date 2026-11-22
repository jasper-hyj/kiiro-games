import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

/** Screenshots of every screen into a directory (argv[2]); run before and after a CSS cleanup and compare the two folders. */
const OUT = process.argv[2] ?? '/tmp/snap'
const BASE = process.env.BASE ?? 'http://localhost:5199'
mkdirSync(OUT, { recursive: true })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const click = (p: any, sel: string) => p.evaluate((s: string) => (document.querySelector(s) as HTMLElement | null)?.click(), sel)
let n = 0
for (const [w, h, touch, tag] of [[1280, 720, false, 'desk'], [844, 390, true, 'phone'], [768, 1024, true, 'tabp'], [1024, 768, true, 'tabl']] as const) {
  for (const lang of ['en', 'zh']) {
    const open = async (url: string) => {
      const p = await b.newPage()
      await p.setViewport({ width: w, height: h, hasTouch: touch, isMobile: touch })
      await p.evaluateOnNewDocument((l) => { try { localStorage.setItem('kiiro-lang', l) } catch { /* ignore */ } }, lang)
      await p.goto(BASE + url, { waitUntil: 'networkidle0' })
      await sleep(500)
      return p
    }
    const shot = async (p: any, name: string) => { await p.screenshot({ path: `${OUT}/${tag}-${lang}-${name}.png` }); n++ }
    let p = await open('/mahjong')
    await shot(p, 'home')
    await click(p, '.btn.gold.big'); await sleep(500); await shot(p, 'rules')
    await click(p, 'button.rule'); await sleep(500); await shot(p, 'options')
    await click(p, '.btn.big'); await sleep(500); await shot(p, 'name')
    await p.close()
    for (const [mode, rule, players] of [['full', 'riichi', 4], ['full', 'taiwan', 4], ['call', 'taiwan', 4], ['full', 'riichi', 3], ['swap', 'sichuan', 4], ['void', 'sichuan', 4]] as const) {
      p = await open(`/?stress=${mode}&players=${players}&rule=${rule}`)
      await shot(p, `game-${mode}-${rule}-${players}`)
      if (mode === 'full' && rule === 'riichi' && players === 4) {
        await click(p, '.dock summary'); await sleep(300); await shot(p, 'dock')
        await click(p, '.dock summary'); await sleep(100)
        await click(p, '.rulechip'); await sleep(500); await shot(p, 'rules-ref')
        await p.evaluate(() => (document.querySelectorAll('.tabs button')[3] as HTMLElement | undefined)?.click()); await sleep(300); await shot(p, 'rules-ref-riichi')
      }
      await p.close()
    }
  }
}
await b.close()
console.log(n, 'screenshots in', OUT)
