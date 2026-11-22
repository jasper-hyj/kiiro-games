import { Game } from '../../src/games/mahjong/engine/game'
import { sortIds } from '../../src/games/mahjong/engine/tiles'
import type { RuleId } from '../../src/games/mahjong/engine/rules'

/** Audit: score every special hand in every ruleset and print what the engine says (reviewed by hand against the rules). */
const parse = (s: string): number[] => {
  const ks: number[] = []; let digits: number[] = []
  for (const ch of s) {
    if (/\d/.test(ch)) digits.push(+ch)
    else { const base = { m: 0, p: 9, s: 18, z: 27 }[ch as 'm']; for (const d of digits) ks.push(base + d - 1); digits = [] }
  }
  return ks
}
const used = new Map<number, number>()
const ids = (ks: number[]) => ks.map((k) => { const n = used.get(k) ?? 0; used.set(k, n + 1); return k * 4 + n })

interface Opt { tsumo?: boolean; seat?: number; riichi?: boolean; melds?: { type: 'chi' | 'pon' | 'minkan' | 'ankan'; tiles: string }[]; flowers?: number[]; first?: boolean; voidSuit?: number }
function score(rule: RuleId, hand: string, win: string, o: Opt = {}) {
  used.clear()
  const g = new Game(rule, { rule, aka: false, rounds: 1, minFan: rule === 'mcr' ? 8 : rule === 'hk' ? 3 : 0, swap: false, fixedDealer: true } as never, ['a', 'b', 'c', 'd'])
  g.dealer = 0; g.roundIndex = 0
  const seat = o.seat ?? 1
  const p = g.players[seat]
  p.flowers = o.flowers ?? []
  p.discards = o.first ? [] : [{ tile: 0, riichi: false, called: false }]
  p.melds = (o.melds ?? []).map((m) => ({ type: m.type, tiles: ids(parse(m.tiles)), from: 0 }))
  p.hand = sortIds(ids(parse(hand)))
  p.riichi = !!o.riichi
  p.voidSuit = o.voidSuit ?? 2
  const wid = ids(parse(win))[0]
  const tsumo = o.tsumo ?? false
  if (tsumo) { p.hand.push(wid); p.drawn = wid }
  const sc = g.checkWin(seat, tsumo, tsumo ? undefined : wid)
  return sc
}
const show = (rule: RuleId, name: string, hand: string, win: string, o: Opt = {}) => {
  const sc = score(rule, hand, win, o)
  console.log(`${rule.padEnd(7)} ${name.padEnd(34)} ${sc ? `${sc.label ? sc.label + ' · ' : ''}${sc.total}${sc.fu ? '/' + sc.fu + 'fu' : ''}  [${sc.yaku.map((y) => y.name).join(', ')}]` : 'NO WIN'}`)
}

console.log('--- RIICHI (13 tiles + win) ---')
show('riichi', 'kokushi (ron)', '19m19p19s1234567z', '1m')
show('riichi', 'kokushi 13-wait (ron)', '19m19p19s1234567z', '7z')
show('riichi', 'kokushi 13-wait (tsumo)', '19m19p19s1234567z', '9p', { tsumo: true })
show('riichi', 'kokushi single wait', '19m19p19s123456z7z', '7z')
show('riichi', 'chiitoitsu', '1133m5577p2244s6z', '6z', { riichi: true })
show('riichi', 'chiitoitsu tsumo', '1133m5577p2244s6z', '6z', { tsumo: true, riichi: true })
show('riichi', 'chiitoitsu with 4 same (invalid)', '1111m3355p2244s6z', '6z', { riichi: true })
show('riichi', 'chuuren (ron)', '1112345678999m', '5m')
show('riichi', 'junsei chuuren (9-wait)', '1112345678999m', '9m')
show('riichi', 'suuankou (tsumo)', '111m222p333s44z55z', '5z', { tsumo: true })
show('riichi', 'suuankou tanki ron', '111m222p333s444z5z', '5z')
show('riichi', 'suuankou ron shanpon (not)', '111m222p333s44z55z', '5z')
show('riichi', 'daisangen', '555666z77z123m99p', '7z', { riichi: true })
show('riichi', 'shousangen', '55566z77z123m99p', '6z')
show('riichi', 'tsuuiisou', '1112223334445z', '5z', { tsumo: true })
show('riichi', 'chinroutou', '111999m111999p1s', '1s')
show('riichi', 'ryuuiisou (all green)', '22334466s888s66z', '6z')
show('riichi', 'ryuuiisou with hatsu', '234234s66688s666z'.replace('666z', '66z'), '6z')
show('riichi', 'shousuushii', '112233z44z123m9p'.replace('112233z44z123m9p', '111222333z44z12m'), '3m')
show('riichi', 'daisuushii', '111222333444z1m', '1m')
show('riichi', 'suukantsu', '5m', '5m', { melds: [{ type: 'minkan', tiles: '1111m' }, { type: 'minkan', tiles: '2222p' }, { type: 'minkan', tiles: '3333s' }, { type: 'ankan', tiles: '7777z' }] })
show('riichi', 'tenhou (dealer tsumo)', '123m456p789s11z23m', '4m', { tsumo: true, seat: 0, first: true })
show('riichi', 'chiihou (non-dealer first draw)', '123m456p789s11z23m', '4m', { tsumo: true, first: true })
show('riichi', 'ryanpeikou over chiitoi', '223344m556677p8s', '8s')
show('riichi', 'iipeikou + pinfu', '112233m456p789s5p', '4p', { riichi: true, tsumo: true })
show('riichi', 'honitsu', '123456m11777z22m', '2m')
show('riichi', 'chinitsu (not chuuren)', '123456789m1155m', '5m', { riichi: true })
show('riichi', 'toitoi + sanankou', '111m222p333s44z55z', '5z')
show('riichi', 'sanshoku doujun', '123m123p123s11z23m', '1m')
show('riichi', 'ittsu', '123456789m11z23p', '1p')
show('riichi', 'nine gates not in sanma w/ melds (no yaku)', '234m456p789s11z5m', '6m', { melds: [{ type: 'chi', tiles: '123m' }] })
show('riichi', 'open hand no yaku', '234m456p789s11z5m', '6m', { melds: [{ type: 'chi', tiles: '123m' }] })
show('riichi', 'yakuhai pon open', '234m456p5m11p', '6m', { melds: [{ type: 'pon', tiles: '555z' }, { type: 'chi', tiles: '123p' }] })

console.log('\n--- HONG KONG ---')
show('hk', 'thirteen orphans', '19m19p19s1234567z', '1m')
show('hk', 'seven pairs (not scored)', '1133m5577p2244s6z', '6z')
show('hk', 'all triplets + dragon', '555z222m333p44s66z', '6z'.replace('6z', '6z'))
show('hk', 'pure one suit', '1112345678999m', '5m')
show('hk', 'all honors', '1112223334445z', '5z')
show('hk', 'big three dragons', '555666z77z123m99p', '7z')
show('hk', 'small three dragons', '55666z77z123m99p', '5z')
show('hk', 'four concealed triplets', '111m222p333s44z55z', '5z', { tsumo: true })
show('hk', 'big four winds', '111222333z44z12m', '3m'.replace('3m', '3m'))
show('hk', 'common hand (pinghu) tsumo', '234m456p789s23m55p', '4m', { tsumo: true })
show('hk', 'below minimum (2 fan)', '234m456p789s23m55p', '4m')
show('hk', 'seat flower + no flower', '234m456p789s23m55p', '4m', { tsumo: true, flowers: [34] })

console.log('\n--- TAIWAN (16 tiles + win) ---')
show('taiwan', 'five concealed triplets', '111m222p333s444z555z6z', '6z', { tsumo: true })
show('taiwan', 'big three dragons', '555666z777z123m234p9s', '9s')
show('taiwan', 'all triplets', '111m222p333s4z', '4z', { melds: [{ type: 'pon', tiles: '999m' }, { type: 'pon', tiles: '555z' }] })
show('taiwan', 'pure one suit', '111m123m234m567m789m9m', '9m')
show('taiwan', 'all honors', '111222333z444z555z6z', '6z')
show('taiwan', 'pinghu (2 tai)', '234m456m234p234s23m55p', '4m')
show('taiwan', 'eight flowers', '', '', {})

console.log('\n--- MCR ---')
show('mcr', 'thirteen orphans', '19m19p19s1234567z', '1m')
show('mcr', 'seven pairs', '1133m5577p2244s6z', '6z')
show('mcr', 'seven shifted pairs', '1122334455667m', '7m')
show('mcr', 'nine gates', '1112345678999m', '5m')
show('mcr', 'all green', '223344s666s888s6z', '6z')
show('mcr', 'little four winds', '111222333z44z12m', '3m')
show('mcr', 'full flush chows', '234567m345678m1m', '1m')
show('mcr', 'four kongs', '5m', '5m', { melds: [{ type: 'minkan', tiles: '1111m' }, { type: 'minkan', tiles: '2222p' }, { type: 'minkan', tiles: '3333s' }, { type: 'ankan', tiles: '7777z' }] })

console.log('\n--- SICHUAN (void = sou) ---')
show('sichuan', 'plain', '123m456m789m12p33p', '3p')
show('sichuan', 'seven pairs', '1122m3344m5566m7m', '7m')
show('sichuan', 'dragon seven pairs (4 same)', '1111m2233m4455m6m', '6m')
show('sichuan', 'all pungs', '222m555p9p', '9p', { melds: [{ type: 'pon', tiles: '888m' }, { type: 'pon', tiles: '444p' }] })
show('sichuan', 'golden hook', '5p', '5p', { melds: [{ type: 'pon', tiles: '888m' }, { type: 'pon', tiles: '444p' }, { type: 'pon', tiles: '222m' }, { type: 'pon', tiles: '666p' }] })
show('sichuan', 'holds void suit', '123m456m789m12p3s', '3p')
