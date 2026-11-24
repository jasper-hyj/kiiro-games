/** The player's saved display name. Stored as JSON (the Mahjong page reads it that way); older versions stored it bare, so both are read. */
const KEY = 'kiiro-name'
export function readName(fallback = ''): string {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fallback
    if (raw.startsWith('"')) { const v = JSON.parse(raw); return typeof v === 'string' ? v : fallback }
    return raw
  } catch { return fallback }
}
export function writeName(name: string): void { try { localStorage.setItem(KEY, JSON.stringify(name)) } catch { /* ignore */ } }

/** The saved name, or a new "Guest 482" that is kept for every game that follows: nobody is asked for a name before playing. */
export function nameOrGuest(): string { const s = readName(''); if (s && s !== 'Player') return s; const g = 'Guest ' + (100 + Math.floor(Math.random() * 900)); writeName(g); return g }
