/** Chat at a room or a table: one message a second per person at most, 140 characters of plain text, the last 40 kept. */
export interface TalkMessage {
  n: number
  name: string
  text: string
}

const clean = (raw: unknown) =>
  String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140)

export class TalkLog {
  messages: TalkMessage[] = []
  private count = 0
  private last = new Map<string, number>()

  /** Add what `id` said: the stored message, 'slow_down' when they are too fast, or null when there is nothing to say. */
  say(id: string, name: string, raw: unknown, now = Date.now()): TalkMessage | 'slow_down' | null {
    const text = clean(raw)
    if (!text) return null
    if (now - (this.last.get(id) ?? 0) < 1000) return 'slow_down'
    this.last.set(id, now)
    const message = { n: ++this.count, name, text }
    this.messages.push(message)
    if (this.messages.length > 40) this.messages.shift()
    return message
  }
  /** bring back a saved log; numbering carries on from it */
  restore(saved: TalkMessage[]) {
    this.messages = saved
    this.count = saved.at(-1)?.n ?? 0
  }
  clear() {
    this.messages = []
  }
}
