import puppeteer from 'puppeteer-core'
import { readdirSync, readFileSync } from 'node:fs'

/** Compares two folders of PNG screenshots with a per-pixel tolerance: prints each file whose differing-pixel share is above the threshold. */
const [A, B, thr = '0.05'] = process.argv.slice(2)
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setContent('<canvas id=c></canvas>')
await p.evaluate('window.__name = (f) => f') // tsx wraps functions in a __name helper the page does not have
let worst = 0,
  bad = 0,
  total = 0
for (const f of readdirSync(A)
  .filter((x) => x.endsWith('.png'))
  .sort()) {
  const a64 = readFileSync(`${A}/${f}`).toString('base64')
  let b64: string
  try {
    b64 = readFileSync(`${B}/${f}`).toString('base64')
  } catch {
    console.log('MISSING', f)
    bad++
    continue
  }
  const pct: number = await p.evaluate(
    async (x, y) => {
      const load = (s: string) =>
        new Promise<HTMLImageElement>((ok) => {
          const i = new Image()
          i.onload = () => ok(i)
          i.src = 'data:image/png;base64,' + s
        })
      const [ia, ib] = await Promise.all([load(x), load(y)])
      const px = (i: HTMLImageElement) => {
        const c = document.createElement('canvas')
        c.width = i.width
        c.height = i.height
        const g = c.getContext('2d')!
        g.drawImage(i, 0, 0)
        return g.getImageData(0, 0, i.width, i.height).data
      }
      if (ia.width !== ib.width || ia.height !== ib.height) return 100
      const da = px(ia),
        db = px(ib)
      let diff = 0
      for (let k = 0; k < da.length; k += 4) if (Math.abs(da[k] - db[k]) + Math.abs(da[k + 1] - db[k + 1]) + Math.abs(da[k + 2] - db[k + 2]) > 48) diff++
      return (diff / (da.length / 4)) * 100
    },
    a64,
    b64,
  )
  total++
  worst = Math.max(worst, pct)
  if (pct > Number(thr)) {
    bad++
    console.log(`${pct.toFixed(3)}%  ${f}`)
  }
}
await b.close()
console.log(`${total} compared, ${bad} above ${thr}%, worst ${worst.toFixed(3)}%`)
process.exit(bad ? 1 : 0)
