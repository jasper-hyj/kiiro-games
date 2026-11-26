import { registerStrings } from '../../i18n'

// [English, 繁體中文], then Japanese
registerStrings(
  {
    spades: ['Spades', '黑桃'],
    spadesBlurb: ['Bid your tricks, spades are trump, partners share a score.', '叫出墩數，黑桃為王牌，搭檔合計得分。'],
    spBid: ['Your bid', '你的叫牌'],
    spNil: ['Nil', '零'],
    spBids: ['Bid {b} · won {w}', '叫 {b} · 贏 {w}'],
    spTeam: ['You and {p} · {a}', '你和 {p} · {a}'],
    spBroken: ['Spades broken', '黑桃已破'],
    spResult: ['Team {t}: bid {b}, took {m}, score {s}', '第 {t} 隊：叫 {b}、贏 {m}、得 {s} 分'],
    spNilWon: ['nil made', '零成功'],
    spNilLost: ['nil failed', '零失敗'],
    spHow: ['How to play Spades', '黑桃玩法'],
    spR1: [
      'Four players in two partnerships: seats 1 and 3 against seats 2 and 4. Everyone bids how many tricks they expect to win; 0 is "nil".',
      '四人兩隊：1、3 號對 2、4 號。每人叫出預計贏幾墩；0 稱為「零」。',
    ],
    spR2: [
      'Spades are trump. Follow suit if you can. Spades cannot lead until one has been played.',
      '黑桃是王牌。有同花色就必須跟，黑桃被打出前不能領出黑桃。',
    ],
    spR3: [
      'Your team makes its bid when your combined tricks reach your combined bids: 10 points per trick bid plus 1 per extra trick. Falling short loses 10 per trick bid.',
      '雙方合計墩數達到合計叫牌即成功：每叫一墩 10 分，多贏的每墩 1 分；沒達到則每叫一墩扣 10 分。',
    ],
    spR4: ['Nil: take no tricks for +100, or −100 if you do.', '叫零：一墩都不贏得 +100，贏了任何一墩則 −100。'],
  },
  {
    spades: 'スペード',
    spadesBlurb: '取るトリック数を宣言。スペードが切り札、ペアで得点します。',
    spBid: 'あなたの宣言',
    spNil: 'ニル',
    spBids: '宣言 {b} · 獲得 {w}',
    spTeam: 'あなたと{p} · {a}',
    spBroken: 'スペード解禁',
    spResult: 'チーム{t}: 宣言{b}・獲得{m}・得点{s}',
    spNilWon: 'ニル成功',
    spNilLost: 'ニル失敗',
    spHow: 'スペードの遊び方',
    spR1: '4人が2組に分かれます（1・3番 対 2・4番）。各自、取れると思うトリック数を宣言します。0は「ニル」です。',
    spR2: 'スペードが切り札。同じスートを出せるなら出します。スペードが出るまでスペードでリードできません。',
    spR3: 'ペアの獲得数が宣言の合計に届けば成功：宣言1トリックにつき10点、超過1トリックにつき1点。届かないと宣言1トリックにつき-10点。',
    spR4: 'ニル：1トリックも取らなければ+100点、取ると-100点。',
  },
)
