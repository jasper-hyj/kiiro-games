import { registerStrings } from '../../i18n'
registerStrings({
  xiangqi: ['Xiangqi (Chinese chess)', '象棋'], xiangqiBlurb: ['Chinese chess for two: generals, cannons, horses and a river. A computer opponent at three levels, or friends in a room.', '兩人對弈的中國象棋：將帥、炮、馬與楚河漢界。電腦分三種強度，也能與朋友開房對戰。'],
  xqRed: ['Red', '紅方'], xqBlack: ['Black', '黑方'], xqRiver: ['Chu River', '楚河'], xqBorder: ['Han Border', '漢界'],
  xqHow: ['How to play Xiangqi', '象棋玩法'],
  xqR1: ['Red moves first. Tap a piece to see where it can go, then tap the point. Capture by moving onto an enemy piece.', '紅方先走。點選棋子顯示可走位置，再點目的地；走到對方棋子上即吃子。'],
  xqR2: ['General and advisors stay in the palace. Elephants move two points diagonally and never cross the river. Horses move like an L and are blocked by a piece next to them. Chariots slide any distance.', '將帥與士只能在九宮內走。象走田字且不能過河；馬走日字，但會被「蹩馬腿」；車可直走任意格。'],
  xqR3: ['Cannons move like chariots but capture by jumping over exactly one piece. Soldiers step forward and, after crossing the river, sideways too.', '炮走法如車，但吃子時必須隔著剛好一個棋子。兵卒只能前進，過河後可左右移動。'],
  xqR4: ['The two generals may never face each other on an open file. A player who cannot move, by checkmate or stalemate, loses. The same position three times is a draw.', '雙方將帥不可在同一直線上無子相對（王不見王）。無子可動（無論是否被將軍）者敗。同一局面出現三次為和局。'],
}, {
  xiangqi: '象棋（シャンチー）', xiangqiBlurb: '2人で遊ぶ中国将棋。コンピューターは3段階、友達とのルームでも遊べます。',
  xqRed: '赤', xqBlack: '黒', xqRiver: '楚河', xqBorder: '漢界',
  xqHow: '象棋の遊び方',
  xqR1: '先手は赤です。駒をタップすると動ける場所が表示されるので、行き先をタップします。相手の駒の上に動くと取れます。',
  xqR2: '将（帥）と士は九宮の中だけを動きます。象は田の字に動き、川を渡れません。馬は日の字に動き、隣に駒があると動けません（馬の足止め）。車は何マスでも直進できます。',
  xqR3: '砲は車のように動きますが、駒を取るときはちょうど1つの駒を飛び越えます。兵（卒）は前に進み、川を渡ると横にも動けます。',
  xqR4: '両方の将が駒を挟まずに向かい合うことはできません。動かせる手がなくなった側（詰みでもステイルメイトでも）は負けです。同一局面3回は引き分けです。',
})
