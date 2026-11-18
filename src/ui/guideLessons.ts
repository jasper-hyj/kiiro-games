/** Lessons for the "How to play" guide. Texts are [English, 中文, 日本語]; tile pictures use the same notation as the rules reference
 *  (123m 456p 789s 1234z: m characters, p circles, s bamboo, z honors; 1-4 winds E S W N, 5 white 6 green 7 red). */
export type Tri = [string, string, string]
export interface Pic { tiles: string; caption?: Tri; hot?: string }
export interface Lesson { title: Tri; text: Tri[]; pics?: Pic[]; tip?: Tri }

export const LESSONS: Lesson[] = [
  {
    title: ['1 · The tiles', '1 · 認識牌', '1 · 牌の種類'],
    text: [
      ['Mahjong uses tiles in three number suits, plus honor tiles. Every tile exists four times.', '麻將有三種數字花色，再加上字牌，每一種牌都有 4 張。', '麻雀の牌は3種類の数牌と字牌です。どの牌も4枚ずつあります。'],
      ['Number suits run from 1 to 9: characters (萬), circles (筒) and bamboo (索). Honors are the four winds and three dragons — they have no numbers, so they can only form triplets and pairs.', '數牌分萬子、筒子、索子，各從 1 到 9。字牌是東南西北四風與中發白三元，沒有數字，只能組成刻子或對子。', '数牌は萬子・筒子・索子で、それぞれ1〜9。字牌は東南西北の風牌と白發中の三元牌で、数字がないので刻子か雀頭にしかなりません。'],
    ],
    pics: [
      { tiles: '123456789m', caption: ['Characters 萬', '萬子', '萬子'] },
      { tiles: '123456789p', caption: ['Circles 筒', '筒子', '筒子'] },
      { tiles: '123456789s', caption: ['Bamboo 索', '索子', '索子'] },
      { tiles: '1234z 567z', caption: ['Winds (East South West North) and dragons (white, green, red)', '風牌（東南西北）與三元牌（白、發、中）', '風牌（東南西北）と三元牌（白・發・中）'] },
    ],
    tip: ['Taiwanese and Hong Kong mahjong also use 8 flower tiles. They are never in your hand — you set them aside and draw a replacement.', '台灣與香港麻將還有 8 張花牌。花牌不放進手牌，摸到後亮出並補摸一張。', '台湾・香港麻雀には花牌が8枚あります。手牌には入れず、引いたら公開して代わりの牌を引きます。'],
  },
  {
    title: ['2 · The goal: sets and a pair', '2 · 目標：面子加一對眼', '2 · 目的：面子と雀頭'],
    text: [
      ['You win by completing a hand of four sets and one pair (five sets and a pair in Taiwanese mahjong).', '目標是湊成 4 組面子加 1 對眼（台灣麻將是 5 組面子加 1 對眼）。', '4つの面子と1つの雀頭（台湾麻雀は5面子＋雀頭）を完成させるとアガリです。'],
      ['A set is either a sequence — three consecutive numbers of one suit — or a triplet — three identical tiles. A pair is two identical tiles. Honors can never form sequences.', '面子分兩種：順子（同花色三張連號）與刻子（三張相同）。眼是兩張相同的牌。字牌不能組成順子。', '面子は順子（同じ種類の連続する3枚）か刻子（同じ牌3枚）。雀頭は同じ牌2枚です。字牌は順子になりません。'],
    ],
    pics: [
      { tiles: '345p', caption: ['Sequence', '順子', '順子'] },
      { tiles: '777s', caption: ['Triplet', '刻子', '刻子'] },
      { tiles: '55m', caption: ['Pair', '對子（眼）', '対子（雀頭）'] },
      { tiles: '234m 567p 789s 666z 11z', caption: ['A complete winning hand: 4 sets + 1 pair', '一手完整的胡牌牌型：4 組面子 + 1 對眼', '完成したアガリ形：4面子＋雀頭'] },
    ],
  },
  {
    title: ['3 · A turn: draw and discard', '3 · 回合：摸牌與打牌', '3 · 1巡：引いて捨てる'],
    text: [
      ['Players take turns in a circle. On your turn you draw one tile from the wall, then discard one tile face up into your river (the pile in front of you in the middle).', '玩家依序輪流。輪到你時，從牌牆摸一張牌，再打出一張到面前的牌河（桌子中間你面前的那一堆）。', '順番に回ります。自分の番に牌山から1枚引き、1枚を河（卓の中央、自分の前）に捨てます。'],
      ['Your hand always goes back to its normal size (13 tiles, or 16 in Taiwanese mahjong). Keep tiles that fit together and throw away the ones that do not.', '你的手牌張數會一直回到固定數量（13 張，台灣麻將 16 張）。把能湊在一起的牌留著，打掉用不到的。', '手牌は常に決まった枚数（13枚、台湾麻雀は16枚）に戻ります。つながる牌を残し、使わない牌を捨てます。'],
    ],
    pics: [{ tiles: '23m 45p 678s 99p 4z', caption: ['Close to a set: 2-3 m and 4-5 p wait for neighbours; 99 p is a pair; the lone East wind is the one to throw', '二三萬、四五筒有機會湊成順子；九筒是對子；孤立的東風最該打掉', '二三萬・四五筒はつながりやすく、九筒は対子。孤立した東を捨てます'] }],
    tip: ['In this game: tap a tile once to select it and again to discard, or drag it up onto the table. The tile you just drew sits apart on the right.', '在這個遊戲：點一下選牌、再點一下打出，或把牌往上拖到桌面。剛摸到的牌會獨立放在右側。', 'このゲームでは、牌を1回タップで選択、もう一度で捨てる（または上にドラッグ）。引いた牌は右側に離れて置かれます。'],
  },
  {
    title: ['4 · Calling: chi, pon and kan', '4 · 吃、碰、槓', '4 · 鳴き：チー・ポン・カン'],
    text: [
      ['When someone discards a tile you can use, you may claim it instead of waiting. A claimed set is shown face up beside your hand and the tile is turned sideways.', '別人打出你用得到的牌時，你可以搶來用。搶到的面子會攤開放在手牌旁，被搶的牌橫放。', '誰かが捨てた牌が使えるとき、鳴いて取れます。鳴いた面子は手牌の横に公開され、取った牌は横向きになります。'],
      ['Chi: complete a sequence, only from the player on your left. Pon: complete a triplet from anyone. Kan: four identical tiles; you draw an extra tile afterwards.', '吃：湊成順子，只能吃左手邊玩家的牌。碰：從任何人湊成刻子。槓：四張相同的牌，之後多摸一張補牌。', 'チー：順子を作る（左隣の人の牌だけ）。ポン：誰の牌でも刻子にできる。カン：同じ牌4枚、後で追加の牌を1枚引きます。'],
      ['After a claim you do not draw — you discard immediately.', '吃碰之後不摸牌，直接打出一張。', '鳴いた後は牌を引かず、すぐに1枚捨てます。'],
    ],
    pics: [
      { tiles: '45m', caption: ['You hold 4-5 m, the player on your left throws 3 m: chi → 3-4-5 m', '你有四五萬，左邊玩家打出三萬：吃 → 三四五萬', '手に四五萬、上家が三萬を捨てた：チー → 三四五萬'], hot: '3m' },
      { tiles: '77s', caption: ['You hold 7 7 bamboo, anyone throws 7 bamboo: pon → triplet', '你有兩張七索，任何人打出七索：碰 → 刻子', '七索が2枚、誰かが七索を捨てた：ポン → 刻子'], hot: '7s' },
    ],
    tip: ['Calling opens your hand (others can see those sets) and, in some rulesets, lowers its value or even removes the right to win. Beginners often pass — the coach will tell you when a call is worthwhile.', '鳴牌會讓手牌被看光，在某些規則下還會降低價值，甚至無法胡牌。新手常選擇「過」，教練會提醒你什麼時候值得吃碰。', '鳴くと手牌の一部が見えてしまい、ルールによっては価値が下がったりアガれなくなったりします。初心者はスルーが多め。コーチが鳴く価値を教えてくれます。'],
  },
  {
    title: ['5 · Who gets the tile?', '5 · 誰能拿這張牌？', '5 · 誰がその牌を取れる？'],
    text: [
      ['After every discard everyone gets a short moment to claim it. If several players want it, the priority is: win (ron) first, then pon or kan, then chi.', '每次有人打牌，其他人都有一小段時間可以決定要不要搶。若多人想要：胡牌最優先，其次是碰或槓，最後才是吃。', '捨て牌のたびに、全員が鳴くかどうかを決める時間があります。複数人が欲しい場合の優先順位は ロン ＞ ポン／カン ＞ チー。'],
      ['In this game the buttons appear above your hand only when you actually can act. Pass skips. If you do nothing before the timer ends, the game passes for you.', '這個遊戲只有在你真的可以動作時，按鈕才會出現在手牌上方。按「過」可以放棄；時間到沒有操作會自動過。', 'このゲームでは、実際に操作できるときだけ手牌の上にボタンが出ます。スルーで見送り。時間切れなら自動でスルーになります。'],
    ],
  },
  {
    title: ['6 · Winning: self-draw and ron', '6 · 胡牌：自摸與放槍', '6 · アガリ：ツモとロン'],
    text: [
      ['You win when your hand is complete. If you draw the last tile yourself it is a self-draw (tsumo, 自摸). If you take another player\'s discard it is a win by discard (ron, 放槍／榮和).', '手牌完成時胡牌。自己摸到最後一張是自摸；胡別人打出的牌是放槍（榮和）。', '手が完成したらアガリ。自分で引いたら ツモ、他家の捨て牌でアガるなら ロン です。'],
      ['A hand with no calls is concealed (門清); with calls it is open. Many scoring patterns only count when concealed.', '沒有吃碰的手牌是門清，有吃碰就是鳴牌（副露）。很多牌型只有門清時才計算。', '鳴いていない手は門前、鳴いた手は副露。役によっては門前のときだけ成立します。'],
    ],
    pics: [{ tiles: '234m 567p 789s 23p 55s', hot: '4p', caption: ['Waiting for 1 or 4 circles: either one wins', '等一筒或四筒，任何一張都能胡', '一筒か四筒を待っている：どちらでもアガリ'] }],
    tip: ['In this game the Win button shows only when you really can win; turn on "Auto win" in the menu if you never want to miss one.', '遊戲中只有真的能胡時才會出現「胡」按鈕；想永遠不漏胡可以在選單開啟「自動胡牌」。', 'アガれるときだけ「アガリ」ボタンが出ます。見逃したくない人はメニューの「自動アガリ」をオンに。'],
  },
  {
    title: ['7 · Waiting (tenpai) and wait shapes', '7 · 聽牌與聽牌型', '7 · テンパイと待ちの形'],
    text: [
      ['When you are one tile away from a complete hand you are "ready" (tenpai, 聽牌). The tiles that finish your hand are your waits. More waits means a better chance.', '差一張就完成牌型叫「聽牌」。能讓你胡牌的牌就是你的聽牌。聽的牌越多，胡牌機會越大。', 'あと1枚で完成する状態が「テンパイ」。アガれる牌が待ち牌で、多いほどアガりやすくなります。'],
      ['Common shapes: two-sided (two waits), closed gap (one), edge (one), or waiting on a pair (one). Turn on Hints in the menu to see your waits and how many are left.', '常見聽法：兩面（兩種牌）、嵌張（一種）、邊張（一種）、單騎等眼（一種）。在選單開啟「提示」可以看到你聽哪些牌、還剩幾張。', '主な待ち：両面（2種）、嵌張（1種）、辺張（1種）、単騎（1種）。メニューで「ヒント」をオンにすると待ち牌と残り枚数が分かります。'],
    ],
    pics: [
      { tiles: '45m', caption: ['Two-sided: waits for 3 m and 6 m', '兩面：等三萬、六萬', '両面：三萬・六萬待ち'] },
      { tiles: '46m', caption: ['Closed gap: waits for 5 m only', '嵌張：只等五萬', '嵌張：五萬だけ待ち'] },
      { tiles: '12m', caption: ['Edge: waits for 3 m only', '邊張：只等三萬', '辺張：三萬だけ待ち'] },
      { tiles: '7z', caption: ['Single (pair) wait: waits for another red dragon', '單騎：等第二張紅中', '単騎：もう1枚の中を待つ'] },
    ],
  },
  {
    title: ['8 · How hands are scored', '8 · 怎麼算分', '8 · 点数の数え方'],
    text: [
      ['Every ruleset values hands differently. The basic idea is the same: special patterns give points, and rarer patterns give more.', '每種規則的計分方式不同，但基本概念相同：特殊牌型會加分，越稀有加越多。', 'ルールごとに数え方は違いますが、考え方は同じ：特別な形に点が付き、珍しいほど高くなります。'],
      ['Riichi: you need at least one yaku (pattern) to win; value is han and fu. Hong Kong and Chinese Official: add up fan (a minimum is required). Taiwanese: add up tai; payment = 30 + 10 per tai. Sichuan: any complete hand wins, fan double the points.', '日本麻將：至少要有一個役才能胡，價值由翻與符決定。香港與國標：把番數加起來（有起糊番數）。台灣：把台數加起來，付款 = 30 + 每台 10。四川：任何完整牌型都能胡，番數讓分數倍增。', '日本麻雀：役が1つ以上必要で、飜と符で価値が決まります。香港・国標：点数（番）を合計し、最低点があります。台湾：台数を足して、支払い＝30＋1台10点。四川：完成すれば何でもアガれ、翻で倍々になります。'],
      ['The Rules reference lists every pattern, with real example hands you can compare with your own.', '「規則說明」列出所有牌型，並附上可以和自己手牌對照的實際範例。', '「ルール説明」に全ての役と、自分の手と見比べられる実際の例があります。'],
    ],
  },
  {
    title: ['9 · Playing it safe', '9 · 防守與常見錯誤', '9 · 守りとよくある間違い'],
    text: [
      ['Read the rivers: a tile that has already been discarded several times is unlikely to complete someone else\'s hand. Tiles that nobody has thrown are more dangerous when others look ready.', '看牌河：已經被打出很多次的牌，比較不可能讓別人胡。別人看起來快胡時，沒人打過的牌比較危險。', '河を読みましょう。すでに何枚も捨てられた牌は他家のアガリ牌になりにくく、誰も捨てていない牌は危険です。'],
      ['Furiten (Riichi): you cannot win by someone\'s discard if a tile you are waiting for is in your own river — but you can still self-draw. Sichuan: you cannot win while you hold a tile of the suit you gave up.', '振聽（日本麻將）：如果你等的牌在自己的牌河裡，就不能胡別人打出的牌，但仍可以自摸。四川：手上還有定缺的那一門牌時不能胡。', 'フリテン（日本麻雀）：待ち牌が自分の河にあると、他家の捨て牌ではアガれません（ツモはOK）。四川：捨てる色の牌を持っている間はアガれません。'],
      ['If you are unsure why you cannot win, the game explains it in a small note above your hand.', '不確定為什麼不能胡時，遊戲會在手牌上方用小提示說明原因。', 'なぜアガれないか分からないときは、手牌の上の小さなメモが理由を教えてくれます。'],
    ],
  },
  {
    title: ['10 · Your first game', '10 · 開始第一局', '10 · 最初の対局'],
    text: [
      ['Start with a practice game against easy bots: the coach suggests every move and tips explain each moment. When you feel comfortable, turn the coach off in the menu and raise the bots\' strength.', '先和簡單的電腦玩一場練習局：教練會建議每個動作，提示會說明每個時刻。熟悉之後，到選單關閉教練，並提高電腦強度。', 'まずは弱いCPUと練習対局を。コーチが毎手をおすすめし、ヒントが状況を説明します。慣れたらメニューでコーチを切り、CPUを強くしましょう。'],
      ['Useful menu options: sort hand automatically, auto win, auto discard, skip calls, hints. Everything can be changed during the game.', '實用的選單選項：自動理牌、自動胡牌、自動打牌、不吃碰、提示。遊戲中隨時都能更改。', '便利なメニュー：自動理牌・自動アガリ・自動打牌・鳴きスキップ・ヒント。対局中いつでも変更できます。'],
    ],
    tip: ['Playing online: share the room code with friends. Empty seats are always filled by Bot 1, Bot 2 and Bot 3.', '線上遊玩：把房間代碼分享給朋友。空位一律由電腦 1、2、3 補上。', 'オンライン対戦：ルームコードを友達に共有。空席はBot 1・2・3が自動で埋めます。'],
  },
]
