/** The slice of the Cloudflare D1 API this project uses (avoids pulling in the full workers-types package). */
export interface D1Stmt {
  bind(...v: unknown[]): D1Stmt
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<{ meta?: { changes?: number } }>
}
export interface D1 {
  prepare(sql: string): D1Stmt
  batch(s: D1Stmt[]): Promise<unknown[]>
}
export interface Env {
  Room?: unknown
  Main?: unknown
  DB?: D1
  GOOGLE_CLIENT_ID?: string
  APP_URL?: string
  /** comma-separated emails allowed into /admin */
  ADMIN_EMAILS?: string
  ADMIN_USERS?: string
  /** "1" in .dev.vars only: the magic link is returned in the API response instead of emailed */
  DEV_MODE?: string
  [k: string]: unknown
}
