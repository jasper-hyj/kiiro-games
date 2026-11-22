import { registerStrings } from '../i18n'

// key: [English, 繁體中文]
export const HUB_STRINGS: Record<string, [string, string]> = {
  hubName: ['Kiiro Games', 'Kiiro 遊戲'], hubTagline: ['Games for friends and clubs. Free to play, no sign-in needed for Mahjong.', '和朋友、社團一起玩的小遊戲。免費，玩麻將不需要登入。'],
  hubMahjong: ['Kiiro Mahjong', 'Kiiro 麻將'], hubMahjongBlurb: ['Taiwanese, Hong Kong, Japanese Riichi, Chinese Official and Sichuan. Play friends online, bots fill empty seats.', '台灣、香港、日本、國標與四川麻將。和朋友線上對戰，空位由電腦補上。'],
  hubOpen: ['Play now', '馬上玩'], hubNoSignin: ['No sign-in', '免登入'], hubSoon: ['Coming soon', '即將推出'],
  hubHoldem: ["Texas Hold'em", '德州撲克'], hubHoldemBlurb: ['Friendly tables with play chips and a leaderboard.', '使用遊戲籌碼的友誼賽桌，附排行榜。'], hubAll: ['All games', '所有遊戲'],
}
export const HUB_JA: Record<string, string> = {
  hubName: 'Kiiro ゲームズ',
  hubTagline: '友達やサークルで遊べるゲーム集。無料で、麻雀はログイン不要です。',
  hubMahjong: 'Kiiro 麻雀',
  hubMahjongBlurb: '台湾・香港・日本・国標・四川の麻雀。友達とオンライン対戦、空席はCPUが埋めます。',
  hubOpen: '今すぐ遊ぶ',
  hubNoSignin: 'ログイン不要',
  hubSoon: '近日公開',
  hubHoldem: 'テキサスホールデム',
  hubHoldemBlurb: 'プレイ用チップとランキングのある気軽なテーブル。',
  hubAll: 'ゲーム一覧',
}
registerStrings(HUB_STRINGS, HUB_JA)
