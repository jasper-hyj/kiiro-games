import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { RuleId } from '../engine/rules'
import { useLang } from '../i18n'

// [English name, 中文名, English description, 中文說明]
type Row = [string, string, string, string]
interface Data { intro: [string, string][]; sections: { title: [string, string]; rows: Row[] }[] }

const DATA: Record<RuleId, Data> = {
  taiwan: {
    intro: [
      ['16 tiles (5 sets + a pair) from a 144-tile set with 8 flowers. There is no minimum — any complete hand wins.', '每人 16 張（5 組面子 + 一對眼），共 144 張牌含 8 張花牌。沒有最低台數，只要胡牌就算贏。'],
      ['Payment = base 30 + 10 per tai. Self-draw: every opponent pays. Discard win: only the discarder pays (several players can win off the same discard).', '輸贏 = 底 30 + 每台 10。自摸三家都付；放槍只由放槍者付（一炮可多家同時胡）。'],
      ['The dealer wins +1 tai and +2 per consecutive win or draw (連莊拉莊); when the dealer pays, they also owe that bonus. Collecting all 8 flowers wins immediately (8 tai).', '莊家胡牌加 1 台，每連莊一次再加 2 台（連莊拉莊）；莊家放槍或被自摸時也要多付。集齊 8 張花牌直接胡（八仙過海 8 台）。'],
    ],
    sections: [
      { title: ['Tai', '台數'], rows: [
        ['Dealer', '莊家', '1 (+2 per streak)', '1 台（每連莊 +2）'],
        ['Concealed Hand', '門清', '1', '1 台'], ['Self-draw', '自摸', '1', '1 台'],
        ['Concealed Self-draw', '門清自摸', '3 (replaces the two above)', '3 台（取代門清與自摸）'],
        ['All Exposed', '全求人', '2 — win by discard, all melds open', '2 台 — 全部吃碰槓後放槍胡'],
        ['Dragon / Seat Wind / Round Wind', '三元牌/門風/圈風', '1 each triplet', '各 1 台（刻子）'],
        ['Seat Flower', '花牌', '1 each', '正花每張 1 台'], ['Flower Set', '花槓', '2', '2 台'],
        ['Pinghu', '平胡', '2 — all sequences, two-sided wait, no honors or flowers', '2 台 — 全順子、兩面聽、無字無花'],
        ['Single Wait', '獨聽', '1', '1 台'],
        ['Last tile / last discard', '海底撈月/河底撈魚', '1', '1 台'], ['Win on Kong / Robbing Kong', '槓上開花/搶槓', '1', '1 台'],
      ] },
      { title: ['Bigger hands', '大牌型'], rows: [
        ['All Triplets', '碰碰胡', '4', '4 台'],
        ['Three / Four / Five Concealed Triplets', '三/四/五暗刻', '2 / 5 / 8', '2 / 5 / 8 台'],
        ['Mixed One Suit', '混一色', '4', '4 台'], ['Pure One Suit', '清一色', '8', '8 台'],
        ['Small Three Dragons', '小三元', '4', '4 台'], ['Big Three Dragons', '大三元', '8', '8 台'],
        ['Small Four Winds', '小四喜', '8', '8 台'], ['Big Four Winds', '大四喜', '16', '16 台'],
        ['All Honors', '字一色', '16', '16 台'], ['Heavenly / Earthly Hand', '天胡/地胡', '16', '16 台'],
        ['Eight Flowers', '八仙過海', '8', '8 台'],
      ] },
    ],
  },
  hk: {
    intro: [
      ['13 tiles from a 144-tile set with 8 flowers (flowers are set aside and replaced). Minimum 3 fan to win (adjustable in the options).', '每人 13 張，共 144 張牌含 8 張花牌（摸到花牌補牌）。預設最低 3 番起胡（可在選項調整）。'],
      ['Fan → points: 3 fan = 8, 4 = 16, 5 = 24, 6 = 32, 7 = 48, 8 = 64, 9 = 96, 10+ = 128 (limit). Self-draw: each opponent pays the value. Discard win: the discarder pays double.', '番數換算：3 番 = 8，4 = 16，5 = 24，6 = 32，7 = 48，8 = 64，9 = 96，10 番以上 = 128（滿番）。自摸三家各付；放槍者付雙倍。'],
      ['Collecting all 8 flowers wins immediately (8 fan).', '集齊 8 張花牌直接胡（8 番）。'],
    ],
    sections: [
      { title: ['Fan', '番數'], rows: [
        ['Common Hand', '平胡', '1 — all sequences, non-honor pair', '1 番 — 全順子，將牌非字牌'],
        ['Self-drawn', '自摸', '1', '1 番'],
        ['Concealed Hand', '門前清', '1 (ron) / 3 with self-draw (不求人)', '1 番（放槍）／自摸為不求人 3 番'],
        ['Dragon / Seat Wind / Round Wind', '三元/門風/圈風', '1 each triplet', '各 1 番（刻子）'],
        ['Seat Flower', '正花', '1 each', '每張 1 番'], ['No Flowers', '無花', '1', '1 番'],
        ['Complete Flower Set', '一台花', '2', '2 番'],
        ['Last tile / last discard', '海底/河底', '1', '1 番'], ['Win on Kong / Robbing Kong', '槓上開花/搶槓', '1', '1 番'],
      ] },
      { title: ['Bigger hands', '大牌型'], rows: [
        ['All Triplets', '對對胡', '3', '3 番'], ['Mixed One Suit', '混一色', '3', '3 番'], ['Pure One Suit', '清一色', '7', '7 番'],
        ['Small Three Dragons', '小三元', '5', '5 番'], ['Big Three Dragons', '大三元', '8', '8 番'],
        ['Small Four Winds', '小四喜', '10', '10 番'], ['Mixed Terminals', '混幺九', '7', '7 番'],
        ['All Honors / All Terminals', '字一色/清幺九', '10', '10 番'], ['Four Concealed Triplets', '四暗刻', '8', '8 番'],
        ['Big Four Winds / Four Kongs / Thirteen Orphans', '大四喜/十八羅漢/十三幺', '13 (limit)', '13 番（滿番）'],
        ['Heavenly / Earthly Hand', '天胡/地胡', '13', '13 番'],
      ] },
    ],
  },
  riichi: {
    intro: [
      ['13 tiles, 136-tile set (no flowers); red fives optional. You need at least one yaku to win — dora alone never counts. 3-player (sanma) removes 2m–8m and sets North tiles aside as bonus dora.', '每人 13 張，共 136 張（無花牌），可選赤牌。胡牌必須至少有一個役，寶牌不算役。三人麻將去除二～八萬，北風可拔出當寶牌。'],
      ['Chi only from the player to your left. Riichi: closed tenpai hand, bet 1000, the hand is then locked. Furiten (a winning tile is in your own discards, or you passed a ron) blocks ron but not tsumo.', '吃只能吃上家的牌。立直：門清聽牌，押 1000 點，之後不能改牌。振聽（自己捨牌中有胡牌，或放過一次榮和）不能榮和但可以自摸。'],
      ['Payment: han + fu → base points. 5 han mangan, 6–7 haneman, 8–10 baiman, 11–12 sanbaiman, 13+ yakuman. Draw: noten players pay 3000 total to tenpai players. Abortive draws: nine terminals, four winds, four riichi, four kans, triple ron.', '計分：翻數與符數換算基本點。5 翻滿貫，6–7 跳滿，8–10 倍滿，11–12 三倍滿，13 翻以上役滿。流局時未聽牌者共付 3000 給聽牌者。途中流局：九種九牌、四風連打、四家立直、四槓散了、三家和。'],
    ],
    sections: [
      { title: ['1 han', '1 翻'], rows: [
        ['Riichi', '立直', 'closed, declare tenpai', '門清聽牌宣告'], ['Ippatsu', '一發', 'win within one round of riichi', '立直後一巡內和牌'],
        ['Menzen Tsumo', '門前清自摸', 'closed self-draw', '門清自摸'], ['Tanyao', '斷幺九', 'all simples', '全是 2～8 的數牌'],
        ['Pinfu', '平和', 'all sequences, two-sided wait, non-yakuhai pair', '全順子、兩面聽、將牌非役牌'], ['Iipeikou', '一盃口', 'two identical sequences, closed', '門清兩組相同順子'],
        ['Yakuhai', '役牌', 'dragon / seat wind / round wind triplet', '三元牌、自風、場風刻子'],
        ['Haitei / Houtei', '海底/河底', 'win on the last tile', '最後一張牌和牌'], ['Rinshan / Chankan', '嶺上/搶槓', 'win on kan draw / robbing a kan', '槓後摸牌和牌／搶槓'],
      ] },
      { title: ['2 han', '2 翻'], rows: [
        ['Double Riichi', '雙立直', 'riichi on the first turn', '第一巡立直'], ['Chiitoitsu', '七對子', 'seven pairs (25 fu)', '七個對子（25 符）'],
        ['Sanshoku Doujun', '三色同順', 'same sequence in 3 suits (open: 1)', '三種花色相同順子（副露 1 翻）'], ['Ittsu', '一氣通貫', '123 456 789 in one suit (open: 1)', '同花色 123 456 789（副露 1 翻）'],
        ['Chanta', '混全帶幺九', 'terminal/honor in every set (open: 1)', '每組都含幺九字牌（副露 1 翻）'], ['Toitoi', '對對和', 'all triplets', '全刻子'],
        ['Sanankou', '三暗刻', 'three concealed triplets', '三組暗刻'], ['Sanshoku Doukou', '三色同刻', 'same triplet in 3 suits', '三種花色相同刻子'],
        ['Sankantsu', '三槓子', 'three kans', '三組槓'], ['Honroutou', '混老頭', 'all terminals & honors', '全是幺九字牌'],
        ['Shousangen', '小三元', 'two dragon triplets + dragon pair', '兩組三元牌刻子 + 三元牌眼'],
      ] },
      { title: ['3+ han', '3 翻以上'], rows: [
        ['Honitsu', '混一色', '3 closed / 2 open', '門清 3 翻／副露 2 翻'], ['Junchan', '純全帶幺九', '3 closed / 2 open', '門清 3 翻／副露 2 翻'],
        ['Ryanpeikou', '二盃口', '3 han, two iipeikou', '3 翻，兩組一盃口'], ['Chinitsu', '清一色', '6 closed / 5 open', '門清 6 翻／副露 5 翻'],
      ] },
      { title: ['Yakuman', '役滿'], rows: [
        ['Kokushi Musou', '國士無雙', 'thirteen orphans', '十三幺'], ['Suuankou', '四暗刻', 'four concealed triplets', '四組暗刻'],
        ['Daisangen', '大三元', 'three dragon triplets', '三組三元牌刻子'], ['Shousuushii / Daisuushii', '小四喜/大四喜', 'little / big four winds', '小／大四喜'],
        ['Tsuuiisou', '字一色', 'all honors', '全字牌'], ['Chinroutou', '清老頭', 'all terminals', '全幺九數牌'],
        ['Ryuuiisou', '綠一色', 'all green', '全綠'], ['Chuuren Poutou', '九蓮寶燈', 'nine gates', '九蓮寶燈'],
        ['Suukantsu', '四槓子', 'four kans', '四組槓'], ['Tenhou / Chiihou', '天和/地和', 'win on the first draw', '起手第一張和牌'],
      ] },
    ],
  },
}

export function RulesHelp({ initial, onClose }: { initial: RuleId; onClose: () => void }) {
  const { lang, t } = useLang()
  const [id, setId] = useState<RuleId>(initial)
  const L = lang === 'zh' ? 1 : 0
  const d = DATA[id]
  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>{t('rulesRef')}</h2>
          <button className="btn sm alt" onClick={onClose}>{t('close')}</button>
        </div>
        <div className="tabs">
          {(['taiwan', 'hk', 'riichi'] as const).map((k) => (
            <button key={k} className={'btn sm ' + (id === k ? 'gold' : 'alt')} onClick={() => setId(k)}>{t(k + '.name')}</button>
          ))}
        </div>
        {d.intro.map((p, i) => <p key={i} className="muted">{p[L]}</p>)}
        {d.sections.map((s) => (
          <div key={s.title[0]}>
            <h2>{s.title[L]}</h2>
            <table className="ref"><tbody>
              {s.rows.map((r, i) => (
                <tr key={i}>
                  <td>{L === 1 ? r[1] : r[0]}{L === 0 && <span className="muted"> {r[1]}</span>}</td>
                  <td>{r[2 + L]}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}
