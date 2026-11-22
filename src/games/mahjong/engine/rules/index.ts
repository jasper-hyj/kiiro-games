import { riichi } from './riichi'
import { hongkong } from './hongkong'
import { taiwan } from './taiwan'
import { mcr } from './mcr'
import { sichuan } from './sichuan'
import type { RuleId, RuleSet } from './types'
export const RULESETS: Record<RuleId, RuleSet> = { riichi, hk: hongkong, taiwan, mcr, sichuan }
export type { RuleId, RuleSet } from './types'
