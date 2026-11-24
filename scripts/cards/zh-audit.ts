// Run: npx tsx scripts/cards/zh-audit.ts   Every Traditional Chinese string must be written in Traditional characters.
// Finds Simplified-only characters in the zh text of every registered string (and in the page titles of src/i18n.tsx).
import { readFileSync } from 'node:fs'
import { allStrings } from '../../src/i18n'
import '../../src/games/mahjong/strings'
import '../../src/games/mahjong/strings.ja'
import '../../src/hub/strings'
import '../../src/account/strings'
import '../../src/games/holdem/strings'
import '../../src/games/blackjack/strings'
import '../../src/games/bigtwo/strings'
import '../../src/room/strings'
import '../../src/games/generic/strings'
import '../../src/games/generic/gomokuStrings'
import '../../src/games/generic/crazyStrings'
import '../../src/games/generic/yahtzeeStrings'
import '../../src/games/generic/liarsStrings'

// the converter's own table (Traditional -> Simplified) gives every Simplified character that differs from its Traditional form
const src = readFileSync('src/simplify.ts', 'utf8')
const pairs = /const PAIRS = '([^']+)'/.exec(src)![1]
const simp = new Set<string>(), trad = new Set<string>()
for (let i = 0; i < pairs.length; i += 2) { trad.add(pairs[i]); if (pairs[i + 1] !== pairs[i]) simp.add(pairs[i + 1]) }
// Simplified forms the converter does not know yet, so the audit does not depend on its coverage
const MORE = '这个们为说话时来对点开关发现还没间问题体验记录设选择确认请给让从实际应该动机号码终结继续赢输筹赛战队时钟湾风华龙马鸟鱼车长门见觉观书买卖写读认识词语课师学样总结构类别线红绿蓝灭热岁乐众优伤兰农军冲刘务动劳势区医协单卫厂历压县参双变叶员团园围圣场坏块坚报声处够头夹夺奋奖妇妈带帮广庆库应开张弹强当录态怀惊扑执扩扫择换据摆摇数无旧显晓暂术杀杂条栋标档桥梦检楼欢气汇汉沟泪泽浅测济浏游湿满炉烟爱爷牵犹猪猫献环现玛画异疗盏盘监盖盟着睁矿确礼祸禅离种积称窃竞笔笼筑签简粮紧级纪纤约纯纲纳纵纷纸练组细终绍经结绕绘络绝统继绩续维综缘缩编缓网罗职联聪肃脑脚脸腊艰艺节芦苏苹范获营药虑虫蚀补装规视览计订讨训议讲许论访证评诉译试该详误诸谁调谈谢谱谷贝负贡财责贤败货质贩贪购贯贴贵贷费贺资赏赔赖赚赞赠赵趋跃踪轨转轮软轰轻载较辅辈辉辑辞边辽达迁过迈运还进远连迟适选递逻遗邓邮邻郑酱释针钉钓钢钥钱钻铁铃铜银链销锁锅锋错锡锦键锻镇镜闪闭闯闲闷闸闹阅阳阴阵阶际陆陈险随隐难雾静颗领颜飞饭饮饰饱馆驱驶驻驾验骑骗骤鲜鸡鸭鸿鹅鹰麦黄齐齿龄'
for (const c of MORE) if (!trad.has(c)) simp.add(c)
// characters that are the same in both scripts must never be flagged
const SHARED = '台系面云干只表复里制'
for (const c of SHARED) simp.delete(c)

const { D } = allStrings()
let bad = 0
const scan = (label: string, text: string) => {
  const hits = [...new Set([...text].filter((c) => simp.has(c)))]
  if (hits.length) { bad++; console.log(`FAIL ${label}: ${hits.join('')}  <- ${text.slice(0, 70)}`) }
}
for (const [k, v] of Object.entries(D)) scan(k, v[1] ?? '')
const i18n = readFileSync('src/i18n.tsx', 'utf8')
for (const m of i18n.matchAll(/\[\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'\s*\]/g)) scan('title ' + m[1], m[2]) // [en, 繁, 简, ja]
// any other [English, Traditional Chinese, ...] pair in the source (rule descriptions, examples, help pages ...): scan the Chinese slot only
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) ? [p] : [] })
let others = 0
const PAIR = /\[\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'(?:\s*,\s*'((?:[^'\\]|\\.)*)')?\s*\]/g
for (const f of walk('src')) {
  if (/\.ja\.ts$|simplify\.ts$|i18n\.tsx$/.test(f)) continue
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(PAIR)) {
    if (!/[\u4e00-\u9fff]/.test(m[2])) continue
    const hits = [...new Set([...m[2]].filter((c) => simp.has(c)))]
    if (hits.length) { others++; const line = text.slice(0, m.index).split('\n').length; console.log(`FAIL ${f}:${line}: ${hits.join('')}  <- ${m[2].slice(0, 60)}`) }
  }
}
bad += others
console.log(`${Object.keys(D).length} strings checked; ${bad ? bad + ' contain Simplified characters' : 'all Traditional'}`)
process.exit(bad ? 1 : 0)
