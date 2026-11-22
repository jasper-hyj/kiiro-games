import { registerStrings } from '../../i18n'

export const BT_STRINGS: Record<string, [string, string]> = {
  btName: ['Big Two', '大老二'], btTagline: ['Get rid of your cards first. 2 is the highest card; singles, pairs, triples and five-card hands.', '最先出完手牌者獲勝。2 最大；可出單張、對子、三條與五張牌型。'],
  btPlay: ['Play with friends', '和朋友玩'], btPractice: ['Practice vs bots', '和電腦練習'], btStart: ['Start game', '開始遊戲'], btWaitHost: ['Waiting for the host to start.', '等待房主開始。'],
  btRanked: ['Ranked (chips)', '排名賽（籌碼）'], btCasual: ['Casual', '休閒'], btRankedHint: ['Needs 2+ players, all signed in. Chips move between players; bots never win or lose chips.', '需要兩位以上且全部已登入的玩家。籌碼在玩家之間轉移，電腦不會贏或輸籌碼。'],
  btSeats: ['Players', '玩家'], btBot: ['Bot (fills empty seats)', '電腦（補空位）'], btYou: ['you', '你'],
  btPlayBtn: ['Play', '出牌'], btPassBtn: ['Pass', '過'], btYourTurn: ['Your turn', '輪到你'], btLead: ['You lead: play anything', '你先出：任意牌型'], btOpen: ['You open: include the 3 of diamonds', '你開局：必須包含方塊 3'],
  btWaitTurn: ['{name} to play', '等待 {name}'], btPassed: ['pass', '過'], btCards: ['{n} cards', '{n} 張'],
  btWins: ['{name} goes out', '{name} 出完牌'], btPoints: ['Points', '得分'], btAgain: ['Back to lobby', '回到大廳'], btLeft: ['{n} left', '剩 {n} 張'],
  'btt.single': ['Single', '單張'], 'btt.pair': ['Pair', '對子'], 'btt.triple': ['Triple', '三條'], 'btt.straight': ['Straight', '順子'], 'btt.flush': ['Flush', '同花'], 'btt.fullhouse': ['Full house', '葫蘆'], 'btt.quads': ['Four of a kind', '鐵支'], 'btt.straightflush': ['Straight flush', '同花順'],
  btRules: ['Suits low to high: ♦ ♣ ♥ ♠. A straight cannot include a 2. Hands with 8+ cards left pay double, 10+ triple, all 13 quadruple.', '花色由小到大：♦ ♣ ♥ ♠。順子不可含 2。剩 8 張以上付雙倍，10 張以上三倍，13 張四倍。'],
  bad_combo: ['Those cards do not make a play.', '這些牌不能組成牌型。'], too_low: ['That does not beat the current play.', '打不過目前的牌。'], must_open: ['The first play must include the 3 of diamonds.', '第一手必須包含方塊 3。'], must_lead: ['You must lead; you cannot pass.', '你必須先出，不能過。'], bad_cards: ['Those cards are not in your hand.', '這些牌不在你的手上。'],
}
registerStrings(BT_STRINGS)
