import type { RuleId } from './engine/rules'
/** How each Mahjong ruleset is shown wherever it is chosen (the room) or named (the table): a glyph, a colour and three short tags. */
export const RULE_IDS: RuleId[] = ['taiwan', 'hk', 'riichi', 'mcr', 'sichuan']
export const RULE_GLYPH: Record<string, string> = { taiwan: '台', hk: '港', riichi: '日', mcr: '國', sichuan: '川' }
export const RULE_TAGS: Record<string, string[]> = { taiwan: ['tg.t16', 'tg.flowers', 'tg.tai'], hk: ['tg.t13', 'tg.min3', 'tg.flowers'], riichi: ['tg.yaku', 'tg.dora', 'tg.riichi'], mcr: ['tg.fan81', 'tg.min8'], sichuan: ['tg.t108', 'tg.swap', 'tg.blood'] }
export const RULE_COLOR: Record<string, string> = { taiwan: '#ffb84d', hk: '#ff5a72', riichi: '#ff9cc2', mcr: '#a48bff', sichuan: '#46d1f0' }
