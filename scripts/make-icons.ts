// Run: npx tsx scripts/make-icons.ts   Renders public/favicon.svg into the PNG icons and the share image.
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'
const svg = readFileSync('public/favicon.svg')
for (const [file, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]] as const) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(`public/${file}`)
}
// Safari does not use the SVG icon for tabs: give it real PNGs and a favicon.ico (the file browsers ask for by default)
const pngs: Buffer[] = []
for (const n of [16, 32, 48]) { const b = await sharp(svg, { density: 384 }).resize(n, n).png().toBuffer(); pngs.push(b); if (n !== 48) writeFileSync(`public/favicon-${n}.png`, b) }
const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4)
let offset = 6 + 16 * pngs.length
const dir = pngs.map((b, i) => { const e = Buffer.alloc(16); const n = [16, 32, 48][i]; e[0] = n; e[1] = n; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(b.length, 8); e.writeUInt32LE(offset, 12); offset += b.length; return e })
writeFileSync('public/favicon.ico', Buffer.concat([head, ...dir, ...pngs]))
const icon = await sharp(svg, { density: 384 }).resize(300, 300).png().toBuffer()
const og = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#ece3cf"/>
  <text x="440" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="84" letter-spacing="14" fill="#3a3025">KIIRO GAMES</text>
  <text x="444" y="370" font-family="Helvetica, Arial, sans-serif" font-size="32" fill="#7a6d5a">A collection of games</text>
  <rect x="444" y="420" width="64" height="6" fill="#a9552f"/></svg>`)
await sharp(og).composite([{ input: icon, left: 100, top: 165 }]).png().toFile('public/og.png')
writeFileSync('public/manifest.webmanifest', JSON.stringify({ name: 'Kiiro Games', short_name: 'Kiiro', start_url: '/', display: 'standalone', background_color: '#ece3cf', theme_color: '#ece3cf', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] }, null, 2) + '\n')
console.log('icons written')
