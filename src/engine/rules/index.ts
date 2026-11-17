import { riichi } from './riichi'
import { hongkong } from './hongkong'
import { taiwan } from './taiwan'
import type { RuleId, RuleSet } from './types'
export const RULESETS: Record<RuleId, RuleSet> = { riichi, hk: hongkong, taiwan }
export type { RuleId, RuleSet } from './types'
