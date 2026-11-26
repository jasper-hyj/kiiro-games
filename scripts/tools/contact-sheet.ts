import { readdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/tools/contact-sheet.ts <dir> <prefix>   Puts the screenshots in <dir> starting with <prefix> side by side, four to a sheet.
const dir = process.argv[2] || '.'
const prefix = process.argv[3] || 'ux-'
const files = readdirSync(dir)
  .filter((f) => f.startsWith(prefix) && f.endsWith('.png'))
  .sort()
const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--allow-file-access-from-files'],
})
const p = await b.newPage()
await p.setViewport({ width: 1520, height: 720 })
for (let i = 0; i < files.length; i += 4) {
  const { readFileSync } = await import('node:fs')
  const cells = files
    .slice(i, i + 4)
    .map((f) => `<figure><img src="data:image/png;base64,${readFileSync(`${dir}/${f}`).toString('base64')}"><figcaption>${f}</figcaption></figure>`)
    .join('')
  await p.setContent(
    `<style>body{margin:0;background:#222;display:flex;gap:5px}figure{margin:0;width:375px}img{width:375px;display:block}figcaption{color:#fff;font:14px sans-serif;padding:4px}</style>${cells}`,
    { waitUntil: 'load' },
  )
  await p.screenshot({ path: `${dir}/sheet-${prefix}${i / 4}.png` })
  console.log(`${dir}/sheet-${prefix}${i / 4}.png`)
}
await b.close()
