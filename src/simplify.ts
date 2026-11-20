/** Simplified Chinese: the Traditional text of the app is converted on screen, character by character.
 *  (Tile faces are left alone: 萬 is the same tile name in both scripts.) */
const PAIRS = '來来價价優优內内兩两剛刚動动勝胜區区單单嗎吗啟启員员問问國国場场報报學学實实寶宝對对將将屬属嶺岭帶带幫帮幾几廳厅張张強强後后從从態态應应戰战戲戏數数斷断於于時时暫暂暱昵會会東东標标樣样機机橫横檔档檢检檻槛歡欢歸归氣气決决沒没況况湊凑準准滿满漢汉灣湾為为無无牆墙狀状獨独獲获現现畫画當当疊叠發发盡尽盤盘確确碼码礎础種种稱称積积節节範范簡简紀纪約约紅红純纯細细紹绍終终組组結结絕绝給给統统經经綠绿網网線线練练總总繼继續续羅罗習习聽听腦脑與与莊庄萬万蘭兰處处號号虧亏裏里補补裡里製制複复見见規规親亲計计訊讯託托設设許许訴诉試试該该詳详認认語语誤误說说誰谁課课調调請请論论謝谢證证識识議议讀读變变讓让豬猪負负貫贯賽赛贏赢輪轮輸输轉转這这連连進进遊游過过達达違违遠远選选還还邊边釘钉釣钓鈕钮鉤钩錄录錯错鍵键長长門门閉闭開开閒闲間间關关際际隨随險险雙双離离難难電电頁页項项順顺須须預预頭头題题額额類类顧顾顯显風风餘余騎骑驗验體体魚鱼鳥鸟鳴鸣麼么點点齊齐龍龙係系個个備备側侧則则慣惯採采換换搶抢撈捞擇择攤摊棄弃榮荣槍枪槓杠燈灯異异盃杯蓮莲薦荐藍蓝響响較较別别捨舍並并'
const MAP = new Map<string, string>()
for (let i = 0; i < PAIRS.length; i += 2) MAP.set(PAIRS[i], PAIRS[i + 1])

export const toSimplified = (s: string) => { let out = ''; for (const ch of s) out += MAP.get(ch) ?? ch; return out }

const SKIP = 'script, style, textarea, input, .tile, svg' // no text conversion inside these
const NOATTR = '.tile, svg' // (attributes such as placeholder and aria-label are still converted on inputs)
const ATTRS = ['title', 'aria-label', 'placeholder']
const originals = new Map<WeakRef<Text>, string>()
const textOf = new WeakMap<Text, { orig: string; conv: string }>()
const attrOf = new WeakMap<Element, Record<string, { orig: string; conv: string }>>()
const tracked = new Set<WeakRef<Element>>()
let observer: MutationObserver | null = null
let running = false

function convertText(n: Text) {
  const el = n.parentElement
  if (!el || el.closest(SKIP)) return
  const cur = n.data
  const known = textOf.get(n)
  if (known && known.conv === cur) return // our own change
  const conv = toSimplified(cur)
  if (conv === cur) { textOf.delete(n); return }
  if (!known) originals.set(new WeakRef(n), cur)
  textOf.set(n, { orig: cur, conv })
  n.data = conv
}
function convertAttrs(el: Element) {
  if (el.closest(NOATTR)) return
  for (const a of ATTRS) {
    const v = el.getAttribute(a)
    if (!v) continue
    const rec = attrOf.get(el) ?? {}
    if (rec[a] && rec[a].conv === v) continue
    const conv = toSimplified(v)
    if (conv === v) { delete rec[a]; continue }
    rec[a] = { orig: v, conv }
    attrOf.set(el, rec)
    tracked.add(new WeakRef(el))
    el.setAttribute(a, conv)
  }
}
function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { convertText(root as Text); return }
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const el = root as Element
  convertAttrs(el)
  if (el.matches(SKIP)) return
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let n: Node | null
  while ((n = tw.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) convertText(n as Text)
    else convertAttrs(n as Element)
  }
}

export function startSimplify() {
  if (running) return
  running = true
  walk(document.body)
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') convertText(m.target as Text)
      else if (m.type === 'attributes') convertAttrs(m.target as Element)
      else m.addedNodes.forEach((n) => walk(n))
    }
  })
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS })
}

export function stopSimplify() {
  if (!running) return
  running = false
  observer?.disconnect(); observer = null
  for (const ref of originals.keys()) {
    const n = ref.deref()
    const rec = n && textOf.get(n)
    if (n && rec && n.data === rec.conv) n.data = rec.orig
  }
  originals.clear()
  for (const ref of tracked) {
    const el = ref.deref()
    const rec = el && attrOf.get(el)
    if (el && rec) for (const [a, v] of Object.entries(rec)) if (el.getAttribute(a) === v.conv) el.setAttribute(a, v.orig)
  }
  tracked.clear()
}
