import { Table } from '../../src/games/mahjong/engine/table'

/** A human who never acts: first timeout => 'slow', second => 'auto' (bot plays), here() => back to normal. */
let fails = 0
const check = (name: string, ok: boolean, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${extra}`)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const t = new Table({ rule: 'hk', aka: true, rounds: 1, minFan: 0, players: 4, botLevel: 'normal' })
t.speed = 0.003
t.graceMs = 60000
t.turnTimerMs = 120
t.join('me', 'Me')
t.start('me')
const mine = () => t.view('me').game?.players[t.seatOf('me')]
let sawSlow = false,
  sawAuto = false
for (let i = 0; i < 400 && !sawAuto; i++) {
  await sleep(25)
  const p = mine()
  if (p?.idle === 'slow') sawSlow = true
  if (p?.idle === 'auto') sawAuto = true
}
check('first timeout shows slow', sawSlow)
check('second timeout hands the seat to a bot (auto)', sawAuto)
check('bot-controlled flag matches', t.isBotControlled(t.seatOf('me')))
check('a gone human seat is on autopilot (not a thinking bot)', t.isAutopilot(t.seatOf('me')))
await sleep(1500)
check('autopilot never calls: no melds', (t.game?.players[t.seatOf('me')].melds.length ?? 0) === 0)
t.here('me')
check('here() clears the idle state', mine()?.idle === undefined && !t.isBotControlled(t.seatOf('me')))
t.here('nobody')
t.here('me')
check('here() with unknown id / already back is harmless', true)
console.log(fails ? `${fails} FAILED` : 'idle checks passed')
process.exit(fails ? 1 : 0)
