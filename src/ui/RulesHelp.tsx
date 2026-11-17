import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { RuleId } from '../engine/rules'
import { useLang } from '../i18n'

// [English name, 中文名, English description, 中文說明]
type Row = [string, string, string, string]
interface Section { title: [string, string]; text?: [string, string][]; rows?: Row[] }
interface Data { intro: [string, string][]; sections: Section[] }
type TabId = RuleId | 'basics'

const DATA: Record<TabId, Data> = {
  basics: {
    intro: [
      ['Mahjong is a draw-and-discard game for four players (three in Riichi sanma). Everyone builds a hand of complete sets plus a pair; the first to complete a legal hand wins. These basics are shared by every ruleset here — the other tabs list what differs.', '麻將是四人（日麻三人制為三人）輪流摸牌、打牌的遊戲。每人把手牌湊成數組面子加一對眼，最先湊成合法牌型者獲勝。這裡是所有規則共通的基礎，其他分頁說明各規則的差異。'],
    ],
    sections: [
      { title: ['Tiles', '牌種'], rows: [
        ['Characters (萬)', '萬子', '1–9, four copies each', '一～九，每種 4 張'],
        ['Circles (筒)', '筒子', '1–9, four copies each', '一～九，每種 4 張'],
        ['Bamboo (索)', '索子', '1–9, four copies each (the 1 is drawn as a bird)', '一～九，每種 4 張（一索畫成小鳥）'],
        ['Winds', '風牌', 'East 東, South 南, West 西, North 北 — four copies each', '東南西北，每種 4 張'],
        ['Dragons', '三元牌', 'Red 中, Green 發, White 白 (the blank frame) — four copies each', '紅中、綠發、白板（空框），每種 4 張'],
        ['Flowers', '花牌', 'Taiwanese and Hong Kong only: 梅蘭菊竹 and 春夏秋冬, one copy each. They are never part of your hand', '只有台灣與香港麻將使用：梅蘭菊竹、春夏秋冬各 1 張，不屬於手牌'],
      ] },
      { title: ['Sets and the winning hand', '面子與胡牌牌型'], rows: [
        ['Sequence (chi)', '順子', 'three consecutive numbers of one suit, e.g. 3-4-5 circles. Honors never form sequences', '同花色三張連號，如三四五筒；字牌不能組順子'],
        ['Triplet (pon)', '刻子', 'three identical tiles', '三張相同的牌'],
        ['Kan', '槓', 'four identical tiles; counts as one triplet and you draw a replacement tile', '四張相同的牌，算一組刻子，並補摸一張'],
        ['Pair', '眼（將）', 'two identical tiles', '兩張相同的牌'],
        ['Winning hand', '胡牌', 'Riichi and Hong Kong: 4 sets + 1 pair (14 tiles). Taiwanese: 5 sets + 1 pair (17 tiles)', '日麻與港麻：4 組面子 + 1 對眼（14 張）；台灣麻將：5 組面子 + 1 對眼（17 張）'],
      ] },
      { title: ['How a turn works', '回合流程'], text: [
        ['1. On your turn you draw one tile, then discard one tile (the hand always returns to its normal size).', '1. 輪到你時摸一張牌，再打出一張牌，手牌張數回到原本數量。'],
        ['2. After anyone discards, the other players may claim the tile. Priority: win (ron) beats pon / kan, which beats chi. If several players can win off the same discard, they all win (double ron).', '2. 有人打牌後，其他玩家可以選擇要不要那張牌。優先順序：胡牌（榮和）> 碰／槓 > 吃。若多人能胡同一張牌，則同時胡牌（一炮多響）。'],
        ['3. Chi takes the discard of the player on your left only and completes a sequence. Pon takes a discard from anyone to make a triplet. After any claim you do not draw — you discard immediately.', '3. 吃只能吃上家（你左手邊玩家）的牌，組成順子。碰可以碰任何人的牌，組成刻子。吃或碰之後不用摸牌，直接打出一張。'],
        ['4. Kan: open (claim a discard with three in hand), concealed (all four in hand) or added (a fourth tile onto an existing pon). After a kan you draw from the end of the wall.', '4. 槓：明槓（用手上三張槓別人的牌）、暗槓（手上四張）、加槓（把第四張加到已碰的刻子）。槓牌後從牌牆尾補摸一張。'],
        ['5. Win by self-draw (tsumo) when the tile you draw completes your hand, or by ron when someone discards the tile you need. A hand with an open claim is "exposed"; without any it is "concealed".', '5. 自己摸到完成牌型的牌為自摸；別人打出你要的牌為榮和（放槍）。有吃碰槓的手牌稱為副露（不門清），沒有則是門清。'],
        ['6. If the wall runs out with no winner, the hand is a draw.', '6. 牌牆摸完仍無人胡牌則流局。'],
      ] },
      { title: ['Controls in this game', '操作方式'], rows: [
        ['Discard', '打牌', 'double-tap (or double-click) a tile, or drag it upward onto the table', '連點兩下牌，或把牌往上拖到桌面'],
        ['Calls', '吃碰槓胡', 'buttons appear in a row above your hand only when an action exists; Pass skips', '只有能做動作時，按鈕才會出現在手牌上方；按「過」放棄'],
        ['Auto options', '自動功能', 'corner menu: auto-win, auto-discard, skip calls, hints, rotate table on phones', '右上角選單：自動胡牌、自動打牌、不吃碰、提示、手機自動旋轉'],
        ['Keyboard', '鍵盤', 'Enter / Space and letter shortcuts — see "Keyboard shortcuts" in the menu', 'Enter／空白鍵與字母快捷鍵，請看選單中的「鍵盤快捷鍵」'],
        ['Bots', '電腦', 'empty seats are always filled by Bot 1, Bot 2, Bot 3; a bot also takes over if you disconnect for more than a few seconds', '空位一律自動由電腦 1、2、3 補上；斷線超過數秒也會由電腦接手'],
      ] },
    ],
  },
  taiwan: {
    intro: [
      ['16 tiles (5 sets + a pair) from a 144-tile set with 8 flowers. There is no minimum — any complete hand wins.', '每人 16 張（5 組面子 + 一對眼），共 144 張牌含 8 張花牌。沒有最低台數，只要胡牌就算贏。'],
      ['Payment = base 30 + 10 per tai. Self-draw: every opponent pays. Discard win: only the discarder pays (several players can win off the same discard).', '輸贏 = 底 30 + 每台 10。自摸三家都付；放槍只由放槍者付（一炮可多家同時胡）。'],
      ['The dealer wins +1 tai and +2 per consecutive win or draw (連莊拉莊); when the dealer pays, they also owe that bonus. Collecting all 8 flowers wins immediately (8 tai).', '莊家胡牌加 1 台，每連莊一次再加 2 台（連莊拉莊）；莊家放槍或被自摸時也要多付。集齊 8 張花牌直接胡（八仙過海 8 台）。'],
    ],
    sections: [
      { title: ['Tai', '台數'], rows: [
        ['Dealer', '莊家', '1 (+2 per streak)', '1 台（每連莊 +2）'],
        ['Concealed Hand', '門清', '1', '1 台'], ['Self-draw', '自摸', '1', '1 台'],
        ['Concealed Self-draw', '門清自摸', '3 (replaces the two above)', '3 台（取代門清與自摸）'],
        ['All Exposed', '全求人', '2 — win by discard, all melds open', '2 台 — 全部吃碰槓後放槍胡'],
        ['Dragon / Seat Wind / Round Wind', '三元牌/門風/圈風', '1 each triplet', '各 1 台（刻子）'],
        ['Seat Flower', '花牌', '1 each', '正花每張 1 台'], ['Flower Set', '花槓', '2', '2 台'],
        ['Pinghu', '平胡', '2 — all sequences, two-sided wait, no honors or flowers', '2 台 — 全順子、兩面聽、無字無花'],
        ['Single Wait', '獨聽', '1', '1 台'],
        ['Last tile / last discard', '海底撈月/河底撈魚', '1', '1 台'], ['Win on Kong / Robbing Kong', '槓上開花/搶槓', '1', '1 台'],
      ] },
      { title: ['Bigger hands', '大牌型'], rows: [
        ['All Triplets', '碰碰胡', '4', '4 台'],
        ['Three / Four / Five Concealed Triplets', '三/四/五暗刻', '2 / 5 / 8', '2 / 5 / 8 台'],
        ['Mixed One Suit', '混一色', '4', '4 台'], ['Pure One Suit', '清一色', '8', '8 台'],
        ['Small Three Dragons', '小三元', '4', '4 台'], ['Big Three Dragons', '大三元', '8', '8 台'],
        ['Small Four Winds', '小四喜', '8', '8 台'], ['Big Four Winds', '大四喜', '16', '16 台'],
        ['All Honors', '字一色', '16', '16 台'], ['Heavenly / Earthly Hand', '天胡/地胡', '16', '16 台'],
        ['Eight Flowers', '八仙過海', '8', '8 台'],
      ] },
      { title: ['Rounds and the dealer', '局數與莊家'], text: [
        ['Everyone starts with 1000 points. The first dealer sits East. If the dealer wins or the hand is drawn, the dealer keeps the seat (連莊) and the streak grows; if another player wins, the deal passes to the next seat.', '每人起始 1000 點。第一位莊家坐東。莊家胡牌或流局時繼續做莊（連莊），連莊數增加；其他人胡牌則換下家當莊。'],
        ['"East round" is one wind (four deals); "Full game" plays all four winds. The round wind (圈風) advances after every four deals and scores 1 tai for a matching triplet.', '「東風戰」打一個圈風（四個莊）；「全場」打完四個圈風。每四個莊換一次圈風，對應的刻子 1 台。'],
      ] },
      { title: ['Flowers', '花牌'], text: [
        ['Flowers are revealed as soon as you draw them and replaced from the end of the wall. Your seat flowers are 梅 春 (East), 蘭 夏 (South), 菊 秋 (West), 竹 冬 (North): each matching flower is 1 tai. Four plants or four seasons is a flower set (花槓, 2 tai). All eight flowers wins on the spot (八仙過海, 8 tai).', '花牌一摸到就亮出，並從牌牆尾補牌。正花：東家梅、春，南家蘭、夏，西家菊、秋，北家竹、冬，每張 1 台。集齊四季或四君子為花槓（2 台）。集齊八張花牌直接胡牌（八仙過海，8 台）。'],
      ] },
      { title: ['Payment examples', '計分範例'], rows: [
        ['Win by discard, 3 tai', '放槍胡 3 台', '30 + 3 × 10 = 60 — only the discarder pays', '30 + 3 × 10 = 60，只由放槍者支付'],
        ['Self-draw, 5 tai', '自摸 5 台', '30 + 5 × 10 = 80 from each opponent (240 total)', '30 + 5 × 10 = 80，三家各付（共 240）'],
        ['Dealer wins, streak 2', '莊家連 2 胡牌', 'dealer +1, streak +4: 5 extra tai on top of the hand', '莊家 +1 台、連莊 +4 台，共多 5 台'],
        ['Double win', '一炮雙響', 'both winners are paid in full by the discarder', '兩位胡家都由放槍者全額支付'],
      ] },
      { title: ['Draws', '流局'], text: [
        ['When the wall is down to the last 16 tiles the hand is drawn. Nobody pays. The dealer keeps the seat and the streak counter still goes up.', '牌牆剩最後 16 張時流局，不輸贏。莊家連莊，連莊數仍然增加。'],
      ] },
      { title: ['Not included', '未收錄'], text: [
        ['Rare local bonuses that differ between tables (for example 半求 or 地聽/天聽) are not scored. Everything listed in the tables above is.', '各地不同的少見牌型（例如半求、地聽／天聽）沒有計分。上面表格列出的全部都有計。'],
      ] },
    ],
  },
  hk: {
    intro: [
      ['13 tiles from a 144-tile set with 8 flowers (flowers are set aside and replaced). Minimum 3 fan to win (adjustable in the options).', '每人 13 張，共 144 張牌含 8 張花牌（摸到花牌補牌）。預設最低 3 番起胡（可在選項調整）。'],
      ['Fan → points: 3 fan = 8, 4 = 16, 5 = 24, 6 = 32, 7 = 48, 8 = 64, 9 = 96, 10+ = 128 (limit). Self-draw: each opponent pays the value. Discard win: the discarder pays double.', '番數換算：3 番 = 8，4 = 16，5 = 24，6 = 32，7 = 48，8 = 64，9 = 96，10 番以上 = 128（滿番）。自摸三家各付；放槍者付雙倍。'],
      ['Collecting all 8 flowers wins immediately (8 fan).', '集齊 8 張花牌直接胡（8 番）。'],
    ],
    sections: [
      { title: ['Fan', '番數'], rows: [
        ['Common Hand', '平胡', '1 — all sequences, non-honor pair', '1 番 — 全順子，將牌非字牌'],
        ['Self-drawn', '自摸', '1', '1 番'],
        ['Concealed Hand', '門前清', '1 (ron) / 3 with self-draw (不求人)', '1 番（放槍）／自摸為不求人 3 番'],
        ['Dragon / Seat Wind / Round Wind', '三元/門風/圈風', '1 each triplet', '各 1 番（刻子）'],
        ['Seat Flower', '正花', '1 each', '每張 1 番'], ['No Flowers', '無花', '1', '1 番'],
        ['Complete Flower Set', '一台花', '2', '2 番'],
        ['Last tile / last discard', '海底/河底', '1', '1 番'], ['Win on Kong / Robbing Kong', '槓上開花/搶槓', '1', '1 番'],
      ] },
      { title: ['Bigger hands', '大牌型'], rows: [
        ['All Triplets', '對對胡', '3', '3 番'], ['Mixed One Suit', '混一色', '3', '3 番'], ['Pure One Suit', '清一色', '7', '7 番'],
        ['Small Three Dragons', '小三元', '5', '5 番'], ['Big Three Dragons', '大三元', '8', '8 番'],
        ['Small Four Winds', '小四喜', '10', '10 番'], ['Mixed Terminals', '混幺九', '7', '7 番'],
        ['All Honors / All Terminals', '字一色/清幺九', '10', '10 番'], ['Four Concealed Triplets', '四暗刻', '8', '8 番'],
        ['Big Four Winds / Four Kongs / Thirteen Orphans', '大四喜/十八羅漢/十三幺', '13 (limit)', '13 番（滿番）'],
        ['Heavenly / Earthly Hand', '天胡/地胡', '13', '13 番'],
      ] },
      { title: ['Rounds and the dealer', '局數與莊家'], text: [
        ['Everyone starts with 1000 points. The dealer keeps the seat after winning or a draw; otherwise the deal passes on. "East only" is four deals, "East + South" is eight.', '每人起始 1000 點。莊家胡牌或流局時連莊，否則輪到下家。「東風戰」共四個莊，「東南戰」共八個莊。'],
      ] },
      { title: ['Flowers', '花牌'], text: [
        ['Flowers are set aside on draw and replaced. A flower matching your seat (梅 春 East, 蘭 夏 South, 菊 秋 West, 竹 冬 North) is 1 fan; having no flowers at all is 1 fan; a full set of four plants or seasons is 2 fan.', '花牌一摸到就放一旁並補牌。與座位相同的花（東家梅、春，南家蘭、夏，西家菊、秋，北家竹、冬）1 番；完全沒有花 1 番；集齊四季或四君子 2 番。'],
      ] },
      { title: ['Payment examples', '計分範例'], rows: [
        ['5 fan, self-draw', '5 番自摸', '24 from each opponent (72 total)', '三家各付 24（共 72）'],
        ['5 fan, discard win', '5 番放槍', 'the discarder pays double: 48', '放槍者付雙倍：48'],
        ['Fewer than the minimum', '未達最低番數', 'the hand cannot win — the Win button never appears', '不能胡牌，「胡」按鈕不會出現'],
      ] },
      { title: ['Draws', '流局'], text: [
        ['When the dead wall is reached the hand is drawn: nobody pays and the dealer keeps the seat.', '摸到牌牆最後的死牌區時流局：不輸贏，莊家連莊。'],
      ] },
      { title: ['Not included', '未收錄'], text: [
        ['Seven pairs, nine gates and other optional patterns differ between Hong Kong tables, so they are not scored. Thirteen orphans is.', '七對子、九蓮寶燈等各地不同的選用牌型沒有計分。十三幺有計。'],
      ] },
    ],
  },
  sichuan: { intro: [], sections: [] },
  mcr: {
    intro: [
      ['Chinese Official (Guobiao / MCR) is the international tournament standard. 13 tiles, 144 tiles with 8 flowers, and a hand needs at least 8 fan (flowers do not count toward the 8). Seats rotate after every hand and there is no dealer bonus or streak.', '國標麻將（國際比賽標準）。每人 13 張，144 張含 8 張花牌；胡牌至少要 8 番（花牌不計入這 8 番）。每一局結束後座位輪轉，沒有莊家加成或連莊。'],
      ['Payment: the winner scores 8 + fan. Self-draw: every opponent pays 8 + fan. Win by discard: the discarder pays 8 + fan and the other two pay 8 each. Everyone starts at 0 and can go negative.', '計分：胡牌者得 8 + 番數。自摸：三家各付 8 + 番數。放槍：放槍者付 8 + 番數，另外兩家各付 8。起始 0 點，可以是負數。'],
      ['Overlapping patterns follow the official "does not count" rules — for example Full Flush already covers No Honors and One Voided Suit — and only the highest-scoring reading of your hand is used. A hand with no other pattern at all is a Chicken Hand worth 8.', '重疊的番種依官方「不計」規則處理，例如清一色已含無字、缺一門；只採用得分最高的牌型解讀。完全沒有其他番種的牌為無番和，算 8 番。'],
    ],
    sections: [
      { title: ['88 fan', '88 番'], rows: [
        ['Big Four Winds / Big Three Dragons', '大四喜／大三元', 'pungs of all four winds / all three dragons', '四風刻／三元牌刻子'],
        ['All Green / Nine Gates', '綠一色／九蓮寶燈', 'only 2 3 4 6 8 bamboo and green dragon / 1112345678999 in one suit plus any tile', '只用二三四六八索與發／同花色 1112345678999 再加任一張'],
        ['Four Kongs / Seven Shifted Pairs', '四槓／連七對', 'four kongs / seven consecutive pairs in one suit', '四組槓／同花色七個連續對子'],
        ['Thirteen Orphans', '十三幺', 'one of each terminal and honor plus a pair of any of them', '十三種幺九字牌各一張再加其中一張'],
      ] },
      { title: ['64 – 24 fan', '64 – 24 番'], rows: [
        ['64 · All Terminals, Little Four Winds, Little Three Dragons, All Honors, Four Concealed Pungs, Pure Terminal Chows', '64 · 清幺九、小四喜、小三元、字一色、四暗刻、一色雙龍會', '', ''],
        ['48 · Quadruple Chow, Four Pure Shifted Pungs', '48 · 一色四同順、一色四節高', '', ''],
        ['32 · Four Pure Shifted Chows, Three Kongs, All Terminals and Honors', '32 · 一色四步高、三槓、混幺九', '', ''],
        ['24 · Seven Pairs, Full Flush, Pure Triple Chow, Pure Shifted Pungs, All Even Pungs, Upper / Middle / Lower Tiles', '24 · 七對、清一色、一色三同順、一色三節高、全雙刻、全大／全中／全小', '', ''],
      ] },
      { title: ['16 – 8 fan', '16 – 8 番'], rows: [
        ['16 · Pure Straight, Three-Suited Terminal Chows, Pure Shifted Chows, All Fives, Triple Pung, Three Concealed Pungs', '16 · 清龍、三色雙龍會、一色三步高、全帶五、三同刻、三暗刻', '', ''],
        ['12 · Big Three Winds, Upper Four, Lower Four', '12 · 三風刻、大於五、小於五', '', ''],
        ['8 · Mixed Straight, Reversible Tiles, Mixed Triple Chow, Mixed Shifted Pungs, Chicken Hand', '8 · 花龍、推不倒、三色三同順、三色三節高、無番和', '', ''],
        ['8 · Last Tile Draw (self-drawn last wall tile), Last Tile Claim (win on the last discard), Out with Replacement Tile (after a kong), Robbing the Kong', '8 · 妙手回春（自摸最後一張）、海底撈月（最後一張放槍）、槓上開花、搶槓和', '', ''],
      ] },
      { title: ['6 – 1 fan', '6 – 1 番'], rows: [
        ['6 · All Pungs, Half Flush, Mixed Shifted Chows, All Types, Melded Hand, Two Concealed Kongs, Two Dragon Pungs', '6 · 碰碰和、混一色、三色三步高、五門齊、全求人、雙暗槓、雙箭刻', '', ''],
        ['5 · Concealed and Melded Kong', '5 · 明暗槓', '', ''],
        ['4 · Outside Hand, Fully Concealed Hand, Two Melded Kongs', '4 · 全帶幺、不求人、雙明槓', '', ''],
        ['2 · Dragon Pung, Prevalent Wind, Seat Wind, Concealed Hand, All Chows, Tile Hog, Double Pung, Two Concealed Pungs, Concealed Kong, All Simples', '2 · 箭刻、圈風刻、門風刻、門前清、平和、四歸一、雙同刻、雙暗刻、暗槓、斷幺', '', ''],
        ['1 · Pure Double Chow, Mixed Double Chow, Short Straight, Two Terminal Chows, Pung of Terminals or Honors, Melded Kong, One Voided Suit, No Honors, Edge / Closed / Single Wait, Self-Drawn', '1 · 一般高、喜相逢、連六、老少副、幺九刻、明槓、缺一門、無字、邊張、嵌張、單釘、自摸', '', ''],
        ['Flowers', '花牌', 'each flower is 1 fan, added after the 8-fan minimum is met', '每張花牌 1 番，在達到 8 番後才加上'],
      ] },
      { title: ['Rounds and draws', '局數與流局'], text: [
        ['"East only" is four hands and "East + South" is eight. The seats rotate every hand whether or not anyone wins. When the wall is down to the last 14 tiles the hand is drawn and nobody pays.', '「東風戰」共四局，「東南戰」共八局。不論是否有人胡牌，每局後座位都輪轉。牌牆剩最後 14 張時流局，不輸贏。'],
      ] },
      { title: ['Not included', '未收錄'], text: [
        ['The knitted hands (全不靠, 七星不靠, 組合龍) and Last Tile (和絕張) are not scored, and the "does not count" relationships are applied in a simplified form. Everything listed above is scored.', '全不靠、七星不靠、組合龍與和絕張沒有計分，不計關係為簡化版。上面列出的番種全部有計。'],
      ] },
    ],
  },
  riichi: {
    intro: [
      ['13 tiles, 136-tile set (no flowers); red fives optional. You need at least one yaku to win — dora alone never counts. 3-player (sanma) removes 2m–8m and sets North tiles aside as bonus dora.', '每人 13 張，共 136 張（無花牌），可選赤牌。胡牌必須至少有一個役，寶牌不算役。三人麻將去除二～八萬，北風可拔出當寶牌。'],
      ['Chi only from the player to your left. Riichi: closed tenpai hand, bet 1000, the hand is then locked. Furiten (a winning tile is in your own discards, or you passed a ron) blocks ron but not tsumo.', '吃只能吃上家的牌。立直：門清聽牌，押 1000 點，之後不能改牌。振聽（自己捨牌中有胡牌，或放過一次榮和）不能榮和但可以自摸。'],
      ['Payment: han + fu → base points. 5 han mangan, 6–7 haneman, 8–10 baiman, 11–12 sanbaiman, 13+ yakuman. Draw: noten players pay 3000 total to tenpai players. Abortive draws: nine terminals, four winds, four riichi, four kans, triple ron.', '計分：翻數與符數換算基本點。5 翻滿貫，6–7 跳滿，8–10 倍滿，11–12 三倍滿，13 翻以上役滿。流局時未聽牌者共付 3000 給聽牌者。途中流局：九種九牌、四風連打、四家立直、四槓散了、三家和。'],
      ['Match end: the game ends after the East (or East + South) round. If nobody has reached 30,000 points (40,000 in 3-player) it extends by one more wind (max). It also ends if someone drops below 0, or if the dealer wins the final hand while in first place with 30,000+ (agari-yame).', '終局：打完東風（或東南）戰後結束；若無人達到 30,000 點（三麻 40,000）則再延長一個風（最多一次）。有人點數低於 0 或最後一局莊家在首位且 30,000 點以上和牌時也會結束（和了止め）。'],
    ],
    sections: [
      { title: ['1 han', '1 翻'], rows: [
        ['Riichi', '立直', 'closed, declare tenpai', '門清聽牌宣告'], ['Ippatsu', '一發', 'win within one round of riichi', '立直後一巡內和牌'],
        ['Menzen Tsumo', '門前清自摸', 'closed self-draw', '門清自摸'], ['Tanyao', '斷幺九', 'all simples', '全是 2～8 的數牌'],
        ['Pinfu', '平和', 'all sequences, two-sided wait, non-yakuhai pair', '全順子、兩面聽、將牌非役牌'], ['Iipeikou', '一盃口', 'two identical sequences, closed', '門清兩組相同順子'],
        ['Yakuhai', '役牌', 'dragon / seat wind / round wind triplet', '三元牌、自風、場風刻子'],
        ['Haitei / Houtei', '海底/河底', 'win on the last tile', '最後一張牌和牌'], ['Rinshan / Chankan', '嶺上/搶槓', 'win on kan draw / robbing a kan', '槓後摸牌和牌／搶槓'],
      ] },
      { title: ['2 han', '2 翻'], rows: [
        ['Double Riichi', '雙立直', 'riichi on the first turn', '第一巡立直'], ['Chiitoitsu', '七對子', 'seven pairs (25 fu)', '七個對子（25 符）'],
        ['Sanshoku Doujun', '三色同順', 'same sequence in 3 suits (open: 1)', '三種花色相同順子（副露 1 翻）'], ['Ittsu', '一氣通貫', '123 456 789 in one suit (open: 1)', '同花色 123 456 789（副露 1 翻）'],
        ['Chanta', '混全帶幺九', 'terminal/honor in every set (open: 1)', '每組都含幺九字牌（副露 1 翻）'], ['Toitoi', '對對和', 'all triplets', '全刻子'],
        ['Sanankou', '三暗刻', 'three concealed triplets', '三組暗刻'], ['Sanshoku Doukou', '三色同刻', 'same triplet in 3 suits', '三種花色相同刻子'],
        ['Sankantsu', '三槓子', 'three kans', '三組槓'], ['Honroutou', '混老頭', 'all terminals & honors', '全是幺九字牌'],
        ['Shousangen', '小三元', 'two dragon triplets + dragon pair', '兩組三元牌刻子 + 三元牌眼'],
      ] },
      { title: ['3+ han', '3 翻以上'], rows: [
        ['Honitsu', '混一色', '3 closed / 2 open', '門清 3 翻／副露 2 翻'], ['Junchan', '純全帶幺九', '3 closed / 2 open', '門清 3 翻／副露 2 翻'],
        ['Ryanpeikou', '二盃口', '3 han, two iipeikou', '3 翻，兩組一盃口'], ['Chinitsu', '清一色', '6 closed / 5 open', '門清 6 翻／副露 5 翻'],
      ] },
      { title: ['Bonus tiles (dora)', '寶牌'], rows: [
        ['Dora', '寶牌', 'the tile after the indicator (1 han each). The panel shows every indicator and the tile it points to', '指示牌的下一張牌，每張 1 翻；桌面中央顯示指示牌與對應寶牌'],
        ['Ura dora', '裏寶牌', 'the tiles under the indicators, counted only when you win after riichi', '指示牌下方的牌，只有立直後和牌才計算'],
        ['Red fives', '赤牌', 'red 5m/5p/5s count as dora (1 han each); shown in red', '紅色的五萬/五筒/五索，每張 1 翻'],
        ['Kan dora', '槓寶牌', 'each kan reveals another indicator', '每次開槓多翻一張指示牌'],
        ['Nuki dora (sanma)', '拔北', 'in 3-player games each set-aside North is 1 han', '三人麻將中每張拔出的北風 1 翻'],
      ] },
      { title: ['Riichi, furiten and calls', '立直、振聽與副露'], rows: [
        ['Riichi', '立直', 'closed hand one tile from winning: pay 1000, declare, then you can only discard the tile you draw (unless a kan keeps the wait)', '門清聽牌時付 1000 點宣告立直，之後只能打摸進的牌（除非暗槓不改變聽牌）'],
        ['Furiten', '振聽', 'you cannot ron if any tile you wait on is in your own discards. Passing a winning discard also blocks ron until your next discard (permanently after riichi). Tsumo is always allowed', '自己捨牌中有你聽的牌就不能榮和；放過一次胡牌，直到下次打牌前都不能榮和（立直後為永久）。自摸不受限制'],
        ['Swap-calling', '食替', 'after calling, you may not discard the same tile (or the other end of the sequence) that you just claimed', '吃碰之後，不能立刻打出同一張牌（或吃牌兩端的同一張）'],
        ['Chi', '吃', 'only from the player on your left', '只能吃上家'],
        ['Closed vs open', '門清與副露', 'riichi, pinfu, iipeikou and several others need a closed hand; some yaku lose 1 han when open', '立直、平和、一盃口等需要門清；部分役副露時少 1 翻'],
      ] },
      { title: ['Scoring', '計分'], rows: [
        ['Fu', '符', 'start at 20; +10 closed ron; +2 tsumo; triplets 2 (simple open) / 4 (terminal open or simple closed) / 8 (terminal closed), ×4 for kans; +2 pair of dragons / seat or round wind; +2 for a single-tile wait; round up to 10. Seven pairs is a flat 25', '底符 20；門清榮和 +10；自摸 +2；刻子：中張明刻 2、么九明刻或中張暗刻 4、么九暗刻 8，槓 ×4；役牌眼 +2；單騎、邊張、嵌張 +2；最後進位到 10。七對子固定 25 符'],
        ['Base points', '基本點', 'fu × 2^(2 + han), capped: 5 han = mangan 2000, 6–7 = haneman 3000, 8–10 = baiman 4000, 11–12 = sanbaiman 6000, 13+ or yakuman = 8000 per yakuman', '符 × 2^(2 + 翻)，上限：5 翻滿貫 2000，6–7 跳滿 3000，8–10 倍滿 4000，11–12 三倍滿 6000，13 翻以上／役滿 8000（每個役滿）'],
        ['Ron', '榮和', 'the discarder pays 4× base (dealer wins: 6×), rounded up to 100', '放槍者付基本點 4 倍（莊家胡 6 倍），進位到 100'],
        ['Tsumo', '自摸', 'non-dealer winner: dealer pays 2×, others 1×. Dealer winner: everyone pays 2×', '閒家自摸：莊家付 2 倍，其他閒家付 1 倍；莊家自摸：三家各付 2 倍'],
        ['Honba', '本場', 'each repeat adds 300 (ron) or 100 per payer (tsumo) to the winner', '每一本場，榮和多 300，自摸每家多 100'],
        ['Riichi sticks', '立直棒', 'the winner of the next hand takes every stick on the table', '下一位胡牌者拿走桌上所有立直棒'],
      ] },
      { title: ['Draws', '流局'], rows: [
        ['Exhaustive draw', '荒牌流局', 'when the live wall is empty, players not in tenpai pay 3000 in total to those who are; dealer stays only if tenpai', '牌牆摸完時，未聽牌者共付 3000 給聽牌者；莊家聽牌才連莊'],
        ['Nine terminals', '九種九牌', 'on your first draw with nine different terminal/honor tiles you may abort the hand', '第一巡手牌有九種幺九字牌可宣告流局'],
        ['Four winds / four riichi / four kans / triple ron', '四風連打／四家立直／四槓散了／三家和', 'the hand is abandoned and the dealer stays', '該局中止，莊家連莊'],
      ] },
      { title: ['Three-player (sanma)', '三人麻將'], rows: [
        ['Tiles', '牌', '2m–8m removed (108 tiles); North tiles are set aside as bonus dora (nuki), each 1 han', '去除二～八萬（共 108 張）；北風拔出當寶牌，每張 1 翻'],
        ['Points', '點數', 'everyone starts with 35,000; target to end the game is 40,000', '起始 35,000 點，結束門檻 40,000 點'],
        ['Chi', '吃', 'not allowed in the three-player game', '三人麻將不能吃'],
      ] },
      { title: ['Yakuman', '役滿'], rows: [
        ['Kokushi Musou', '國士無雙', 'thirteen orphans', '十三幺'], ['Suuankou', '四暗刻', 'four concealed triplets', '四組暗刻'],
        ['Daisangen', '大三元', 'three dragon triplets', '三組三元牌刻子'], ['Shousuushii / Daisuushii', '小四喜/大四喜', 'little / big four winds', '小／大四喜'],
        ['Tsuuiisou', '字一色', 'all honors', '全字牌'], ['Chinroutou', '清老頭', 'all terminals', '全幺九數牌'],
        ['Ryuuiisou', '綠一色', 'all green', '全綠'], ['Chuuren Poutou', '九蓮寶燈', 'nine gates', '九蓮寶燈'],
        ['Suukantsu', '四槓子', 'four kans', '四組槓'], ['Tenhou / Chiihou', '天和/地和', 'win on the first draw', '起手第一張和牌'],
      ] },
    ],
  },
}

export function RulesHelp({ initial, onClose }: { initial: RuleId; onClose: () => void }) {
  const { lang, t } = useLang()
  const [id, setId] = useState<TabId>(initial)
  const L = lang === 'zh' ? 1 : 0
  const d = DATA[id]
  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>{t('rulesRef')}</h2>
          <button className="btn sm alt" onClick={onClose}>{t('close')}</button>
        </div>
        <div className="tabs">
          {(['basics', 'taiwan', 'hk', 'riichi', 'mcr'] as const).map((k) => (
            <button key={k} className={'btn sm ' + (id === k ? 'gold' : 'alt')} onClick={() => setId(k)}>{k === 'basics' ? (L === 1 ? '基本玩法' : 'Basics') : t(k + '.name')}</button>
          ))}
        </div>
        {d.intro.map((p, i) => <p key={i} className="muted">{p[L]}</p>)}
        {d.sections.map((s) => (
          <div key={s.title[0]}>
            <h2>{s.title[L]}</h2>
            {s.text?.map((p, i) => <p key={i} className="muted">{p[L]}</p>)}
            {s.rows && <table className="ref"><tbody>
              {s.rows.map((r, i) => (
                <tr key={i}>
                  <td>{L === 1 ? r[1] : r[0]}{L === 0 && <span className="muted"> {r[1]}</span>}</td>
                  <td>{r[2 + L]}</td>
                </tr>
              ))}
            </tbody></table>}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}
