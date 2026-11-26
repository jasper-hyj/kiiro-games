import { registerStrings } from '../../i18n'

// [English, 繁體中文], then Japanese
registerStrings(
  {
    chinesecheckers: ['Chinese Checkers', '跳棋'],
    chinesecheckersBlurb: ['Race your marbles across the star.', '讓你的棋子跳過星形棋盤。'],
    ccPlayers: ['Players', '人數'],
    ccYou: ['You are {colour}', '你是{colour}'],
    ccSelect: ['Tap a marble, then a highlighted hole.', '點選棋子，再點亮起的空位。'],
    ccBrick: ['red', '紅色'],
    ccOchre: ['yellow', '黃色'],
    ccBlue: ['blue', '藍色'],
    ccPlum: ['purple', '紫色'],
    ccInk: ['black', '黑色'],
    ccIvory: ['white', '白色'],
    ccHome: ['{n}/10 home', '{n}/10 到達'],
    ccHow: ['How to play Chinese Checkers', '跳棋玩法'],
    ccR1: [
      'Each player has ten marbles in one point of the star. Get all ten into the opposite point first.',
      '每位玩家有十顆棋子在星形的一個角，最先把十顆全部移到對面的角者獲勝。',
    ],
    ccR2: ['On your turn move one marble to a neighbouring empty hole.', '輪到你時，把一顆棋子移到相鄰的空位。'],
    ccR3: [
      'Or jump over a neighbouring marble (yours or anyone’s) into the empty hole beyond it, and keep jumping in a chain as far as you like.',
      '或者跳過相鄰的棋子（不論誰的）到後方的空位，並且可以連續跳下去。',
    ],
    ccR4: ['Build ladders of marbles for long chains, and do not leave a marble behind.', '排出「梯子」可以連跳很遠，別讓任何一顆棋子落在後面。'],
  },
  {
    chinesecheckers: 'ダイヤモンドゲーム',
    chinesecheckersBlurb: '星形の盤を駒で駆け抜けます。',
    ccPlayers: '人数',
    ccYou: 'あなたは{colour}です',
    ccSelect: '駒をタップし、光っている穴をタップします。',
    ccBrick: '赤',
    ccOchre: '黄',
    ccBlue: '青',
    ccPlum: '紫',
    ccInk: '黒',
    ccIvory: '白',
    ccHome: '{n}/10 ゴール',
    ccHow: 'ダイヤモンドゲームの遊び方',
    ccR1: '各プレイヤーは星の1つの角に10個の駒を持ちます。最初に10個すべてを反対側の角へ移した人の勝ちです。',
    ccR2: '自分の番には駒を1つ、隣の空いた穴へ動かします。',
    ccR3: 'または隣の駒（誰の駒でも）を飛び越えて、その先の空き穴へ。連続して何度でも飛べます。',
    ccR4: '駒を並べて「はしご」を作ると長く跳べます。置き去りの駒を作らないように。',
  },
)
