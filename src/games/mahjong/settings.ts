import { useSyncExternalStore } from 'react'

/** Accessibility preferences, remembered per device and applied as attributes on <html>. */
export type TileStyle = 'auto' | 'chinese' | 'japanese'
export interface Settings {
  showIndex: boolean
  /** auto follows the room's rule: Japanese for Riichi, Chinese for the rest */ tileStyle: TileStyle
}
const KEY = 'kiiro-settings5'
let state: Settings = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v && typeof v === 'object')
      return { showIndex: v.showIndex !== false, tileStyle: v.tileStyle === 'chinese' || v.tileStyle === 'japanese' ? v.tileStyle : 'auto' }
  } catch {
    /* ignore */
  }
  return { showIndex: true, tileStyle: 'auto' as TileStyle }
})()
const subs = new Set<() => void>()
const apply = () => {
  const el = document.documentElement
  el.dataset.idx = state.showIndex ? 'on' : 'off'
  el.dataset.tiles = state.tileStyle
}
apply()
export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
  state = { ...state, [k]: v }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
  apply()
  subs.forEach((f) => f())
}
export const useSettings = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => {
        subs.delete(f)
      }
    },
    () => state,
  )
