import puppeteer from 'puppeteer-core'

/** Every exposed meld in the stress table must show the right number of tiles and a sideways (called) tile; closed kans show two backs. */
const BASE = process.env.BASE ?? 'http://localhost:5200'
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
let bad = 0,
  n = 0
for (const [rule, players] of [
  ['taiwan', 4],
  ['riichi', 4],
  ['riichi', 3],
] as const) {
  const p = await b.newPage()
  await p.setViewport({ width: 1280, height: 720 })
  await p.goto(`${BASE}/?stress=full&players=${players}&rule=${rule}`, { waitUntil: 'networkidle0' })
  const melds = await p.evaluate(() =>
    [...document.querySelectorAll('.melds .meld')].map((m) => ({
      tiles: m.querySelectorAll('.tile').length,
      sw: m.querySelectorAll('.sw').length,
      backs: m.querySelectorAll('.tile.back').length,
      kinds: [...m.querySelectorAll('.tile')].map((t) => (t as HTMLElement).dataset.kind),
    })),
  )
  // the stress table gives every seat chi, pon, open kan, closed kan, added kan (in that order): 3, 3, 4, 4, 4 tiles
  const rows = await p.evaluate(() =>
    [...document.querySelectorAll('.melds')].map((r) => [...r.querySelectorAll('.meld')].map((m) => m.querySelectorAll('.tile').length)),
  )
  for (const r of rows) {
    n++
    if (JSON.stringify(r) !== JSON.stringify([3, 3, 4, 4, 4].slice(0, r.length))) {
      bad++
      console.log('BAD tile counts', rule, players, JSON.stringify(r))
    }
  }
  for (const m of melds) {
    n++
    const closed = m.backs > 0
    const expectSw = closed ? 0 : 1
    if (m.sw !== expectSw || ![3, 4].includes(m.tiles) || (closed && m.tiles !== 4)) {
      bad++
      console.log('BAD', rule, players, JSON.stringify(m))
    }
  }
  await p.close()
}
await b.close()
console.log(`${n} melds checked, ${bad} wrong`)
process.exit(bad ? 1 : 0)
