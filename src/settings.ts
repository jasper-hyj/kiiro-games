import { useSyncExternalStore } from 'react'

/** Accessibility preferences, remembered per device and applied as attributes on <html>. */
export interface Settings { reduceMotion: boolean; flatPonds: boolean }
const KEY = 'kiiro-settings'
const prefersReduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }
let state: Settings = (() => {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (v && typeof v === 'object') return { reduceMotion: !!v.reduceMotion, flatPonds: !!v.flatPonds } } catch { /* ignore */ }
  return { reduceMotion: prefersReduced(), flatPonds: false }
})()
const subs = new Set<() => void>()
const apply = () => {
  const el = document.documentElement
  el.dataset.motion = state.reduceMotion ? 'reduce' : 'full'
  el.dataset.ponds = state.flatPonds ? 'flat' : 'turned'
}
apply()
export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
  state = { ...state, [k]: v }
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
  apply(); subs.forEach((f) => f())
}
export const useSettings = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => state)
