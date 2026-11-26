/**
 * A table made from a room starts by itself: as soon as the room's players have sat down, or a few seconds after the first of them did (someone who
 * never arrives does not hold everyone up). There is no second "start" step.
 */
const WAIT_MS = 6000

export class AutoStart {
  private waiting: { expect: number; timer: ReturnType<typeof setTimeout> | null } | null = null

  /** the room said how many people are coming */
  expect(people: number | undefined) {
    this.cancel()
    this.waiting = { expect: Math.max(1, Math.floor(people ?? 1)), timer: null }
  }
  cancel() {
    if (this.waiting?.timer) clearTimeout(this.waiting.timer)
    this.waiting = null
  }
  /** call whenever someone sits: `start` runs once, now or after the wait */
  check(seated: number, seats: number, start: () => void) {
    const w = this.waiting
    if (!w) return
    const go = () => {
      this.cancel()
      start()
    }
    if (seated >= Math.min(w.expect, seats)) return go()
    if (seated > 0 && !w.timer) w.timer = setTimeout(go, WAIT_MS)
  }
}
