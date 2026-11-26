import puppeteer from 'puppeteer-core'

/** Turning hints on or off must not move anything: the same elements sit at the same place with and without them. */
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const SEL = ['.handrow', '.cgrid', '.infoleft .chip', '.handbar .statusbar', '.seat.left .chip', '.seat.right .chip']
for (const [w, h, touch, label] of [
  [1440, 900, false, 'desktop'],
  [844, 390, true, 'phone landscape'],
  [390, 844, true, 'phone portrait'],
  [1024, 768, true, 'tablet'],
] as const) {
  const rects: Record<string, string>[] = []
  for (const hints of [false, true]) {
    const p = await b.newPage()
    await p.setViewport({ width: w, height: h, hasTouch: touch, isMobile: touch })
    await p.evaluateOnNewDocument((hh: boolean) => {
      localStorage.setItem('kiiro-lang', 'en')
      localStorage.setItem('kiiro-hints', JSON.stringify(hh))
      ;(window as any).__name = (f: unknown) => f
    }, hints)
    await p.goto('http://localhost:5199/?stress=min&hint=1&opp=1&players=4&rule=riichi', { waitUntil: 'networkidle0' })
    await sleep(900)
    const shown = await p.evaluate(() => !!document.querySelector('.handbar .hint'))
    rects.push(
      await p.evaluate(
        (sels: string[]) =>
          Object.fromEntries(
            sels.map((s) => {
              const e = document.querySelector(s)
              if (!e) return [s, 'missing']
              const r = e.getBoundingClientRect()
              return [s, `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`]
            }),
          ),
        SEL,
      ),
    )
    if (hints) console.log(`${label}: hint panel shown with hints on: ${shown}`)
    await p.close()
  }
  for (const s of SEL) {
    const ok = rects[0][s] === rects[1][s]
    if (!ok) fails++
    console.log(ok ? 'ok  ' : 'FAIL', `${label} ${s}: off ${rects[0][s]} | on ${rects[1][s]}`)
  }
}
await b.close()
process.exit(fails ? 1 : 0)
