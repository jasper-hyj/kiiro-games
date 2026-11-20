import { Game } from '../src/engine/game'
import { sortIds } from '../src/engine/tiles'

/** Riichi scoring spot checks: ura dora only with riichi, dora / red fives, pinfu and chiitoitsu fu, closed vs open. */
const parse = (s: string): number[] => {
  const ks: number[] = []; let digits: number[] = []
  for (const ch of s) {
    if (/\d/.test(ch)) digits.push(+ch)
    else { const base = { m: 0, p: 9, s: 18, z: 27 }[ch as 'm']; for (const d of digits) ks.push(base + d - 1); digits = [] }
  }
  return ks
}
let fails = 0
const check = (name: string, ok: boolean, extra = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${extra}`) }

interface Opt { tsumo?: boolean; riichi?: boolean; dora?: string; ura?: string; melds?: { type: 'chi' | 'pon'; tiles: string }[] }
function score(hand: string, win: string, o: Opt = {}) {
  const used = new Map<number, number>()
  const ids = (ks: number[]) => ks.map((k) => { const n = used.get(k) ?? 0; used.set(k, n + 1); return k * 4 + n })
  const g = new Game('riichi', { rule: 'riichi', aka: false, rounds: 1, minFan: 0, swap: false, fixedDealer: true } as never, ['a', 'b', 'c', 'd'])
  g.dealer = 0; g.roundIndex = 0
  const p = g.players[1]
  p.discards = [{ tile: 0, riichi: false, called: false }]
  p.melds = (o.melds ?? []).map((m) => ({ type: m.type, tiles: ids(parse(m.tiles)), from: 0 }))
  p.hand = sortIds(ids(parse(hand)))
  p.riichi = !!o.riichi
  const wid = ids(parse(win))[0]
  const tsumo = o.tsumo ?? false
  // dora / ura indicator tiles (the dora is the kind after the indicator): kinds given as a string like "4m"
  g.doraPool = ids(parse(o.dora ?? '2z')); g.uraPool = ids(parse(o.ura ?? '2z')); g.doraCount = 1
  if (tsumo) { p.hand.push(wid); p.drawn = wid }
  return g.checkWin(1, tsumo, tsumo ? undefined : wid)
}
const names = (sc: ReturnType<typeof score>) => (sc ? sc.yaku.map((y) => y.name).join(', ') : 'no win')

// closed tanyao hand 234m 345p 678s 456s + pair 55m, waiting on 4m/1m? (23m + 55m ...): use 23m wait for 1m or 4m: hand 23m 345p 678s 456s 55m, win 4m
const base = '23m345p678s456s55m'
{ // ura indicator 4m => ura dora is 5m (two in the hand): must NOT count without riichi
  const noRiichi = score(base, '4m', { ura: '4m' })
  const riichi = score(base, '4m', { ura: '4m', riichi: true })
  check('no riichi: ura dora is not counted', !!noRiichi && !noRiichi.yaku.some((y) => /ura/i.test(y.name)) && noRiichi.total === 2, // tanyao + pinfu only
     `(${names(noRiichi)} = ${noRiichi?.total} han)`)
  check('riichi: ura dora is counted (the pair of 5m = 2 ura)', !!riichi && riichi.yaku.some((y) => /ura/i.test(y.name)) && riichi.total === 1 + 1 + 1 + 2, `(${names(riichi)} = ${riichi?.total} han)`)
}
{ // dora counts without riichi
  const sc = score(base, '4m', { dora: '4m' })
  check('dora counts without riichi', !!sc && sc.yaku.some((y) => /^dora/i.test(y.name)) && sc.total === 4, `(${names(sc)} = ${sc?.total} han)`) // tanyao + pinfu + 2 dora
}
{ // pinfu: closed ron 30 fu / 1 han ; tsumo 20 fu / 2 han (pinfu + menzen tsumo)
  const hand = '23m456p789p345s22p'
  const ron = score(hand, '1m')
  const tsumo = score(hand, '1m', { tsumo: true })
  check('closed pinfu ron = 1 han 30 fu', !!ron && ron.total === 1 && ron.fu === 30, `(${names(ron)} = ${ron?.total} han ${ron?.fu} fu)`)
  check('pinfu tsumo = 2 han 20 fu', !!tsumo && tsumo.total === 2 && tsumo.fu === 20, `(${names(tsumo)} = ${tsumo?.total} han ${tsumo?.fu} fu)`)
}
{ // chiitoitsu is always 25 fu, 2 han
  const sc = score('11m33m55p77p99s22z4z', '4z', {})
  check('chiitoitsu = 2 han 25 fu', !!sc && sc.total === 2 && sc.fu === 25, `(${names(sc)} = ${sc?.total} han ${sc?.fu} fu)`)
}
{ // open hand without a yaku cannot win
  const sc = score('23m345p678s55m', '4m', { melds: [{ type: 'chi', tiles: '456s' }] })
  check('open tanyao hand wins (tanyao is allowed open)', !!sc && sc.yaku.some((y) => /tanyao/i.test(y.name)), `(${names(sc)})`)
  const none = score('23m345p678s55z', '4m', { melds: [{ type: 'chi', tiles: '456s' }] })
  check('open hand with no yaku cannot win', none === null)
}
console.log(fails ? `${fails} FAILED` : 'riichi scoring checks passed')
process.exit(fails ? 1 : 0)
