// Run: npx tsx scripts/site/fairness-test.ts   Statistical checks for the card games (shuffles, hand odds, blackjack house edge, seat fairness).
import { shuffled, secureInt } from '../../src/games/holdem/engine/cards'
import { best, categoryOf } from '../../src/games/holdem/engine/eval'
import { PokerTable } from '../../src/games/holdem/engine/table'
import { BlackjackTable, total, cardValue, type BjAct } from '../../src/games/blackjack/engine/table'
import { BigTwoTable } from '../../src/games/bigtwo/engine/table'
import { rankOf } from '../../src/games/holdem/engine/cards'

let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
/** chi-square critical value at p = 0.001 (Wilson-Hilferty approximation) */
const crit = (df: number) => {
  const z = 3.09,
    a = 2 / (9 * df)
  return df * Math.pow(1 - a + z * Math.sqrt(a), 3)
}
const chi = (obs: number[], exp: number[]) => obs.reduce((s, o, i) => s + (o - exp[i]) ** 2 / exp[i], 0)

// ---- 1. the random source and the shuffle ----
{
  for (const n of [2, 3, 6, 7, 13, 52]) {
    const N = 120000,
      c = new Array(n).fill(0)
    for (let i = 0; i < N; i++) c[secureInt(n)]++
    const x = chi(
      c,
      c.map(() => N / n),
    )
    ok(x < crit(n - 1), `secureInt(${n}) is uniform (chi2 ${x.toFixed(1)} < ${crit(n - 1).toFixed(1)})`)
  }
  // where does each card land? 52 x 52 table, plus the first card and adjacent pairs
  const N = 60000,
    pos = Array.from({ length: 52 }, () => new Array(52).fill(0))
  for (let i = 0; i < N; i++) {
    const d = shuffled()
    d.forEach((c, p) => pos[c][p]++)
  }
  let worst = 0
  for (let c = 0; c < 52; c++) {
    const x = chi(
      pos[c],
      pos[c].map(() => N / 52),
    )
    if (x > worst) worst = x
  }
  // 52 tests at p=0.001 each: allow the family-wise critical value at p = 0.001/52
  ok(worst < crit(51) * 1.25, `every card is equally likely in every position (worst chi2 ${worst.toFixed(1)}, limit ${(crit(51) * 1.25).toFixed(1)})`)
  const same = shuffled().every((c, i) => c === i)
  ok(!same, 'a shuffled deck is not left in order')
}

// ---- 2. seven-card hand frequencies (known exact values for the best five of seven) ----
{
  const expected = [0.1741, 0.438, 0.235, 0.0483, 0.0462, 0.0303, 0.026, 0.00168, 0.000311]
  const names = ['high card', 'pair', 'two pair', 'trips', 'straight', 'flush', 'full house', 'quads', 'straight flush']
  const N = 250000,
    cnt = new Array(9).fill(0)
  for (let i = 0; i < N; i++) {
    const d = shuffled()
    cnt[categoryOf(best(d.slice(0, 7)))]++
  }
  for (let k = 0; k < 8; k++) {
    const p = cnt[k] / N,
      se = Math.sqrt((expected[k] * (1 - expected[k])) / N)
    ok(Math.abs(p - expected[k]) < 5 * se, `${names[k]}: ${(p * 100).toFixed(2)}% (exact ${(expected[k] * 100).toFixed(2)}%)`)
  }
}

// ---- 3. preflop equity sanity: pocket aces against a random hand win about 85% ----
{
  let win = 0,
    tie = 0
  const N = 40000
  const AA = [12, 25],
    used = new Set(AA)
  const rest = Array.from({ length: 52 }, (_, i) => i).filter((c) => !used.has(c))
  for (let i = 0; i < N; i++) {
    const d = [...rest]
    for (let j = d.length - 1; j > 0; j--) {
      const k = secureInt(j + 1)
      ;[d[j], d[k]] = [d[k], d[j]]
    }
    const board = d.slice(0, 5),
      opp = d.slice(5, 7)
    const a = best([...AA, ...board]),
      b = best([...opp, ...board])
    if (a > b) win++
    else if (a === b) tie++
  }
  const eq = (win + tie / 2) / N
  ok(Math.abs(eq - 0.852) < 0.01, `pocket aces vs a random hand: ${(eq * 100).toFixed(1)}% (known 85.2%)`)
}

// ---- 4. blackjack: basic strategy must give the known house edge (about 0.4-0.6% for 6 decks, S17, DAS, 3:2, no surrender) ----
function basic(hand: number[], up: number, canDouble: boolean, canSplit: boolean): BjAct['a'] {
  const t = total(hand),
    u = cardValue(up)
  if (canSplit && cardValue(hand[0]) === cardValue(hand[1])) {
    const v = cardValue(hand[0])
    if (v === 11 || v === 8) return 'split'
    if (v === 9 && ![7, 10, 11].includes(u)) return 'split'
    if (v === 7 && u <= 7) return 'split'
    if (v === 6 && u <= 6) return 'split'
    if (v === 4 && (u === 5 || u === 6)) return 'split'
    if ((v === 3 || v === 2) && u <= 7) return 'split'
  }
  if (t.soft) {
    const s = t.sum
    if (s >= 19) return s === 19 && u === 6 && canDouble ? 'double' : 'stand'
    if (s === 18) return u <= 6 ? (canDouble ? 'double' : 'stand') : u <= 8 ? 'stand' : 'hit'
    if (s === 17) return u >= 3 && u <= 6 && canDouble ? 'double' : 'hit'
    if (s === 16 || s === 15) return u >= 4 && u <= 6 && canDouble ? 'double' : 'hit'
    return u >= 5 && u <= 6 && canDouble ? 'double' : 'hit'
  }
  const s = t.sum
  if (s >= 17) return 'stand'
  if (s >= 13) return u <= 6 ? 'stand' : 'hit'
  if (s === 12) return u >= 4 && u <= 6 ? 'stand' : 'hit'
  if (s === 11) return canDouble ? 'double' : 'hit'
  if (s === 10) return u <= 9 && canDouble ? 'double' : 'hit'
  if (s === 9) return u >= 3 && u <= 6 && canDouble ? 'double' : 'hit'
  return 'hit'
}
function playBlackjack(rounds: number, strategy: (hand: number[], up: number, d: boolean, s: boolean) => BjAct['a']) {
  const t = new BlackjackTable({ bet: 10, casual: true, maxSeats: 6 })
  t.turnTimerMs = 0
  t.betMs = 0
  t.resultMs = 0
  t.autostart = false
  t.sit('p', 'P', 10 * 200)
  t.autostart = true
  let wagered = 0,
    returned = 0
  t.onHand = (r) => {
    returned += r.net[0]
    wagered += (r.summary as any).hands[0].reduce((a: number, h: any) => a + h.bet, 0)
  }
  t.drive()
  for (let guard = 0; guard < rounds * 12 && t.round < rounds; guard++) {
    if (t.phase === 'bet') {
      t.seats[0].stack = 2000
      t.act('p', { a: 'bet', amount: 10 })
      continue
    }
    if (t.phase === 'play' && t.toAct) {
      const s = t.seats[0],
        h = s.hands[t.toAct.hand],
        o = t.options(0, t.toAct.hand)
      const want = strategy(h.cards, t.dealer[0], o.double, o.split)
      const a: BjAct =
        want === 'split' && o.split ? { a: 'split' } : want === 'double' && o.double ? { a: 'double' } : want === 'hit' && o.hit ? { a: 'hit' } : { a: 'stand' }
      t.act('p', a)
      continue
    }
    if (t.phase === 'wait') t.drive()
  }
  return { rounds: t.round, edge: returned / 10 / t.round } // average net per round in units of the initial bet
}
{
  const N = 400000
  const r = playBlackjack(N, basic)
  // per-round sd is about 1.15 bets; with 400k rounds the standard error is ~0.18%
  ok(r.edge > -0.015 && r.edge < 0.007, `basic strategy return per round: ${(r.edge * 100).toFixed(2)}% of the initial bet (expected about -0.5%)`)
  const dealerMimic = playBlackjack(150000, (hand) => (total(hand).sum < 17 ? 'hit' : 'stand'))
  ok(dealerMimic.edge < -0.03 && dealerMimic.edge > -0.08, `copying the dealer loses about 5%: ${(dealerMimic.edge * 100).toFixed(2)}%`)
  const never = playBlackjack(100000, () => 'stand')
  ok(never.edge < -0.1, `never hitting loses heavily: ${(never.edge * 100).toFixed(1)}%`)
}

// ---- 5. hold'em seats: when everyone checks it down, each seat wins about the same share ----
{
  const t = new PokerTable({ sb: 5, bb: 10, casual: true, maxSeats: 6 })
  t.turnTimerMs = 0
  t.resultMs = 0
  const wins = new Array(6).fill(0)
  let hands = 0
  t.onHand = (rec) => {
    rec.net.forEach((n, i) => {
      if (n > 0) wins[i] += 1
    })
    hands++
  }
  t.autostart = false
  for (let i = 0; i < 6; i++) t.sit('p' + i, 'P' + i, 1000)
  t.autostart = true
  t.drive()
  for (let g = 0; g < 1200000 && hands < 24000; g++) {
    if (t.toAct < 0) {
      t.drive()
      if (t.street === 'wait') continue
      break
    }
    const i = t.toAct,
      info = t.turnInfo(i)
    t.act('p' + i, info.canCheck ? { a: 'check' } : { a: 'call' })
    for (const s of t.seats) if (s.id && s.stack < 100) s.stack += 900 // keep everyone seated (chips are irrelevant to the check)
  }
  const exp = wins.reduce((a, b) => a + b, 0) / 6
  const x = chi(
    wins,
    wins.map(() => exp),
  )
  ok(hands >= 20000 && x < crit(5), `hold'em: ${hands} hands checked down, seat wins ${wins.join('/')} are even (chi2 ${x.toFixed(1)} < ${crit(5).toFixed(1)})`)
}

// ---- 6. big two: the deal is fair and the starting seat is uniform ----
{
  const N = 30000,
    starters = new Array(4).fill(0),
    twos = new Array(4).fill(0)
  for (let g = 0; g < N; g++) {
    const t = new BigTwoTable()
    t.turnTimerMs = 0
    t.botDelayMs = 3600000
    t.join('a', 'A')
    t.start('a')
    starters[t.turn]++
    t.seats.forEach((s, i) => {
      twos[i] += s.hand.filter((c) => rankOf(c) === 0).length
    })
    ;(t as any).clearTimer?.()
    t.dispose()
  }
  const xs = chi(
      starters,
      starters.map(() => N / 4),
    ),
    xt = chi(
      twos,
      twos.map(() => N),
    )
  ok(xs < crit(3), `big two: the 3 of diamonds is dealt evenly to the four seats (chi2 ${xs.toFixed(1)})`)
  ok(xt < crit(3), `big two: every seat gets the same number of 2s over time (chi2 ${xt.toFixed(1)})`)
}
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
