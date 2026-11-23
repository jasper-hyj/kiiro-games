import { registerStrings } from '../i18n'

export const ROOM_STRINGS: Record<string, [string, string]> = {
  rmName: ['Room', '房間'], rmTitle: ['Play together', '一起玩'],
  rmTagline: ['Make a room, invite friends, then pick the game and its rules together. Everyone can play or just watch, and chat.', '開一個房間邀請朋友，再一起選遊戲和規則。每個人都可以參戰或只觀戰，也能聊天。'],
  rmCreate: ['Create a room', '開房間'], rmCreateBtn: ['Create room', '開房間'], rmJoin: ['Join with a code', '輸入代碼加入'],
  rmPeople: ['In this room', '房間內'], rmHost: ['Host', '房主'], rmYou: ['you', '你'], rmPlaying: ['Playing', '參戰'], rmWatching: ['Watching', '觀戰'],
  rmIPlay: ['I will play', '我要參戰'], rmIWatch: ['I will watch', '我要觀戰'],
  rmChoose: ['Choose a game', '選擇遊戲'], rmRules: ['Rules', '規則'], rmNoGame: ['The host is choosing a game.', '房主正在選擇遊戲。'],
  rmStart: ['Start {game}', '開始 {game}'], rmPickFirst: ['Pick a game to start.', '請先選擇遊戲。'],
  rmRunning: ['A game is running in this room.', '這個房間正在進行遊戲。'], rmJoinGame: ['Join the game', '加入遊戲'], rmWatchGame: ['Watch the game', '觀戰'],
  rmBack: ['Back to room', '回到房間'], rmLeave: ['Leave room', '離開房間'], rmCopy: ['Copy invite link', '複製邀請連結'], rmInvite: ['Invite', '邀請'], rmCopied: ['Copied', '已複製'],
  rmRuleset: ['Ruleset', '規則'], rmBlinds: ['Blinds', '盲注'], rmMinBet: ['Minimum bet', '最小下注'], rmMode: ['Mode', '模式'],
  rmCasual: ['Casual', '休閒'], rmRanked: ['Ranked (chips)', '排名賽（籌碼）'], rmCash: ['Cash (play chips)', '現金桌（遊戲籌碼）'],
  rmMahjong: ['Kiiro Mahjong', 'Kiiro 麻將'], rmHoldem: ["Texas Hold'em", '德州撲克'], rmBlackjack: ['Blackjack', '二十一點'], rmBigtwo: ['Big Two', '大老二'],
  rmHostOnly: ['Only the host can do that.', '只有房主可以這樣做。'], pick_first: ['Pick a game to start.', '請先選擇遊戲。'], host_only: ['Only the host can do that.', '只有房主可以這樣做。'],
  rmCreateNote: ['Tables start from a room: gather your friends first, then choose the game and rules together.', '牌桌從房間開始：先集合朋友，再一起選擇遊戲和規則。'],
  rmNoTableTitle: ['This table is not open', '這張牌桌未開放'], rmNoTableBody: ['Tables are opened from a room: create one, pick the game and invite friends.', '牌桌從房間開啟：開一個房間、選擇遊戲並邀請朋友。'],
  rmCodeClash: ['This room code is already used by another table. Go back and create a new room.', '這個房間代碼已被其他牌桌使用，請回去重新開一個房間。'],
  rmConnecting: ['Connecting…', '連線中…'], rmLost: ['Connection lost. Reconnecting…', '連線中斷，重新連線中…'],
  rmOr: ['Have a direct table code? Joining it works here too.', '有牌桌代碼嗎？也可以在這裡輸入加入。'],
}
registerStrings(ROOM_STRINGS)

registerStrings({}, {
  rmName: 'ルーム', rmTitle: 'みんなで遊ぶ',
  rmTagline: 'ルームを作って友達を招待し、一緒にゲームとルールを選びます。誰でもプレイも観戦もチャットもできます。',
  rmCreate: 'ルームを作る', rmCreateBtn: 'ルームを作る', rmJoin: 'コードで参加',
  rmPeople: 'ルームにいる人', rmHost: 'ホスト', rmYou: 'あなた', rmPlaying: 'プレイ', rmWatching: '観戦',
  rmIPlay: 'プレイする', rmIWatch: '観戦する',
  rmChoose: 'ゲームを選ぶ', rmRules: 'ルール', rmNoGame: 'ホストがゲームを選んでいます。',
  rmStart: '{game} を始める', rmPickFirst: 'ゲームを選んでください。',
  rmRunning: 'このルームではゲームが進行中です。', rmJoinGame: 'ゲームに参加', rmWatchGame: '観戦する',
  rmBack: 'ルームに戻る', rmLeave: 'ルームを出る', rmCopy: '招待リンクをコピー', rmInvite: '招待', rmCopied: 'コピーしました',
  rmRuleset: 'ルール', rmBlinds: 'ブラインド', rmMinBet: '最小ベット', rmMode: 'モード',
  rmCasual: 'カジュアル', rmRanked: 'ランク戦（チップ）', rmCash: 'キャッシュ（プレイ用チップ）',
  rmMahjong: 'Kiiro 麻雀', rmHoldem: 'テキサスホールデム', rmBlackjack: 'ブラックジャック', rmBigtwo: '大老二',
  rmHostOnly: 'ホストだけができます。', pick_first: 'ゲームを選んでください。', host_only: 'ホストだけができます。',
  rmCreateNote: 'テーブルはルームから始まります。まず友達を集めて、一緒にゲームとルールを選びましょう。',
  rmNoTableTitle: 'このテーブルは開いていません', rmNoTableBody: 'テーブルはルームから開きます。ルームを作り、ゲームを選んで友達を招待しましょう。',
  rmCodeClash: 'このルームコードは別のテーブルで使われています。戻って新しいルームを作ってください。',
  rmConnecting: '接続中…', rmLost: '接続が切れました。再接続中…',
  rmOr: 'テーブルのコードをお持ちですか？ここから参加もできます。',
})
