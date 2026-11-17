# Kiiro Mahjong

Browser mahjong — **Taiwanese (16-tile)**, **Hong Kong** and **Japanese Riichi** (4-player and 3-player sanma) — with English and Traditional Chinese.

- **Play vs bots** in the browser (no server needed), or **online rooms** with an invite link. Empty seats are filled by bots; bots take over if someone drops (after a short grace period) and the player can rejoin; late joiners can replace a bot.
- Mahjong Soul-style helpers: auto-win, auto-discard, skip calls, wait / tiles-left / hand-value hints, round history, keyboard shortcuts, quick chat.
- The table is a fixed-size stage that scales to any window and rotates on a portrait phone, so the layout cannot overlap or clip. Tap a tile twice to discard.
- Riichi extras: dora indicator panel (indicator → dora), dora badges on your tiles, red fives, ura dora, kan dora, nuki (sanma), abortive draws, furiten, kuikae, double ron, West extension and agari-yame.

See [NOTES.md](NOTES.md) for architecture notes, known limitations and the test catalogue.

## Develop

```bash
npm install
npm run dev          # web app on http://localhost:5173 (vs-bots works on its own)
npm run party:dev    # optional: online-rooms server (wrangler dev) on localhost:8787
npm test             # scoring / shanten / dora / match-end unit tests
npm run sim          # bot-vs-bot full games (point conservation, no stuck games)
```

More checks (need the dev server; the browser tests use your local Google Chrome via `puppeteer-core`):

```bash
npx tsx scripts/win-test.ts        # the whole win flow (ron on a discard, tsumo, double ron, furiten, …)
npx tsx scripts/fuzz.ts 24 60      # randomized chaos: any rule/settings/player action/disconnect
npx tsx scripts/layout-test.ts     # worst-case table at hundreds of window sizes (overlap/clipping/clickability)
npx tsx scripts/ui-test.ts         # real clicks and taps through every screen, 6 device sizes, EN + 繁中
npx tsx scripts/game-test.ts       # full games to the game-over screen with real input
npx tsx scripts/online-ui-test.ts  # two browsers: invite link, lobby, play, chat, refresh/rejoin (needs party:dev)
npx tsx scripts/room-full-test.ts  # five browsers, "room is full" flow (needs party:dev)
npx tsx scripts/server-fuzz.ts     # hostile WebSocket client against the real server (needs party:dev)
```

Debug URLs: `/?solo=1&rule=riichi&players=3&speed=0.05` starts a solo game straight away (fast bots); `/?stress=full|call|min[&rule=riichi]` renders a worst-case table; `/?tiles=1` shows every tile.

## Deploy

### 1. Online server (Cloudflare Workers + PartyServer)

Only needed for online rooms.

```bash
npx wrangler login
npm run party:deploy
# prints a URL like https://kiiro-mahjong.<you>.workers.dev
```

A `git push` does **not** redeploy the Worker. Run `npm run party:deploy` again after changing `src/engine`, `src/net` or `party/` (or enable *Workers Builds* in the Cloudflare dashboard to deploy on push).

### 2. Web app (Vercel)

1. Import the Git repo in Vercel (framework preset: Vite, auto-detected), or run `npx vercel`.
2. Add the environment variable `VITE_PARTYKIT_HOST` = your Worker host without `https://`, e.g. `kiiro-mahjong.<you>.workers.dev`.
3. Deploy. Vercel redeploys on every push. Vs-bots mode works even without step 1.

## Layout

```text
src/engine   game logic: tiles, hand analysis, 3 rulesets, game state machine, bots, table host
src/net      client connections (in-browser table / PartyServer socket) + protocol
src/ui       React components (Stage, Board, Lobby, panels, tiles)
party        PartyServer / Cloudflare Worker (wraps the same Table class)
scripts      tests, simulations and browser test harnesses
```

Adding a ruleset = a new file in `src/engine/rules/` exporting a `RuleSet` (`evaluate` + `settle`).
