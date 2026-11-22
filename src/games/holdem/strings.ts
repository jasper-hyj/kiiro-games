import { registerStrings } from '../../i18n'

export const HOLDEM_STRINGS: Record<string, [string, string]> = {
  hdName: ["Texas Hold'em", '德州撲克'], hdTagline: ['Friendly tables with play chips. No bots, no cash value.', '使用遊戲籌碼的友誼賽桌。沒有電腦玩家，籌碼沒有現金價值。'],
  hdCreate: ['Create a table', '開桌'], hdJoin: ['Join with a code', '輸入代碼加入'], hdCode: ['4-digit code', '四位數代碼'], hdJoinBtn: ['Join', '加入'], hdCreateBtn: ['Create table', '開桌'],
  hdNick: ['Your name', '你的名字'], hdBlinds: ['Blinds', '盲注'], hdMode: ['Table type', '桌類型'],
  hdCasual: ['Casual', '休閒'], hdCash: ['Cash (play chips)', '現金桌（遊戲籌碼）'],
  hdCasualNote: ['Free temporary chips. Guests welcome. Nothing is saved.', '免費的臨時籌碼，訪客也能玩，不會儲存。'],
  hdCashNote: ['Buy in from your balance, cash out when you leave. Needs an account.', '從你的餘額買入，離桌時兌回。需要帳號。'],
  hdRoom: ['Table', '牌桌'], hdCopy: ['Copy invite link', '複製邀請連結'], hdCopied: ['Copied', '已複製'], hdLeave: ['Leave table', '離開牌桌'],
  hdSit: ['Take a seat', '入座'], hdBuyin: ['Buy-in', '買入'], hdSitCash: ['Sit down with {n}', '帶 {n} 入座'], hdSignIn: ['Sign in to play cash tables', '登入後才能玩現金桌'],
  hdWaiting: ['Waiting for another player…', '等待其他玩家…'], hdSpectating: ['Watching. Sit down to play.', '觀戰中。入座即可開始。'],
  hdFold: ['Fold', '棄牌'], hdCheck: ['Check', '過牌'], hdCall: ['Call {n}', '跟注 {n}'], hdRaise: ['Raise to {n}', '加注到 {n}'], hdBet: ['Bet {n}', '下注 {n}'], hdAllIn: ['All in', '全下'],
  hdMin: ['Min', '最小'], hdHalf: ['½ pot', '½ 池'], hdPot: ['Pot', '底池'], hdYourTurn: ['Your turn', '輪到你'], hdWaitTurn: ['{name} to act', '等待 {name}'],
  hdPotLabel: ['Pot', '底池'], hdWins: ['{name} wins {n}', '{name} 贏得 {n}'], hdSplit: ['Split pot', '平分底池'], hdNext: ['Next hand in {s}s', '{s} 秒後下一手'],
  hdSitOut: ['Sit out', '暫離'], hdBack: ["I'm back", '我回來了'], hdOutNote: ['You are sitting out.', '你目前暫離。'], hdRebuy: ['Add chips', '補碼'],
  hdSB: ['SB', '小盲'], hdBB: ['BB', '大盲'], hdDealer: ['D', '莊'],
  hdLastFold: ['fold', '棄牌'], hdLastCheck: ['check', '過牌'], hdLastCall: ['call', '跟注'], hdLastRaise: ['raise', '加注'], hdLastBet: ['bet', '下注'], hdLastAllin: ['all in', '全下'], hdLastSb: ['small blind', '小盲'], hdLastBb: ['big blind', '大盲'],
  'hand.0': ['High card', '高牌'], 'hand.1': ['Pair', '一對'], 'hand.2': ['Two pair', '兩對'], 'hand.3': ['Three of a kind', '三條'], 'hand.4': ['Straight', '順子'], 'hand.5': ['Flush', '同花'], 'hand.6': ['Full house', '葫蘆'], 'hand.7': ['Four of a kind', '四條'], 'hand.8': ['Straight flush', '同花順'],
  hdOffline: ['Cannot reach the game server.', '無法連線到遊戲伺服器。'],
  hdConnecting: ['Connecting…', '連線中…'], hdLost: ['Connection lost. Reconnecting…', '連線中斷，重新連線中…'],
  signin_required: ['Sign in to sit at a cash table.', '登入後才能入座現金桌。'], not_enough_chips: ['Not enough chips for that buy-in.', '籌碼不足，無法買入。'],
  bad_buyin: ['That buy-in is not allowed.', '買入金額不符。'], table_full: ['The table is full.', '牌桌已滿。'], not_your_turn: ['It is not your turn.', '還沒輪到你。'],
  cannot_check: ['You cannot check now.', '現在不能過牌。'], cannot_raise: ['You cannot raise now.', '現在不能加注。'], bad_amount: ['That amount is not allowed.', '金額不符。'],
}
registerStrings(HOLDEM_STRINGS)
