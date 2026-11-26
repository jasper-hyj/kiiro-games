import { registerStrings } from '../i18n'

// key: [English, 繁體中文]
export const HUB_STRINGS: Record<string, [string, string]> = {
  hubName: ['Kiiro Games', 'Kiiro 遊戲'],
  hubHeadline: ['A collection of games', '遊戲合集'],
  hubGames: ['Games', '遊戲'],
  hubBtBlurb: [
    'Four players, bots fill empty seats. Competitive rooms settle play chips between signed-in players.',
    '四人對戰，空位由電腦補上。競技房會在已登入的玩家之間結算遊戲籌碼。',
  ],
  hubBjBlurb: [
    'Shared tables against the dealer, 1 to 8 players. Casual or cash with play chips.',
    '與莊家對戰的共享牌桌，1 到 8 位玩家。休閒桌或使用遊戲籌碼的現金桌。',
  ],
  hubHaveCode: ['Room code', '房間代碼'],
  hubJoin: ['Join', '加入'],
  hubTagline: ['Free to play, with play chips and a monthly leaderboard. No cash, no ads.', '免費遊玩，使用遊戲籌碼與每月排行榜。沒有現金，沒有廣告。'],
  hubMahjong: ['Kiiro Mahjong', 'Kiiro 麻將'],
  hubMahjongBlurb: [
    'Taiwanese, Hong Kong, Japanese Riichi, Chinese Official and Sichuan. Play friends online, bots fill empty seats.',
    '台灣、香港、日本、國標與四川麻將。和朋友線上對戰，空位由電腦補上。',
  ],
  hubOpen: ['Play', '開始'],
  hubNoSignin: ['Mahjong needs no sign-in. Sign in only if you want your results saved.', '麻將不需登入。想保存戰績時再登入即可。'],
  hubSoon: ['Coming soon', '即將推出'],
  hubHoldem: ["Texas Hold'em", '德州撲克'],
  hubHoldemBlurb: [
    '2 to 8 players. Casual tables for guests, cash tables with play chips for accounts, and practice against bots.',
    '2 到 8 位玩家。訪客可玩休閒桌，帳號可玩使用遊戲籌碼的現金桌，也能和電腦練習。',
  ],
  hubAll: ['All games', '所有遊戲'],
  hubCreateRoom: ['Create a room', '開房間'],
  hubPlayFriends: ['Play with friends', '和朋友玩'],
  hubPractice: ['Practice', '練習'],
  hubTagMj: ['Tiles', '麻將'],
  hubTagCards: ['Cards', '紙牌'],
}
export const HUB_JA: Record<string, string> = {
  hubCreateRoom: 'ルームを作る',
  hubPlayFriends: '友達と遊ぶ',
  hubPractice: '練習',
  hubBjBlurb: 'ディーラーと勝負する共有テーブル、1〜8人。カジュアルか、プレイ用チップのキャッシュテーブル。',
  hubBtBlurb: '4人対戦で空席はCPUが埋めます。対戦ではログイン済みのプレイヤー間でプレイ用チップを精算します。',
  hubHaveCode: 'ルームコード',
  hubJoin: '参加',
  hubHoldemBlurb: '2〜8人。ゲストはカジュアルテーブル、アカウントはプレイ用チップのキャッシュテーブルで遊べ、CPUとの練習もできます。',
  hubName: 'Kiiro ゲームズ',
  hubHeadline: 'ゲーム集',
  hubGames: 'ゲーム',
  hubTagline: '無料。プレイ用チップと月間ランキング付き。現金も広告もありません。',
  hubMahjong: 'Kiiro 麻雀',
  hubMahjongBlurb: '台湾・香港・日本・国標・四川の麻雀。友達とオンライン対戦、空席はCPUが埋めます。',
  hubOpen: '遊ぶ',
  hubNoSignin: '麻雀はログイン不要。記録を残したいときだけログインしてください。',
  hubSoon: '近日公開',
  hubHoldem: 'テキサスホールデム',
  hubAll: 'ゲーム一覧',
}
registerStrings(HUB_STRINGS, HUB_JA)
