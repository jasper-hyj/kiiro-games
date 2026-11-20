import puppeteer from 'puppeteer-core'

/** Simplified Chinese: visit the screens, collect every Chinese character on screen outside the tiles, and report any that is still Traditional. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const seen = new Map<string, string>()
const collect = (p: any, where: string) => p.evaluate(() => {
  const out: string[] = []
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n: Node | null
  while ((n = tw.nextNode())) { if ((n.parentElement as HTMLElement | null)?.closest('.tile, svg, script, style')) continue; out.push(n.textContent ?? '') }
  for (const e of document.querySelectorAll('[title],[aria-label],[placeholder]')) for (const a of ['title', 'aria-label', 'placeholder']) { const v = e.getAttribute(a); if (v) out.push(v) }
  return out.join('')
}).then((txt: string) => { for (const ch of txt) if (/[一-鿿]/.test(ch) && !seen.has(ch)) seen.set(ch, where) })
const click = (p: any, s: string) => p.evaluate((x: string) => (document.querySelector(x) as HTMLElement | null)?.click(), s)
const open = async (url: string, w = 1280, h = 800) => {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h })
  await p.evaluateOnNewDocument(() => { localStorage.setItem('kiiro-lang', 'zh'); localStorage.setItem('kiiro-zhs', '1'); (window as any).__name = (f: unknown) => f })
  await p.goto('http://localhost:5199' + url, { waitUntil: 'networkidle0' }); await sleep(700); return p
}
let p = await open('/'); await collect(p, 'home')
console.log('title:', await p.title(), '| html lang:', await p.evaluate(() => document.documentElement.lang))
await click(p, '.btn.gold.big'); await sleep(500); await collect(p, 'rules step')
await p.evaluate(() => (document.querySelectorAll('button.rule')[2] as HTMLElement).click()); await sleep(500); await collect(p, 'options')
await click(p, '.btn.gold.big'); await sleep(500); await collect(p, 'name')
await p.close()
for (const [url, where] of [['/?stress=lobby&rule=riichi', 'lobby'], ['/?stress=full&players=4&rule=riichi&hint=1', 'table'], ['/?stress=call&players=4&rule=taiwan', 'calls'], ['/?stress=full&players=4&rule=sichuan', 'sichuan'], ['/?stress=min&players=4&rule=hk&idle=auto', 'idle']] as const) { p = await open(url); await collect(p, where); await p.close() }
p = await open('/')
await p.evaluate(() => { for (const x of [...document.querySelectorAll('.rulesfab')] as HTMLElement[]) if (/📖/.test(x.textContent ?? '')) { x.click(); break } }); await sleep(400)
for (let i = 0; i < 6; i++) { await p.evaluate((n: number) => (document.querySelectorAll('.tabs button')[n] as HTMLElement | undefined)?.click(), i); await sleep(200); await collect(p, 'rulebook ' + i) }
await p.close()
p = await open('/')
await p.evaluate(() => { for (const x of [...document.querySelectorAll('.rulesfab')] as HTMLElement[]) if (/🎓/.test(x.textContent ?? '')) { x.click(); break } }); await sleep(400)
for (let i = 0; i < 10; i++) { await p.evaluate((n: number) => (document.querySelectorAll('.gstep')[n] as HTMLElement | undefined)?.click(), i); await sleep(120); await collect(p, 'guide ' + (i + 1)) }
await p.close()
await b.close()
// characters that exist only in Traditional script (a sample of the common ones): none may remain on screen
const TRAD = '來價優內兩剛動勝區單嗎啟員問國場報學實寶對將屬帶幫幾廳張強後從態應戰戲數斷於時暫會東標樣機橫檔檢歡歸氣決沒況湊準滿漢灣為無牆狀獨獲現畫當疊發盡盤確碼礎種稱積節範簡紀約紅純細終組結絕給統經綠網線練總繼續羅習聽腦與莊萬蘭處號虧裏補裡製複見規親計訊託設許訴試該詳認語誤說誰課調請論謝證識議讀變讓豬負貫賽贏輪輸轉這連進遊過達違遠選還邊釘釣鈕鉤錄錯鍵長門閉開閒間關際隨險雙離難電頁項順須預頭題額類顧顯風餘騎驗體魚鳥鳴麼點齊龍係個備側則慣採換搶撈擇攤棄榮槍槓燈異盃蓮薦藍響較別捨並暱'
const left = [...seen.entries()].filter(([ch]) => TRAD.includes(ch))
console.log(`${seen.size} different Chinese characters shown; Traditional ones left: ${left.length ? left.map(([c, w]) => c + '(' + w + ')').join(' ') : 'none'}`)
console.log('all characters shown:', [...seen.keys()].sort().join(''))
process.exit(left.length ? 1 : 0)
