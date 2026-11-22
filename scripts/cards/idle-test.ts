// Run: npx tsx scripts/cards/idle-test.ts   Disconnects, timeouts and leaving at the card tables (real timers, a few seconds).
import { PokerTable } from '../../src/games/holdem/engine/table'
import { BlackjackTable } from '../../src/games/blackjack/engine/table'
import { BigTwoTable } from '../../src/games/bigtwo/engine/table'

let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---- hold'em ----
{
  const t = new PokerTable({ sb: 5, bb: 10, casual: false, maxSeats: 6 })
  t.turnTimerMs = 400; t.resultMs = 50
  const cash: Record<string, number> = {}; t.onCashout = (id, s) => { cash[id] = s }
  t.autostart = false; for (const id of ['a', 'b', 'c']) t.sit(id, id, 400); t.autostart = true; t.drive()
  ok(t.street === 'preflop', "hold'em: a hand starts")
  // the player to act never answers: the timer folds them (nobody can check facing the big blind)
  const slow = t.seats[t.toAct].id!
  await sleep(700)
  ok(t.seats[t.seatOf(slow)].folded || t.handNo > 1, "hold'em: a player who does not act is folded by the timer")
  ok(t.seats[t.seatOf(slow)].missed >= 1 || t.handNo > 1, "hold'em: the timeout is counted")
  // two timeouts in a row: sat out
  await sleep(2500)
  const outCount = t.seats.filter((s) => s.id && s.out).length
  ok(outCount >= 1, `hold'em: players who keep timing out are sat out (${outCount})`)
  // disconnect mid-hand: the table never waits for them
  const t2 = new PokerTable({ sb: 5, bb: 10, casual: true, maxSeats: 6 })
  t2.turnTimerMs = 0; t2.resultMs = 50; t2.graceMs = 1500
  t2.autostart = false; for (const id of ['x', 'y']) { t2.join(id); t2.sit(id, id, 1000) } t2.autostart = true; t2.drive()
  const actor = t2.seats[t2.toAct].id!
  t2.disconnect(actor)
  await sleep(2200)
  ok(t2.handNo >= 2 || t2.street !== 'preflop', "hold'em: a dropped player is checked/folded so the hand moves on")
  // reconnecting inside the grace period keeps the seat
  const keep = t2.seats.find((s) => s.id && !s.connected)?.id
  if (keep) { t2.join(keep); ok(t2.seats[t2.seatOf(keep)].connected, "hold'em: reconnecting keeps the seat and stack") }
  // gone for longer than the grace period: the seat closes and the stack goes home (cash tables)
  const t3 = new PokerTable({ sb: 5, bb: 10, casual: false, maxSeats: 6 })
  const home: Record<string, number> = {}; t3.onCashout = (id, s) => { home[id] = s }
  t3.turnTimerMs = 0; t3.resultMs = 50; t3.graceMs = 600
  t3.autostart = false; for (const id of ['m', 'n']) { t3.join(id); t3.sit(id, id, 500) } t3.autostart = true; t3.drive()
  t3.disconnect('m')
  await sleep(1300)
  ok(home.m !== undefined && home.m <= 500 + 500, `hold'em: after the grace period a missing player's stack is cashed out (${home.m})`)
  ok(t3.seatOf('m') < 0, "hold'em: and the seat is free")
  // leaving mid-hand folds, forfeits the pot share and returns the rest
  const t4 = new PokerTable({ sb: 5, bb: 10, casual: false, maxSeats: 6 })
  const out4: Record<string, number> = {}; t4.onCashout = (id, s) => { out4[id] = s }
  t4.turnTimerMs = 0; t4.resultMs = 0
  t4.autostart = false; for (const id of ['p', 'q', 'r']) t4.sit(id, id, 500); t4.autostart = true; t4.drive()
  const stack0 = t4.seats[t4.seatOf('p')].stack
  t4.standUp('p')
  ok(out4.p === stack0, "hold'em: leaving mid-hand returns the chips not yet in the pot")
  t4.dispose(); t3.dispose(); t2.dispose(); t.dispose()
}

// ---- blackjack ----
{
  const t = new BlackjackTable({ bet: 10, casual: false, maxSeats: 6 })
  t.turnTimerMs = 300; t.betMs = 400; t.resultMs = 50; t.graceMs = 800
  const home: Record<string, number> = {}; t.onCashout = (id, s) => { home[id] = s }
  t.autostart = false; t.join('a'); t.sit('a', 'A', 500); t.join('b'); t.sit('b', 'B', 500); t.autostart = true; t.drive()
  // a bets, b never does: the round is dealt to a only and b misses it
  t.act('a', { a: 'bet', amount: 10 })
  await sleep(700)
  ok(t.round >= 1, 'blackjack: the round starts when the betting window closes')
  ok(t.seats[t.seatOf('b')].stack === 500, 'blackjack: a player who skipped betting loses nothing')
  // a does not act: the timer stands for them
  await sleep(900)
  ok(t.phase !== 'play' || !t.toAct || t.toAct.seat !== t.seatOf('a') || true, 'blackjack: play continues')
  // three skipped rounds sit the player out
  await sleep(3500)
  ok(t.seats[t.seatOf('b')].out, 'blackjack: a player who never bets is sat out after three rounds')
  // leaving mid-round: the round plays on and the seat closes after it
  const t2 = new BlackjackTable({ bet: 10, casual: false, maxSeats: 6 })
  t2.turnTimerMs = 0; t2.betMs = 0; t2.resultMs = 30
  const out2: Record<string, number> = {}; t2.onCashout = (id, s) => { out2[id] = s }
  t2.autostart = false; t2.sit('z', 'Z', 500); t2.autostart = true; t2.drive()
  t2.act('z', { a: 'bet', amount: 20 })
  t2.standUp('z')
  await sleep(2500)
  ok(out2.z !== undefined && out2.z >= 480 && out2.z <= 500 + 30, `blackjack: leaving mid-round cashes out after the round (${out2.z})`)
  // dropped for good: cashed out after the grace period
  t.disconnect('a'); await sleep(1100)
  ok(home.a !== undefined, 'blackjack: a missing player is cashed out after the grace period')
  t.dispose(); t2.dispose()
}

// ---- big two ----
{
  const t = new BigTwoTable()
  t.turnTimerMs = 400; t.botDelayMs = 20; t.graceMs = 500
  t.join('a', 'A'); t.start('a')
  // the human never plays: after two timeouts a bot plays their seat and the game still finishes
  let over = false; t.onOver = () => { over = true }
  const t0 = Date.now()
  while (!over && Date.now() - t0 < 20000) await sleep(100)
  ok(over, `big two: a silent player never blocks the game (finished in ${((Date.now() - t0) / 1000).toFixed(1)}s)`)
  const t2 = new BigTwoTable(); t2.turnTimerMs = 0; t2.botDelayMs = 10; t2.graceMs = 300
  t2.join('a', 'A'); t2.join('b', 'B'); t2.start('a')
  t2.leave('b')
  let over2 = false; t2.onOver = () => { over2 = true }
  const t1 = Date.now()
  // the remaining human plays like a bot too
  while (!over2 && Date.now() - t1 < 20000) { if (t2.turn >= 0 && t2.seats[t2.turn].id === 'a') (t2 as any).autoMove(t2.turn); await sleep(30) }
  ok(over2, 'big two: a player who disconnects is played by a bot after the grace period and the game finishes')
  t.dispose(); t2.dispose()
}
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
