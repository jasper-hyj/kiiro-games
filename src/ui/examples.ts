import type { RuleId } from '../engine/rules'

/** Worked winning-hand examples for the rules reference. The same data is scored by `scripts/examples-test.ts`,
 *  so every hand shown here really wins in the engine with exactly the stated total. */
export interface Example {
  rule: RuleId
  name: [string, string]
  /** concealed tiles before the winning tile, in notation: 123m 456p 789s 11z (z: 1-4 winds E S W N, 5 white 6 green 7 red) */
  hand: string
  win: string
  tsumo?: boolean
  riichi?: boolean
  /** called sets (they are shown to the right of the hand) */
  melds?: { type: 'chi' | 'pon' | 'minkan' | 'ankan'; tiles: string }[]
  /** flower kinds held (34 plum … 41 winter) */
  flowers?: number[]
  seat?: number
  voidSuit?: number
  /** what the engine must report: han / fan / tai total, and 1 or 2 for a (double) yakuman */
  total: number
  yakuman?: number
  note: [string, string]
}

export const EXAMPLES: Example[] = [
  // ---------------- Riichi ----------------
  { rule: 'riichi', name: ['Pinfu + self-draw', '平和 + 門前清自摸'], hand: '123m567m678s23p55s', win: '4p', tsumo: true, total: 2,
    note: ['All sequences, a two-sided wait (1p or 4p), a non-yakuhai pair, closed, won by self-draw: 2 han, 20 fu.', '全順子、兩面聽（一筒或四筒）、將牌不是役牌、門清自摸：2 翻 20 符。'] },
  { rule: 'riichi', name: ['Tanyao + pinfu (ron)', '斷幺九 + 平和（榮和）'], hand: '234m567p678s34p55m', win: '5p', total: 2,
    note: ['Only tiles 2–8 (tanyao) and all sequences with a two-sided wait (pinfu): 2 han, 30 fu on a closed ron.', '只有 2～8 的牌（斷幺九）再加全順子兩面聽（平和）：2 翻，門清榮和 30 符。'] },
  { rule: 'riichi', name: ['Iipeikou', '一盃口'], hand: '112233m456p789s5p', win: '5p', total: 1,
    note: ['Two identical sequences (1-2-3 m twice) in a closed hand: 1 han.', '門清時有兩組相同順子（一二三萬兩組）：1 翻。'] },
  { rule: 'riichi', name: ['Sanshoku doujun', '三色同順'], hand: '123m123p123s45m55p', win: '6m', total: 3,
    note: ['The same sequence 1-2-3 in all three suits (2 han closed) plus pinfu (1 han).', '三種花色都有一二三順子（門清 2 翻）再加平和 1 翻。'] },
  { rule: 'riichi', name: ['Ittsu + pinfu', '一氣通貫 + 平和'], hand: '123456789m23p55s', win: '4p', total: 3,
    note: ['1-2-3, 4-5-6 and 7-8-9 of one suit (2 han closed) plus pinfu: 3 han.', '同花色一二三、四五六、七八九（門清 2 翻）加平和：3 翻。'] },
  { rule: 'riichi', name: ['Honitsu + ittsu + red dragon', '混一色 + 一氣通貫 + 中'], hand: '123456789m777z5m', win: '5m', total: 6,
    note: ['One suit plus honors (3 han closed), a pure straight (2) and a dragon triplet (1): 6 han = haneman.', '單一花色加字牌（門清 3 翻）、一氣通貫 2 翻、三元牌刻子 1 翻：6 翻跳滿。'] },
  { rule: 'riichi', name: ['Toitoi + sanankou + round wind', '對對和 + 三暗刻 + 場風'], hand: '222m555p88s111z44z', win: '8s', seat: 1, total: 5,
    note: ['All triplets (2), three concealed triplets (2) and the East round-wind triplet (1): 5 han = mangan. The triplet won by ron counts as open, so it is not four concealed.', '對對和 2 翻、三暗刻 2 翻、東（場風）刻子 1 翻：5 翻滿貫。榮和完成的刻子算明刻，所以不是四暗刻。'] },
  { rule: 'riichi', name: ['Chiitoitsu (seven pairs)', '七對子'], hand: '1133m5577p2244s6z', win: '6z', total: 2,
    note: ['Seven different pairs: 2 han and always 25 fu. Four of a kind cannot count as two pairs.', '七組不同的對子：2 翻，固定 25 符。四張相同的牌不能算兩對。'] },
  { rule: 'riichi', name: ['Chinitsu + ittsu + riichi', '清一色 + 一氣通貫 + 立直'], hand: '123456789m1155m', win: '5m', riichi: true, total: 9,
    note: ['A full flush (6 han closed) with a pure straight (2) and riichi (1): 9 han = baiman.', '清一色（門清 6 翻）、一氣通貫 2 翻、立直 1 翻：9 翻倍滿。'] },
  { rule: 'riichi', name: ['Kokushi musou (thirteen orphans)', '國士無雙'], hand: '19m19p19s123456z9m', win: '7z', total: 13, yakuman: 1,
    note: ['One of each terminal and honor plus a pair of any: yakuman. Waiting on the last missing orphan.', '十三種幺九字牌各一張再加其中任一張當眼：役滿。這裡聽最後缺的那一張。'] },
  { rule: 'riichi', name: ['Kokushi 13-sided wait', '國士無雙十三面'], hand: '19m19p19s1234567z', win: '1m', total: 26, yakuman: 2,
    note: ['If you already hold all 13 orphans and wait on any of them, it is a double yakuman.', '如果手上已有十三種幺九字牌各一張，聽任何一張，算雙倍役滿。'] },
  { rule: 'riichi', name: ['Daisangen (big three dragons)', '大三元'], hand: '555666z77z123m99p', win: '7z', total: 13, yakuman: 1,
    note: ['Triplets of white, green and red dragons: yakuman.', '白、發、中三組刻子：役滿。'] },
  { rule: 'riichi', name: ['Suuankou (four concealed triplets)', '四暗刻'], hand: '111m222p333s44z55z', win: '5z', tsumo: true, total: 13, yakuman: 1,
    note: ['Four concealed triplets won by self-draw: yakuman. (Winning on a single-tile wait for the pair is a double yakuman.)', '四組暗刻自摸和牌：役滿。（單騎聽將牌則是雙倍役滿。）'] },
  { rule: 'riichi', name: ['Pure nine gates', '純正九蓮寶燈'], hand: '1112345678999m', win: '5m', total: 26, yakuman: 2,
    note: ['1112345678999 in one suit and any tile of that suit completes it: a double yakuman.', '同花色 1112345678999 再摸進該花色任一張：雙倍役滿。'] },
  { rule: 'riichi', name: ['Ryuuiisou (all green)', '綠一色'], hand: '223344s666s888s6z', win: '6z', total: 13, yakuman: 1,
    note: ['Only 2 3 4 6 8 bamboo and the green dragon: yakuman.', '只用二三四六八索和發：役滿。'] },

  // ---------------- Taiwanese (16 tiles + win) ----------------
  { rule: 'taiwan', name: ['Concealed self-draw + pinghu', '門清自摸 + 平胡'], hand: '234m456m234p234s23m55p', win: '4m', tsumo: true, total: 5,
    note: ['Concealed self-draw 3 tai + pinghu 2 tai (all sequences, two-sided wait, no honors or flowers) = 5 tai = 30 + 50 = 80 from each player.', '門清自摸 3 台 + 平胡 2 台（全順子、兩面聽、無字無花）= 5 台 = 30 + 50 = 80，三家各付。'] },
  { rule: 'taiwan', name: ['All triplets', '碰碰胡'], hand: '111m222p333s4z', win: '4z', melds: [{ type: 'pon', tiles: '999m' }, { type: 'pon', tiles: '555z' }], total: 8,
    note: ['All triplets 4 + three concealed triplets 2 + white dragon 1 + single wait 1 = 8 tai.', '碰碰胡 4 + 三暗刻 2 + 三元牌（白板）1 + 獨聽 1 = 8 台。'] },
  { rule: 'taiwan', name: ['Pure one suit', '清一色'], hand: '111m123m234m567m789m9m', win: '9m', total: 9,
    note: ['Everything in one suit: 8 tai, plus 1 tai for a concealed hand won by discard.', '全部同一花色：8 台，再加門清 1 台。'] },
  { rule: 'taiwan', name: ['Big three dragons', '大三元'], hand: '555666z777z123m234p9s', win: '9s', total: 15,
    note: ['Three dragon triplets: 8 tai, plus dragons 3, three concealed 2, single wait 1 and concealed 1.', '大三元 8 台，再加三元牌 3 台、三暗刻 2 台、獨聽 1 台、門清 1 台。'] },

  // ---------------- Hong Kong ----------------
  { rule: 'hk', name: ['Self-drawn common hand', '自摸平胡'], hand: '234m456p789s23m55p', win: '4m', tsumo: true, total: 5,
    note: ['Fully concealed self-draw 3 fan + common hand 1 + no flowers 1 = 5 fan = 24 points from each player.', '不求人 3 番 + 平胡 1 番 + 無花 1 番 = 5 番 = 三家各付 24 分。'] },
  { rule: 'hk', name: ['Pure one suit', '清一色'], hand: '1112345678999m', win: '5m', total: 9,
    note: ['Pure one suit 7 fan, concealed hand 1 and no flowers 1 = 9 fan.', '清一色 7 番、門前清 1 番、無花 1 番 = 9 番。'] },
  { rule: 'hk', name: ['Thirteen orphans', '十三幺'], hand: '19m19p19s1234567z', win: '1m', total: 13,
    note: ['Thirteen orphans is a limit hand: 13 fan = 128 points.', '十三幺是滿番牌型：13 番 = 128 分。'] },

  // ---------------- Chinese Official ----------------
  { rule: 'mcr', name: ['Big three dragons', '大三元'], hand: '555z666z77z123m99p', win: '7z', total: 97,
    note: ['Three dragon pungs: 88 fan, plus concealed hand 2, two concealed pungs 2, outside hand 4 and one voided suit 1 = 97 fan. The dragon pung patterns that overlap are dropped by the exclusion rules.', '三組三元牌刻子 88 番，加門前清 2、雙暗刻 2、全帶幺 4、缺一門 1，共 97 番；重疊的箭刻番種依不計規則排除。'] },
  { rule: 'mcr', name: ['Seven pairs', '七對'], hand: '1133m5577p2244s6z', win: '6z', total: 24,
    note: ['Seven pairs is worth 24 fan on its own (concealed hand is already included).', '七對本身 24 番（已含門前清）。'] },
  { rule: 'mcr', name: ['Thirteen orphans', '十三幺'], hand: '19m19p19s1234567z', win: '1m', total: 88,
    note: ['88 fan.', '88 番。'] },
  { rule: 'mcr', name: ['Nine gates', '九蓮寶燈'], hand: '1112345678999m', win: '5m', total: 88,
    note: ['88 fan.', '88 番。'] },

  // ---------------- Sichuan (void suit = bamboo) ----------------
  { rule: 'sichuan', name: ['Plain hand', '平胡'], hand: '123m456m789m12p33p', win: '3p', total: 0,
    note: ['0 fan = 1 point. Self-drawing would add 1 fan.', '0 番 = 1 分。自摸再加 1 番。'] },
  { rule: 'sichuan', name: ['Seven pairs in one suit', '清七對'], hand: '1122m3344m5566m7m', win: '7m', total: 4,
    note: ['Seven pairs 2 fan + pure suit 2 fan = 4 fan = 16 points (the cap).', '七對 2 番 + 清一色 2 番 = 4 番 = 16 分（上限）。'] },
  { rule: 'sichuan', name: ['All pungs', '對對胡'], hand: '222m555p9p', win: '9p', melds: [{ type: 'pon', tiles: '888m' }, { type: 'pon', tiles: '444p' }], total: 1,
    note: ['All pungs: 1 fan = 2 points.', '對對胡 1 番 = 2 分。'] },
]
