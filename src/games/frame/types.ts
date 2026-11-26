import type { ComponentType } from 'react'
import type { PlayViewX } from './client'

export interface BoardProps {
  v: PlayViewX
  send(a: Record<string, unknown>): void
  name(n: string): string
}
export interface GameUI {
  name: string
  blurb: string
  /** short chips describing the settings of this table */ settings(cfg: Record<string, any>, t: (k: string) => string): string[]
  help: { title: string; lines: string[] }
  Board: ComponentType<BoardProps>
}
