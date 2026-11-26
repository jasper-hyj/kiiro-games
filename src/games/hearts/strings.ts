import { registerStrings } from '../../i18n'

// [English, 繁體中文], then Japanese
registerStrings(
  {
    hearts: ['Hearts', '紅心大戰'],
    heartsBlurb: ['Avoid hearts and the Queen of Spades.', '避開紅心牌與黑桃 Q。'],
    htPass: ['Pass 3 cards {to}', '傳 3 張牌給{to}'],
    htLeft: ['to the left', '左邊'],
    htRight: ['to the right', '右邊'],
    htAcross: ['across', '對面'],
    htKeep: ['no passing this time', '這局不傳牌'],
    htPick: ['Choose 3 cards to pass.', '選 3 張要傳出的牌。'],
    htBroken: ['Hearts broken', '紅心已破'],
    htPoints: ['{n} pts', '{n} 分'],
    htLast: ['Last trick, taken by {name}', '上一墩，由 {name} 取得'],
    htMoon: ['{name} shot the moon!', '{name} 全收！'],
    htHow: ['How to play Hearts', '紅心大戰玩法'],
    htR1: [
      'Four players, 13 cards each. Before play, pass three cards to the left, right, across, then keep (rotating each game).',
      '四人各 13 張牌。出牌前傳三張牌給左、右、對面，再輪到不傳（每局輪換）。',
    ],
    htR2: [
      'The 2 of clubs leads. You must follow suit; if you cannot, play anything (no points on the first trick). Hearts cannot lead until a heart has been played.',
      '梅花 2 先出。必須跟同花色；沒有就可以出任何牌（第一墩不能出分數牌）。紅心被打出前不能領出紅心。',
    ],
    htR3: ['Each heart is 1 point and the Queen of Spades is 13. The fewest points wins.', '每張紅心 1 分，黑桃 Q 為 13 分，總分最少者獲勝。'],
    htR4: ['If one player takes every point (shoots the moon) everyone else gets 26.', '若某人包辦全部分數（全收），其餘三人各得 26 分。'],
  },
  {
    hearts: 'ハーツ',
    heartsBlurb: 'ハートとスペードのクイーンを避けます。',
    htPass: '3枚を{to}へ渡す',
    htLeft: '左',
    htRight: '右',
    htAcross: '向かい',
    htKeep: '今回は渡しません',
    htPick: '渡す3枚を選んでください。',
    htBroken: 'ハート解禁',
    htPoints: '{n}点',
    htLast: '前のトリック（{name}が獲得）',
    htMoon: '{name}がシュート・ザ・ムーン！',
    htHow: 'ハーツの遊び方',
    htR1: '4人に13枚ずつ。プレイ前に3枚を左・右・向かいへ渡し、その次は渡さない、を毎回繰り返します。',
    htR2: 'クラブの2から始めます。同じスートを出す必要があり、なければ何を出しても構いません（最初のトリックは点札不可）。ハートが出るまでハートでリードできません。',
    htR3: 'ハートは1枚1点、スペードのクイーンは13点。合計が最も少ない人の勝ちです。',
    htR4: '1人がすべての点を取る（シュート・ザ・ムーン）と、他の3人に26点が入ります。',
  },
)
