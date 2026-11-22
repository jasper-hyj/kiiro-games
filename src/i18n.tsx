import { startSimplify, stopSimplify } from './simplify'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isHub } from './route'

export type Lang = 'en' | 'zh' | 'ja'

// Strings are registered by each game (src/games/<game>/strings.ts) and by the hub; this file only holds the language state.
// key: [English, 繁體中文]; a missing Japanese string falls back to English
const D: Record<string, [string, string]> = {}
const JA: Record<string, string> = {}
/** for the translation audit script */
export const allStrings = () => ({ D, JA })
export function registerStrings(enZh: Record<string, [string, string]>, ja: Record<string, string> = {}) { Object.assign(D, enZh); Object.assign(JA, ja) }

interface Ctx { lang: Lang; setLang: (l: Lang) => void; /** Simplified Chinese (only with lang 'zh'): the Traditional text is converted on screen */ simplified: boolean; setSimplified: (b: boolean) => void; t: (k: string, vars?: Record<string, string | number>) => string }
const C = createContext<Ctx>({ lang: 'en', setLang: () => {}, simplified: false, setSimplified: () => {}, t: (k) => k })

const detect = (): Lang => {
  try {
    const q = new URLSearchParams(location.search).get('lang')
    if (q === 'en' || q === 'zh' || q === 'ja') return q
    const saved = localStorage.getItem('kiiro-lang')
    if (saved === 'en' || saved === 'zh' || saved === 'ja') return saved
  } catch { /* ignore */ }
  const nl = typeof navigator !== 'undefined' ? navigator.language : ''
  return /^zh/i.test(nl) ? 'zh' : /^ja/i.test(nl) ? 'ja' : 'en'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect)
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem('kiiro-lang', l) } catch { /* ignore */ } }
  const [simplified, setSimp] = useState(() => { try { return new URLSearchParams(location.search).get('lang') === 'zhs' || localStorage.getItem('kiiro-zhs') === '1' } catch { return false } })
  const setSimplified = (b: boolean) => { setSimp(b); try { localStorage.setItem('kiiro-zhs', b ? '1' : '0') } catch { /* ignore */ } }
  useEffect(() => { if (lang === 'zh' && simplified) startSimplify(); else stopSimplify() }, [lang, simplified])
  useEffect(() => { document.documentElement.lang = lang === 'zh' ? (simplified ? 'zh-Hans' : 'zh-Hant') : lang === 'ja' ? 'ja' : 'en'; document.title = isHub() ? (lang === 'zh' ? (simplified ? 'Kiiro 游戏' : 'Kiiro 遊戲') : lang === 'ja' ? 'Kiiro ゲームズ' : 'Kiiro Games') : lang === 'zh' ? (simplified ? 'Kiiro 麻将' : 'Kiiro 麻將') : lang === 'ja' ? 'Kiiro 麻雀' : 'Kiiro Mahjong' }, [lang, simplified])
  const value = useMemo<Ctx>(() => ({
    lang, setLang, simplified, setSimplified,
    t: (k, vars) => {
      const e = D[k]
      let s = lang === 'ja' ? JA[k] ?? (e ? e[0] : k) : e ? e[lang === 'zh' ? 1 : 0] : k
      if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace(`{${a}}`, String(b))
      return s
    },
  }), [lang, simplified])
  return <C.Provider value={value}>{children}</C.Provider>
}
export const useLang = () => useContext(C)
