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
  btHow: ['How to play Big Two', '大老二玩法'],
  btR1: ['Each player gets 13 cards. The first to play all their cards wins; the others pay points for the cards they hold.', '每人 13 張牌。最先出完者獲勝，其餘玩家依剩餘牌數付分。'],
  btR2: ['Card order, low to high: 3 4 5 6 7 8 9 10 J Q K A 2. Suits, low to high: diamonds, clubs, hearts, spades.', '牌面由小到大：3 4 5 6 7 8 9 10 J Q K A 2。花色由小到大：方塊、梅花、紅心、黑桃。'],
  btR3: ['Play a single, pair, triple or five-card hand (straight, flush, full house, four of a kind with a spare card, straight flush). Follow with the same number of cards and a stronger play, or pass.', '可出單張、對子、三條或五張牌型（順子、同花、葫蘆、四條加一張、同花順）。接牌必須張數相同且更大，或選擇過。'],
  btR4: ['The holder of the 3 of diamonds opens and must include it. When everyone else passes, the last player to play leads anything.', '持有方塊 3 的玩家開局且必須包含它。其他人都過牌後，最後出牌的人可以任意出牌。'],
  btR5: ['Five-card ranks: straight, flush, full house, four of a kind, straight flush. A straight cannot include a 2.', '五張牌型大小：順子、同花、葫蘆、四條、同花順。順子不可含 2。'],
  btRules: ['Suits low to high: ♦ ♣ ♥ ♠. A straight cannot include a 2. Hands with 8+ cards left pay double, 10+ triple, all 13 quadruple.', '花色由小到大：♦ ♣ ♥ ♠。順子不可含 2。剩 8 張以上付雙倍，10 張以上三倍，13 張四倍。'],
  bad_combo: ['Those cards do not make a play.', '這些牌不能組成牌型。'], too_low: ['That does not beat the current play.', '打不過目前的牌。'], must_open: ['The first play must include the 3 of diamonds.', '第一手必須包含方塊 3。'], must_lead: ['You must lead; you cannot pass.', '你必須先出，不能過。'], bad_cards: ['Those cards are not in your hand.', '這些牌不在你的手上。'],
}
registerStrings(BT_STRINGS)

registerStrings({}, {
  btName: '大老二', btTagline: '最初に手札を出し切った人の勝ち。2が最強で、シングル・ペア・スリーカード・5枚役で出します。',
  btPlay: '友達と遊ぶ', btPractice: 'CPUと練習', btStart: 'ゲーム開始', btWaitHost: 'ホストの開始を待っています。', btRanked: 'ランク戦（チップ）', btCasual: 'カジュアル',
  btRankedHint: '全員がログイン済みの2人以上が必要です。チップはプレイヤー間で移動し、CPUは得も失いもしません。', btSeats: 'プレイヤー', btBot: 'CPU（空席を埋めます）', btYou: 'あなた',
  btPlayBtn: '出す', btPassBtn: 'パス', btYourTurn: 'あなたの番です', btLead: '先手：好きな役を出せます', btOpen: '開始：ダイヤの3を含めてください', btWaitTurn: '{name} の番', btPassed: 'パス', btCards: '{n} 枚',
  btWins: '{name} があがり', btPoints: '得点', btAgain: 'ロビーに戻る', btLeft: '残り {n}',
  'btt.single': 'シングル', 'btt.pair': 'ペア', 'btt.triple': 'スリーカード', 'btt.straight': 'ストレート', 'btt.flush': 'フラッシュ', 'btt.fullhouse': 'フルハウス', 'btt.quads': 'フォーカード', 'btt.straightflush': 'ストレートフラッシュ',
  btRules: '花色の強さ：♦ ♣ ♥ ♠。ストレートに2は含められません。残り8枚以上は2倍、10枚以上は3倍、13枚は4倍の支払い。',
  bad_combo: 'その札は役になりません。', too_low: '場の札に勝てません。', must_open: '最初の手はダイヤの3を含める必要があります。', must_lead: '先手なのでパスできません。', bad_cards: 'その札は手札にありません。',
  btHow: '大老二の遊び方',
  btR1: '各自13枚。最初に出し切った人が勝ち、他の人は残り枚数に応じて点を支払います。', btR2: '札の強さ（弱い順）：3 4 5 6 7 8 9 10 J Q K A 2。花色（弱い順）：ダイヤ、クラブ、ハート、スペード。',
  btR3: 'シングル・ペア・スリーカード・5枚役（ストレート、フラッシュ、フルハウス、フォーカード＋1枚、ストレートフラッシュ）を出せます。同じ枚数でより強い役を出すか、パスします。',
  btR4: 'ダイヤの3を持つ人が開始し、必ずそれを含めます。全員がパスしたら、最後に出した人が好きな役で先手になります。', btR5: '5枚役の強さ：ストレート、フラッシュ、フルハウス、フォーカード、ストレートフラッシュ。ストレートに2は含められません。',
})
