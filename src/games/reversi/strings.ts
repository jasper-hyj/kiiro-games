import { registerStrings } from '../../i18n'

// [English, 繁體中文], then Japanese
registerStrings(
  {
    reversi: ['Reversi', '黑白棋'],
    reversiBlurb: ['Bracket the other colour to flip it. Most discs wins.', '夾住對方的棋子就能翻面，子多者勝。'],
    rvBlack: ['Black', '黑'],
    rvWhite: ['White', '白'],
    rvYouAre: ['You play {side}', '你執{side}'],
    rvPassed: ['No move: turn skipped', '無處可下：跳過回合'],
    rvHow: ['How to play Reversi', '黑白棋玩法'],
    rvR1: ['Take turns placing a disc so that it brackets one or more of the other colour in a straight line.', '輪流落子，必須在直線上夾住對方至少一顆棋子。'],
    rvR2: ['Every bracketed disc flips to your colour. If you have no move, your turn is skipped.', '被夾住的棋子全部翻成你的顏色；無處可下時跳過回合。'],
    rvR3: [
      'When neither side can move, the player with more discs wins. Corners cannot be flipped.',
      '雙方都無處可下時，棋子較多者獲勝。四個角落的棋子不會被翻。',
    ],
    rvR4: ['Dots show where you can play.', '圓點標示可下的位置。'],
  },
  {
    reversi: 'リバーシ',
    reversiBlurb: '相手の石を挟んでひっくり返します。多い方の勝ち。',
    rvBlack: '黒',
    rvWhite: '白',
    rvYouAre: 'あなたは{side}です',
    rvPassed: '打てる場所がなくパスしました',
    rvHow: 'リバーシの遊び方',
    rvR1: '交互に石を置きます。縦・横・斜めに相手の石を挟める場所にだけ置けます。',
    rvR2: '挟んだ石はすべて自分の色になります。打てる場所がなければパスです。',
    rvR3: '双方打てなくなったら終了。石が多い方の勝ちです。四隅の石はひっくり返せません。',
    rvR4: '丸い印は置ける場所です。',
  },
)
