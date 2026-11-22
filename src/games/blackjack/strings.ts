import { registerStrings } from '../../i18n'

export const BJ_STRINGS: Record<string, [string, string]> = {
  bjName: ['Blackjack', '二十一點'], bjTagline: ['Beat the dealer at a shared table. Blackjack pays 3:2, the dealer stands on all 17s.', '在共享牌桌上對戰莊家。二十一點賠 3:2，莊家 17 點必停。'],
  bjCreate: ['Create a table', '開桌'], bjJoin: ['Join with a code', '輸入代碼加入'], bjMinBet: ['Minimum bet', '最小下注'],
  bjDealer: ['Dealer', '莊家'], bjBetNow: ['Place your bet', '請下注'], bjBet: ['Bet {n}', '下注 {n}'], bjBetPlaced: ['Bet placed: {n}', '已下注：{n}'], bjChange: ['Change bet', '更改下注'],
  bjHit: ['Hit', '要牌'], bjStand: ['Stand', '停牌'], bjDouble: ['Double', '加倍'], bjSplit: ['Split', '分牌'], bjDeal: ['Dealing…', '發牌中…'],
  bjWatching: ['Next round starts soon.', '下一局即將開始。'], bjWaiting: ['Waiting for a player to sit down…', '等待玩家入座…'],
  bjYourTurn: ['Your turn', '輪到你'], bjWaitTurn: ['{name} is playing', '{name} 操作中'], bjDealerPlays: ['Dealer plays', '莊家補牌'], bjNext: ['Next round in {s}s', '{s} 秒後下一局'],
  'bjo.blackjack': ['Blackjack', '二十一點'], 'bjo.win': ['Win', '贏'], 'bjo.push': ['Push', '平手'], 'bjo.lose': ['Lose', '輸'], 'bjo.bust': ['Bust', '爆牌'],
  bjMinMax: ['Table limits {min} to {max}', '桌限 {min} 到 {max}'], bjSoft: ['soft', '軟'],
  cannot_hit: ['You cannot hit now.', '現在不能要牌。'], cannot_double: ['You cannot double now.', '現在不能加倍。'], cannot_split: ['You cannot split now.', '現在不能分牌。'], not_betting: ['Betting is closed.', '已截止下注。'],
}
registerStrings(BJ_STRINGS)
