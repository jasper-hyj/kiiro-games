import { registerStrings } from '../../i18n'

// [English, 繁體中文], then Japanese
registerStrings(
  {
    checkers: ['Checkers', '西洋跳棋'],
    checkersBlurb: ['Jump the other side’s pieces. Capturing is compulsory.', '跳吃對方的棋子，吃子是強制的。'],
    ckRed: ['Red', '紅'],
    ckIvory: ['Ivory', '白'],
    ckYouAre: ['You play {side}', '你執{side}'],
    ckSelect: ['Tap a piece, then where it goes.', '點選棋子，再點目的地。'],
    ckMust: ['You must capture.', '必須吃子。'],
    ckHow: ['How to play Checkers', '西洋跳棋玩法'],
    ckR1: [
      'Pieces move one step diagonally forward onto an empty dark square. Kings move one step in any diagonal direction.',
      '棋子斜向前進一格到空的深色格；王可往任何斜向走一格。',
    ],
    ckR2: [
      'Capture by jumping over an adjacent enemy piece into the empty square behind it. Capturing is compulsory, and a chain of jumps must be completed.',
      '跳過相鄰的敵子落在後方空格即為吃子。吃子是強制的，連跳必須跳完。',
    ],
    ckR3: ['A piece that reaches the far row becomes a king (and its move ends).', '走到對方底線的棋子成為王（該步結束）。'],
    ckR4: [
      'You win when the other side cannot move. 80 moves without a capture or a forward step is a draw.',
      '對方無棋可走即獲勝。連續 80 步沒有吃子或前進則和局。',
    ],
  },
  {
    checkers: 'チェッカー',
    checkersBlurb: '相手の駒を飛び越えて取ります。取るのは必須です。',
    ckRed: '赤',
    ckIvory: '白',
    ckYouAre: 'あなたは{side}です',
    ckSelect: '駒をタップし、次に行き先をタップします。',
    ckMust: '取らなければなりません。',
    ckHow: 'チェッカーの遊び方',
    ckR1: '駒は斜め前の空いている濃いマスへ1つ進みます。キングは斜め4方向へ1つ進めます。',
    ckR2: '隣の相手の駒を飛び越えて、その後ろの空きマスに着地すると取れます。取るのは必須で、連続して取れるなら最後まで取ります。',
    ckR3: '相手側の端に着いた駒はキングになります（その手は終わりです）。',
    ckR4: '相手が動けなくなったら勝ち。取りも前進もなく80手続くと引き分けです。',
  },
)
