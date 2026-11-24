// Run: npx tsx scripts/cards/i18n-audit.ts   Every text key used by the hub, accounts and card games must exist in English/Chinese and in Japanese.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { allStrings } from '../../src/i18n'
import '../../src/games/mahjong/strings'
import '../../src/games/mahjong/strings.ja'
import '../../src/hub/strings'
import '../../src/account/strings'
import '../../src/games/holdem/strings'
import '../../src/games/blackjack/strings'
import '../../src/games/bigtwo/strings'
import '../../src/room/strings'
import '../../src/games/generic/strings'
import '../../src/games/generic/gomokuStrings'

const { D, JA } = allStrings()
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [] })
const files = ['src/hub', 'src/account', 'src/games/holdem', 'src/games/blackjack', 'src/games/bigtwo', 'src/games/shared', 'src/games/generic', 'src/room'].flatMap(walk)
let missingZh = 0, missingJa = 0, used = new Set<string>()
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)) if (!m[1].endsWith('.')) used.add(m[1])
  for (const m of src.matchAll(/(?:title|lines)=(?:\{?\[?)((?:'[^']+',?\s*)+)/g)) for (const k of m[1].matchAll(/'([^']+)'/g)) used.add(k[1])
  for (const m of src.matchAll(/title="([A-Za-z0-9_.]+)"/g)) used.add(m[1])
}
// keys built from a prefix
for (let i = 0; i <= 8; i++) used.add('hand.' + i)
for (const k of ['single', 'pair', 'triple', 'straight', 'flush', 'fullhouse', 'quads', 'straightflush']) used.add('btt.' + k)
for (const k of ['blackjack', 'win', 'push', 'lose', 'bust']) used.add('bjo.' + k)
for (const k of ['hdLastFold', 'hdLastCheck', 'hdLastCall', 'hdLastRaise', 'hdLastBet', 'hdLastAllin', 'hdLastSb', 'hdLastBb']) used.add(k)
// server error codes shown to players
for (const k of ['signin_required', 'not_enough_chips', 'bad_buyin', 'table_full', 'not_your_turn', 'cannot_check', 'cannot_raise', 'bad_amount', 'cannot_hit', 'cannot_double', 'cannot_split', 'not_betting', 'bad_combo', 'too_low', 'must_open', 'must_lead', 'bad_cards', 'already_seated', 'ranked_needs_signin', 'ranked_needs_players', 'room_not_found', 'code_taken', 'room_full']) used.add(k)
const zhOnlyIgnore = new Set<string>()
const missing: string[] = []
for (const k of [...used].sort()) {
  if (!D[k]) { missing.push(`no English/Chinese text for "${k}"`); missingZh++ }
  if (!JA[k] && !zhOnlyIgnore.has(k)) { 
    // Mahjong's own error strings live in the Mahjong files; they are registered too, so a miss here is real
    missing.push(`no Japanese text for "${k}"`); missingJa++
  }
}
// every English string has a Chinese one, and placeholders match between languages
let badPlaceholders = 0
for (const [k, [en, zh]] of Object.entries(D)) {
  const a = [...en.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(','), b = [...zh.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
  if (a !== b) { badPlaceholders++; console.log(`placeholder mismatch (en vs zh) in "${k}": {${a}} vs {${b}}`) }
  const j = JA[k]
  if (j) { const c = [...j.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(','); if (a !== c) { badPlaceholders++; console.log(`placeholder mismatch (en vs ja) in "${k}": {${a}} vs {${c}}`) } }
}
for (const m of missing) console.log(m)
console.log(`${used.size} keys used; ${missingZh} missing in English/Chinese, ${missingJa} missing in Japanese, ${badPlaceholders} placeholder mismatches`)
process.exit(missingZh + missingJa + badPlaceholders ? 1 : 0)
