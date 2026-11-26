import { registerStrings } from '../../i18n'
/** Text shared by every game on the turn-based frame (lobby, turn line, result), then one block per game. */
registerStrings(
  {
    plSeats: ['Players', '玩家'],
    plBot: ['Computer (fills empty seats)', '電腦（補上空位）'],
    plYou: ['You', '你'],
    plStart: ['Start game', '開始遊戲'],
    plWaitHost: ['Waiting for the host to start…', '等待房主開始…'],
    plYourTurn: ['Your turn', '輪到你'],
    plWaitTurn: ['Waiting for {name}…', '等待 {name}…'],
    plWins: ['{name} wins', '{name} 獲勝'],
    plWinsMany: ['{names} win', '{names} 獲勝'],
    plUndo: ['Undo', '悔棋'],
    plDraw: ['A draw', '平手'],
    plAgain: ['Play again', '再來一局'],
    plScore: ['Score', '得分'],
    plWatchers: ['{n} watching', '{n} 人觀戰'],
    plSettings: ['This game', '本局設定'],
    not_playing: ['The game is not running.', '遊戲尚未進行。'],
    bad_move: ['That move is not allowed.', '這步不能走。'],
    bad_game: ['Unknown game.', '未知的遊戲。'],
    plPractice: ['Practice', '練習'],
  },
  {
    plSeats: 'プレイヤー',
    plBot: 'コンピューター（空席を埋めます）',
    plYou: 'あなた',
    plStart: 'ゲーム開始',
    plWaitHost: 'ホストの開始を待っています…',
    plYourTurn: 'あなたの番です',
    plWaitTurn: '{name} を待っています…',
    plWins: '{name} の勝ち',
    plWinsMany: '{names} の勝ち',
    plUndo: '一手戻す',
    plDraw: '引き分け',
    plAgain: 'もう一局',
    plScore: '得点',
    plWatchers: '観戦 {n} 人',
    plSettings: 'このゲーム',
    not_playing: 'ゲームは進行中ではありません。',
    bad_move: 'その手は打てません。',
    bad_game: '不明なゲームです。',
    plPractice: '練習',
  },
)

// two people on one device
registerStrings(
  {
    plLocalTurn: ["{name}'s turn", '輪到 {name}'],
    plLocal: ['Same device', '同一裝置'],
    hubLocal: ['Same device', '同一裝置'],
  },
  {
    plLocalTurn: '{name} の番です',
    plLocal: '同じ端末',
    hubLocal: '同じ端末',
  },
)
