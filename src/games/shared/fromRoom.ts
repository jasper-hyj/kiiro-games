import { roomUrl, route } from '../../route'
/** A table page (/<game>/1234) always belongs to the room with the same code: "Back to room" instead of a plain leave. Practice has no room. */
export const fromRoom = (): boolean => route().page === 'table'
export const watchOnly = (): boolean => {
  const r = route()
  return r.page === 'table' && r.watch
}
export const backToRoom = (code: string): void => {
  location.href = roomUrl(code)
}
