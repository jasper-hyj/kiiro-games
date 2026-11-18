import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Meld } from '../src/engine/game'

// the UI modules touch the document when loaded; a stub is enough for server-side rendering
;(globalThis as any).document = { documentElement: { dataset: {}, style: { setProperty() {} }, setAttribute() {}, classList: { toggle() {}, add() {}, remove() {} } } }
;(globalThis as any).localStorage = { getItem: () => null, setItem() {} }
const { MeldView } = await import('../src/ui/Board')

/** Exhaustive: every meld type x every owner x every source seat x 3/4 players must draw its own tiles exactly once,
 *  with the sideways tile where the rules of the table put it (from the left: first, across: middle, from the right: last). */
let bad = 0, n = 0
const fail = (m: string) => { bad++; if (bad < 25) console.log('FAIL', m) }
const idsOf = (html: string) => [...html.matchAll(/data-kind="(\d+)"/g)].map((m) => +m[1])

for (const players of [3, 4]) for (const type of ['chi', 'pon', 'minkan', 'kakan', 'ankan'] as const) for (let owner = 0; owner < players; owner++) for (let from = 0; from < players; from++) {
  if (type === 'chi' && from !== (owner + players - 1) % players) continue // chi only from the left
  if (from === owner && type !== 'ankan') continue
  const size = type === 'chi' || type === 'pon' ? 3 : 4
  // distinct kinds make a phantom or a repeated tile visible
  const tiles = type === 'chi' ? [0, 4, 8] : Array.from({ length: size }, (_, i) => 27 * 4 + i)
  const called = tiles[type === 'chi' ? 1 : 0]
  const m: Meld = { type, tiles, from, called } as Meld
  const html = renderToStaticMarkup(createElement(MeldView, { m, owner, n: players }))
  n++
  const label = `${players}p ${type} owner ${owner} from ${from}`
  const kinds = idsOf(html)
  const want = tiles.map((t) => t >> 2).sort((a, b) => a - b)
  if (type === 'ankan') { if (kinds.length !== 4 && (html.match(/class="tile/g) ?? []).length !== 4) fail(`${label}: closed kan should show four tiles`); continue }
  if (JSON.stringify([...kinds].sort((a, b) => a - b)) !== JSON.stringify(want)) fail(`${label}: shows kinds ${kinds} but the meld is ${want}`)
  const sw = (html.match(/class="sw/g) ?? []).length
  if (sw !== 1) fail(`${label}: ${sw} sideways slots`)
  // where the sideways slot sits among the children of .meld
  const parts = html.replace(/^<div class="meld">/, '').split(/(?=<span class="sw|<div class="tile)/)
  const pos = parts.findIndex((x) => x.startsWith('<span class="sw'))
  const rel = (from - owner + players) % players
  const expect = type === 'chi' ? 0 : rel === players - 1 ? 0 : rel === 1 ? (type === 'minkan' ? 3 : 2) : 1
  if (pos !== expect) fail(`${label}: sideways tile at slot ${pos}, expected ${expect}`)
  if (type === 'kakan' && !html.includes('sw dbl')) fail(`${label}: added kan should stack two tiles sideways`)
  if (type === 'kakan' && (html.match(/data-kind/g) ?? []).length !== 4) fail(`${label}: added kan must show four tiles`)
}
console.log(`${n} meld views checked, ${bad} wrong`)
process.exit(bad ? 1 : 0)
