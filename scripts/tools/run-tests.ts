/**
 * Runs a group of test scripts one after another and says which failed.
 *   npm run test            rules and bots; needs nothing running
 *   npm run test:server     the Worker; needs `npm run party:dev` (:8787)
 *   npm run test:browser    pages in Chrome; needs the Worker and `npm run dev -- --port 5200`
 */
import { spawnSync } from 'node:child_process'

const SUITES: Record<string, string[]> = {
  engine: [
    'generic/engine-test',
    'generic/more-test',
    'generic/chess-test',
    'generic/xq-test',
    'generic/dd-test',
    'generic/bridge-test',
    'mahjong/test',
    'mahjong/win-test',
    'holdem/engine-test',
    'blackjack/engine-test',
    'bigtwo/engine-test',
    'tools/i18n-audit',
    'tools/zh-audit',
  ],
  server: [
    'generic/play-test',
    'site/room-test',
    'site/talk-test',
    'site/watch-test',
    'site/relaunch-test',
    'accounts/authz-test',
    'accounts/economy-test',
    'holdem/ws-test',
    'bigtwo/ws-test',
    'blackjack/ws-test',
    'mahjong/room-test',
  ],
  browser: ['site/room-e2e', 'site/url-test', 'site/codebox-test', 'site/reconnect-test', 'generic/local-test', 'generic/layout-check'],
}

const name = process.argv[2] || 'engine'
const suite = SUITES[name]
if (!suite) {
  console.log(`unknown suite "${name}" (${Object.keys(SUITES).join(', ')})`)
  process.exit(1)
}
const failed: string[] = []
for (const test of suite) {
  const started = Date.now()
  const run = spawnSync('npx', ['tsx', `scripts/${test}.ts`], { encoding: 'utf8', env: { GAMES: '5', ...process.env } })
  const ok = run.status === 0 && !/^FAIL /m.test(run.stdout)
  console.log(`${ok ? 'pass' : 'FAIL'}  ${test}  (${Math.round((Date.now() - started) / 1000)}s)`)
  if (!ok) {
    failed.push(test)
    console.log(
      (run.stdout + run.stderr)
        .split('\n')
        .filter((line) => /FAIL|Error|TIMEOUT/.test(line))
        .slice(0, 8)
        .join('\n'),
    )
  }
}
console.log(failed.length ? `\n${failed.length} of ${suite.length} failed: ${failed.join(', ')}` : `\nall ${suite.length} passed`)
process.exit(failed.length ? 1 : 0)
