import { useState } from 'react'
import type { RuleId } from '../engine/rules'

type Row = [string, string, string]
const DATA: Record<RuleId, { intro: string[]; sections: { title: string; rows: Row[] }[] }> = {
  riichi: {
    intro: [
      '13 tiles, 136-tile set (no flowers). Red fives (aka dora) optional. You need at least one yaku to win (dora alone never counts).',
      'Chi only from the player to your left. Pon/kan from anyone. Riichi: closed tenpai hand, bet 1000, no changing the hand afterwards. Furiten (you discarded one of your own winning tiles, or passed a ron) blocks ron but not tsumo.',
      'Payment: han + fu → base points. 5 han mangan (2000 base), 6-7 haneman, 8-10 baiman, 11-12 sanbaiman, 13+ yakuman. Ron: dealer 6× / others 4× base; tsumo: dealer 2× from each, others 2× from dealer and 1× from others. Honba add 300 per counter; riichi sticks go to the winner. Draw: noten players pay 3000 total to tenpai players.',
    ],
    sections: [
      { title: '1 han', rows: [['Riichi', '立直', 'closed, declare tenpai'], ['Ippatsu', '一發', 'win within one round of riichi'], ['Menzen Tsumo', '門前清自摸', 'closed self-draw'], ['Tanyao', '斷幺九', 'all simples'], ['Pinfu', '平和', 'all sequences, two-sided wait, non-yakuhai pair'], ['Iipeikou', '一盃口', 'two identical sequences, closed'], ['Yakuhai', '役牌', 'dragon / seat wind / round wind triplet'], ['Haitei / Houtei', '海底/河底', 'win on last tile'], ['Rinshan / Chankan', '嶺上/搶槓', 'win on kan draw / robbing a kan']] },
      { title: '2 han', rows: [['Double Riichi', '雙立直', 'riichi on first turn (2)'], ['Chiitoitsu', '七對子', 'seven pairs (25 fu)'], ['Sanshoku Doujun', '三色同順', 'same sequence in 3 suits (open 1)'], ['Ittsu', '一氣通貫', '123 456 789 in one suit (open 1)'], ['Chanta', '混全帶幺九', 'terminal/honor in every set (open 1)'], ['Toitoi', '對對和', 'all triplets'], ['Sanankou', '三暗刻', 'three concealed triplets'], ['Sanshoku Doukou', '三色同刻', 'same triplet in 3 suits'], ['Sankantsu', '三槓子', 'three kans'], ['Honroutou', '混老頭', 'all terminals & honors'], ['Shousangen', '小三元', 'two dragon triplets + dragon pair']] },
      { title: '3+ han', rows: [['Honitsu', '混一色', '3 han closed / 2 open'], ['Junchan', '純全帶幺九', '3 closed / 2 open'], ['Ryanpeikou', '二盃口', '3 han, two iipeikou'], ['Chinitsu', '清一色', '6 han closed / 5 open']] },
      { title: 'Yakuman', rows: [['Kokushi Musou', '國士無雙', 'thirteen orphans'], ['Suuankou', '四暗刻', 'four concealed triplets'], ['Daisangen', '大三元', 'three dragon triplets'], ['Shousuushii / Daisuushii', '小四喜/大四喜', 'little / big four winds'], ['Tsuuiisou', '字一色', 'all honors'], ['Chinroutou', '清老頭', 'all terminals'], ['Ryuuiisou', '綠一色', 'all green'], ['Chuuren Poutou', '九蓮寶燈', 'nine gates'], ['Suukantsu', '四槓子', 'four kans'], ['Tenhou / Chiihou', '天和/地和', 'win on first draw']] },
    ],
  },
  hk: {
    intro: [
      '13 tiles, 144-tile set with 8 flowers (drawn flowers are set aside and replaced). Minimum 3 fan to win (configurable in the lobby). No yaku restrictions beyond that.',
      'Fan → points: 3 fan = 8, 4 = 16, 5 = 24, 6 = 32, 7 = 48, 8 = 64, 9 = 96, 10+ = 128 (limit). Self-draw: each opponent pays the value. Discard win: the discarder pays double. Dealer keeps the seat after a win or a draw.',
      'Collecting all 8 flowers wins immediately (8 fan).',
    ],
    sections: [
      { title: 'Fan', rows: [['Common Hand', '平胡', '1 — all sequences, non-honor pair'], ['Self-drawn', '自摸', '1'], ['Concealed Hand', '門前清', '1 (ron) / 3 with self-draw (不求人)'], ['Dragon / Seat Wind / Round Wind', '三元/門風/圈風', '1 each triplet'], ['Seat Flower', '正花', '1 each'], ['No Flowers', '無花', '1'], ['Complete Flower Set', '一台花', '2'], ['Last tile / last discard', '海底/河底', '1'], ['Win on Kong / Robbing Kong', '槓上開花/搶槓', '1']] },
      { title: 'Bigger hands', rows: [['All Triplets', '對對胡', '3'], ['Mixed One Suit', '混一色', '3'], ['Pure One Suit', '清一色', '7'], ['Small Three Dragons', '小三元', '5'], ['Big Three Dragons', '大三元', '8'], ['Small Four Winds', '小四喜', '10'], ['Mixed Terminals', '混幺九', '7'], ['All Honors / All Terminals', '字一色/清幺九', '10'], ['Four Concealed Triplets', '四暗刻', '8'], ['Big Four Winds / Four Kongs / Thirteen Orphans', '大四喜/十八羅漢/十三幺', '13 (limit)'], ['Heavenly / Earthly Hand', '天胡/地胡', '13']] },
    ],
  },
  taiwan: {
    intro: [
      '16 tiles (5 sets + a pair), 144-tile set with flowers. No minimum — any complete hand wins.',
      'Payment = base 30 + 10 per tai. Self-draw: every opponent pays. Discard win: only the discarder pays. The dealer wins +1 tai and +2 per consecutive win (連莊拉莊); when the dealer pays, they also owe that bonus.',
      'Collecting all 8 flowers wins immediately (8 tai). A seat flower matches your seat number (East = 1 …).',
    ],
    sections: [
      { title: 'Tai', rows: [['Dealer', '莊家', '1 (+2 per streak)'], ['Concealed Hand', '門清', '1'], ['Self-draw', '自摸', '1'], ['Concealed Self-draw', '門清自摸', '3 (replaces the two above)'], ['All Exposed', '全求人', '2 (win by discard, all melds open)'], ['Dragon / Seat Wind / Round Wind', '三元/門風/圈風', '1 each triplet'], ['Seat Flower', '花牌', '1 each'], ['Flower Set (花槓)', '花槓', '2'], ['Pinghu', '平胡', '2 — all sequences, two-sided wait, no honors/flowers'], ['Single Wait', '獨聽', '1'], ['Last tile / last discard', '海底/河底', '1'], ['Win on Kong / Robbing Kong', '槓上開花/搶槓', '1']] },
      { title: 'Bigger hands', rows: [['All Triplets', '碰碰胡', '4'], ['Three / Four / Five Concealed Triplets', '三/四/五暗刻', '2 / 5 / 8'], ['Mixed One Suit', '混一色', '4'], ['Pure One Suit', '清一色', '8'], ['Small Three Dragons', '小三元', '4'], ['Big Three Dragons', '大三元', '8'], ['Small Four Winds', '小四喜', '8'], ['Big Four Winds', '大四喜', '16'], ['All Honors', '字一色', '16'], ['Heavenly / Earthly Hand', '天胡/地胡', '16'], ['Eight Flowers', '八仙過海', '8']] },
    ],
  },
}

export function RulesHelp({ initial, onClose }: { initial: RuleId; onClose: () => void }) {
  const [id, setId] = useState<RuleId>(initial)
  const d = DATA[id]
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Rules reference</h2>
          <button className="btn sm alt" onClick={onClose}>Close</button>
        </div>
        <div className="tabs">
          {([['riichi', 'Japanese'], ['hk', 'Hong Kong'], ['taiwan', 'Taiwanese']] as const).map(([k, n]) => (
            <button key={k} className={'btn sm ' + (id === k ? 'gold' : 'alt')} onClick={() => setId(k)}>{n}</button>
          ))}
        </div>
        {d.intro.map((t, i) => <p key={i} className="muted">{t}</p>)}
        {d.sections.map((s) => (
          <div key={s.title}>
            <h2>{s.title}</h2>
            <table className="ref"><tbody>{s.rows.map((r, i) => <tr key={i}><td>{r[0]}</td><td className="muted">{r[1]}</td><td>{r[2]}</td></tr>)}</tbody></table>
          </div>
        ))}
      </div>
    </div>
  )
}
