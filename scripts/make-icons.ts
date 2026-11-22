// Run: npx tsx scripts/make-icons.ts   Renders public/favicon.svg into the PNG icons and the share image.
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'
const svg = readFileSync('public/favicon.svg')
for (const [file, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]] as const) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(`public/${file}`)
}
const icon = await sharp(svg, { density: 384 }).resize(300, 300).png().toBuffer()
const og = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0b1020"/>
  <text x="440" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="84" letter-spacing="14" fill="#e8ecf6">KIIRO GAMES</text>
  <text x="444" y="370" font-family="Helvetica, Arial, sans-serif" font-size="32" fill="#8e97b0">Games for friends and clubs.</text>
  <rect x="444" y="420" width="64" height="6" fill="#f5c518"/></svg>`)
await sharp(og).composite([{ input: icon, left: 100, top: 165 }]).png().toFile('public/og.png')
writeFileSync('public/manifest.webmanifest', JSON.stringify({ name: 'Kiiro Games', short_name: 'Kiiro', start_url: '/', display: 'standalone', background_color: '#0b1020', theme_color: '#0b1020', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] }, null, 2) + '\n')
console.log('icons written')
