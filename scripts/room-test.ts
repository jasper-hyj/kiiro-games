import { Table } from '../src/engine/table'

/** Room life cycle: creating, joining by code, leaving, host hand-over, everybody leaving, coming back. */
let fails = 0
const check = (name: string, ok: boolean, extra = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${extra}`) }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fresh = () => { const t = new Table(); t.speed = 0.003; t.graceMs = 60; t.emptyMs = 150; t.turnTimerMs = 0; return t }

{ // a code nobody created
  const t = fresh()
  check('joining a code nobody created is refused', t.admit('a', false) === 'room_not_found')
  check('creating a room on an unused code is allowed', t.admit('a', true) === 'ok')
  t.join('a', 'Ann')
  check('creating on a code that is in use is refused', t.admit('b', true) === 'code_taken')
  check('joining a room that exists is allowed', t.admit('b', false) === 'ok')
  check('coming back to your own seat is always allowed (refresh)', t.admit('a', true) === 'ok' && t.admit('a', false) === 'ok')
}
{ // lobby: join, full, leave, host hand-over, last one out
  const t = fresh()
  for (const id of ['a', 'b', 'c', 'd']) t.join(id, id)
  check('4 players fit', t.slots.filter((s) => s.id).length === 4)
  check('a 5th player gets "full"', t.join('e', 'E') === -1 && t.admit('e', false) === 'ok')
  check('first player is the host', t.hostId === 'a')
  t.leave('a')
  check('host leaves the lobby: host passes to another player', t.hostId !== null && t.hostId !== 'a' && t.seatOf(t.hostId) >= 0)
  check("host's seat is free again", t.seatOf('a') < 0 && t.join('e', 'E') >= 0)
  for (const id of ['b', 'c', 'd', 'e']) t.leave(id)
  check('everybody left the lobby: the room is empty again', !t.hasPlayers() && t.hostId === null)
  check('and its code can no longer be joined, only created', t.admit('x', false) === 'room_not_found' && t.admit('x', true) === 'ok')
}
{ // a started game
  const t = fresh()
  t.join('a', 'Ann'); t.join('b', 'Bob')
  t.start('a')
  check('game started', t.status === 'playing' && !!t.game)
  const hostSeat = t.seatOf('a')
  t.leave('a')
  check('host drops mid-game: host passes to a player who is still connected', t.hostId === 'b')
  check('dropped player keeps the seat during the grace period', t.seatOf('a') === hostSeat && !t.isBotControlled(hostSeat))
  await sleep(100)
  check('after the grace period a bot plays the seat', t.isBotControlled(hostSeat))
  t.join('a', 'Ann')
  check('coming back gets the same seat and control', t.seatOf('a') === hostSeat && !t.isBotControlled(hostSeat) && t.view('a').you === hostSeat)
  t.leave('b', true)
  check('a deliberate leave hands the seat to a bot at once', t.isBotControlled(t.seatOf('b')))
  check('a non-host cannot send everybody back to the lobby', (t.backToLobby('b'), t.status === 'playing'))
  t.leave('a')
  await sleep(40)
  t.join('b', 'Bob')
  await sleep(220)
  check('joining before the empty-room timer ends keeps the game', t.status === 'playing' && t.hasPlayers())
  t.leave('b')
  await sleep(260)
  check('everybody gone for a while: the room is closed and emptied', !t.hasPlayers() && t.status === 'lobby' && t.game === null)
  check('a closed room behaves like a new one', t.admit('z', false) === 'room_not_found' && t.admit('z', true) === 'ok')
}
{ // mid-game joiner takes a bot seat; none left -> refused
  const t = fresh()
  t.join('a', 'Ann'); t.start('a')
  const s = t.join('n', 'New')
  check('a newcomer mid-game replaces a bot', s >= 0 && s !== t.seatOf('a'))
  t.join('m', 'M'); t.join('o', 'O')
  check('with no bot left a newcomer is refused', t.join('p', 'P') === -1)
  t.leave('a'); t.leave('n'); t.leave('m'); t.leave('o')
}
{ // game over -> back to lobby clears disconnected seats, keeps connected ones
  const t = fresh()
  t.join('a', 'Ann'); t.join('b', 'Bob'); t.start('a')
  t.leave('b')
  t.backToLobby('a')
  check('back to lobby: disconnected player is removed, connected one stays', t.status === 'lobby' && t.seatOf('b') < 0 && t.seatOf('a') >= 0)
  t.leave('a')
}
console.log(fails ? `${fails} FAILED` : 'room checks passed')
process.exit(fails ? 1 : 0)
