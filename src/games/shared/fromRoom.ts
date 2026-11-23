/** Opening a game from a room: /<game>?room=1234&from=room[&make=1&cfg={...}][&watch=1]. The host makes the table, the others join it. */
const q = () => new URLSearchParams(location.search)
export const fromRoom = (): boolean => q().get('from') === 'room'
export const watchOnly = (): boolean => q().get('watch') === '1'
/** the host's settings, only on the first load that creates the table (a refresh must join it, not create it again) */
export const makeCfg = (): Record<string, string | number | boolean> | null => {
  if (q().get('make') !== '1') return null
  try { const c = JSON.parse(q().get('cfg') || '{}'); return c && typeof c === 'object' ? c : {} } catch { return {} }
}
/** what stays in the address bar once the table exists */
export const roomSuffix = (): string => `${fromRoom() ? '&from=room' : ''}${watchOnly() ? '&watch=1' : ''}`
export const backToRoom = (rm: string): void => { location.href = `/room?room=${rm}` }
