/**
 * Small table sounds made on the spot with Web Audio (no files to load): a wooden click when something is played, two notes when it becomes your
 * turn, and a short phrase when a game ends. One switch mutes them all and is remembered. Phones also give a short buzz for "your turn".
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

export type Cue = 'move' | 'turn' | 'win' | 'lose' | 'draw'

const KEY = 'kiiro-sound'
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === 'off'
  } catch {
    return false
  }
})()
const listeners = new Set<() => void>()
export const isMuted = () => muted
export function setMuted(m: boolean) {
  muted = m
  try {
    localStorage.setItem(KEY, m ? 'off' : 'on')
  } catch {
    /* ignore */
  }
  for (const f of listeners) f()
}
export function useMuted(): boolean {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    isMuted,
    isMuted,
  )
}

let ctx: AudioContext | null = null
let touched = false
// browsers only allow sound after the person has touched or typed something on the page
if (typeof window !== 'undefined') {
  const wake = () => {
    touched = true
    if (ctx?.state === 'suspended') void ctx.resume()
  }
  window.addEventListener('pointerdown', wake, { passive: true })
  window.addEventListener('keydown', wake)
}

function tone(c: AudioContext, at: number, freq: number, length: number, volume: number, type: OscillatorType = 'sine') {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, at)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  osc.connect(gain).connect(c.destination)
  osc.start(at)
  osc.stop(at + length + 0.02)
}

/** counts what was asked for, so tests can check without listening */
export const played: Cue[] = []

export function play(cue: Cue) {
  if (muted) return
  played.push(cue)
  if (played.length > 50) played.shift()
  if (typeof window !== 'undefined') (window as unknown as { __cues?: Cue[] }).__cues = played
  if (!touched) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const now = ctx.currentTime + 0.01
    if (cue === 'move') {
      tone(ctx, now, 190, 0.07, 0.16, 'triangle')
      tone(ctx, now, 880, 0.025, 0.04, 'square')
    } else if (cue === 'turn') {
      tone(ctx, now, 660, 0.16, 0.09)
      tone(ctx, now + 0.11, 880, 0.22, 0.08)
      navigator.vibrate?.(40)
    } else {
      const notes = cue === 'win' ? [523, 659, 784, 1047] : cue === 'lose' ? [392, 330, 262] : [440, 440]
      notes.forEach((f, i) => tone(ctx!, now + i * 0.12, f, 0.28, 0.09))
    }
  } catch {
    /* sound is a nicety: never break the game over it */
  }
}

/**
 * Sounds for a table. `move` is any text that changes whenever something happens on the table; `myTurn` and `result` say when to chime.
 * Nothing sounds for the state the page opened with.
 */
export function useTableSounds({ move, myTurn, result }: { move: string; myTurn: boolean; result: 'win' | 'lose' | 'draw' | null }) {
  const [ready, setReady] = useState(false)
  const before = useRef({ move, myTurn, result })
  useEffect(() => {
    const was = before.current
    before.current = { move, myTurn, result }
    if (!move) return
    if (!ready) return setReady(true)
    if (result && !was.result) return play(result)
    if (myTurn && !was.myTurn) return play('turn')
    if (move !== was.move && was.move) play('move')
  }, [move, myTurn, result]) // eslint-disable-line react-hooks/exhaustive-deps
}
