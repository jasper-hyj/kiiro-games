import { registerStrings } from '../../i18n'
registerStrings(
  {
    gomoku: ['Gomoku', '五子棋'],
    gomokuBlurb: ['Two players, first to line up five stones wins. Bots take any empty seat.', '兩人對弈，先連成五子者勝。空位由電腦補上。'],
    gmSize: ['Board', '棋盤'],
    gmBlack: ['Black', '黑棋'],
    gmWhite: ['White', '白棋'],
    gmYouAre: ['You play {side}', '你執{side}'],
    gmPlace: ['Place stone', '落子'],
    gmTapAgain: ['Tap the point again, or press Place stone.', '再點一次該位置，或按「落子」。'],
    gmHow: ['How to play Gomoku', '五子棋玩法'],
    gmR1: ['Players take turns placing one stone on an empty point of the board. Black moves first.', '雙方輪流在棋盤的空點上放一顆棋，黑棋先下。'],
    gmR2: [
      'The first player to make an unbroken line of five or more stones (across, down or diagonally) wins.',
      '先在橫、直或斜向連成五顆（或以上）不間斷棋子的一方獲勝。',
    ],
    gmR3: [
      'If the board fills up with no line, the game is a draw. Stones are never moved or removed.',
      '棋盤下滿仍無人連線則和局。棋子下了就不能移動或拿走。',
    ],
    gmR4: [
      'Block an open three before it becomes an open four: a line open at both ends cannot be stopped.',
      '看到「活三」要及時封堵，兩端都空的活四是擋不住的。',
    ],
  },
  {
    gomoku: '五目並べ',
    gomokuBlurb: '2人対戦。先に5つ並べた方の勝ち。空席はコンピューターが担当します。',
    gmSize: '盤の大きさ',
    gmBlack: '黒',
    gmWhite: '白',
    gmYouAre: 'あなたは{side}です',
    gmPlace: '打つ',
    gmTapAgain: '同じ交点をもう一度タップするか「打つ」を押してください。',
    gmHow: '五目並べの遊び方',
    gmR1: '交互に空いている交点に石を1つ置きます。先手は黒です。',
    gmR2: '縦・横・斜めのいずれかに5つ以上の石を連続して並べた方の勝ちです。',
    gmR3: '盤が埋まっても並ばなければ引き分け。置いた石は動かせません。',
    gmR4: '両端が空いた三（活三）は四になる前に止めましょう。両端が空いた四は止められません。',
  },
)
