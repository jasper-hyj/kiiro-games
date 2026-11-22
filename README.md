# Kiiro Games

Small browser games for friends and clubs, free to play.

| game | address | status |
|---|---|---|
| **Kiiro Mahjong** | `/mahjong` | playable by anyone, no sign-in: Taiwanese, Hong Kong, Japanese Riichi (4 and 3 players), Chinese Official, Sichuan; English, 繁中, 简中, 日本語 |
| Texas Hold'em | – | planned |

`/` is the hub (game picker). Old Mahjong links such as `/?room=1234` and `/?solo=1` still open the game.

## Mahjong in short
- **Play** online with an invite link / 4-digit room code; empty seats are bots. Without a game server the same Play button runs a game against bots in the browser.
- Coach, wait hints, auto-win / auto-discard / skip, round history, hand review, rulebook with 69 worked examples, a 10-lesson guide.
- Works on desktop, tablets and phones (landscape and upright).

## Layout

```text
src/main.tsx, App.tsx     entry; App shows the hub at "/" and a game otherwise
src/hub/                  the game picker page
src/i18n.tsx, simplify.ts language state (EN / 繁中 / 简中 / 日本語); each game registers its own strings
src/route.ts              which page the address means
src/games/mahjong/        everything Mahjong
  engine/                   tiles, hand analysis, rulesets (rules/), game state machine, bots, table host
  net/                      in-browser table / PartyServer socket + protocol
  ui/                       Board, Lobby, result card, rulebook, guide, tiles, stage
  *.css, strings*.ts        styles and texts of the game
party/                    Cloudflare Worker (PartyServer) that hosts the rooms
scripts/mahjong/          tests, simulations and browser harnesses for Mahjong
```

A new game = a new folder under `src/games/` (and `scripts/<game>/`), a card on the hub and a route in `src/route.ts` / `src/App.tsx`.

## Develop

```bash
npm install
npm run dev            # web app on http://localhost:5173 (/ = hub, /mahjong = the game; vs-bots works on its own)
npm run party:dev      # optional: online-rooms server (wrangler dev) on localhost:8787
npm test               # Mahjong scoring / shanten / dora unit tests
npm run test:mahjong   # the whole engine test suite (a few minutes)
```

Browser tests use your local Google Chrome through `puppeteer-core` and need `npm run dev`; the online ones also need `npm run party:dev`. See `scripts/mahjong/` (for example `overlap-audit.ts`, `game-test.ts`, `online-test.ts`).

Debug URLs: `/?solo=1&rule=riichi&players=3&speed=0.05` starts a solo game (fast bots); `/?stress=full|call|min[&rule=riichi]` renders a worst-case table; `/?tiles=1` shows every tile.

## Deploy

### 1. Online server (Cloudflare Workers + PartyServer)
Only needed for online rooms.

```bash
npx wrangler login
npm run party:deploy
# prints a URL like https://kiiro-games.<you>.workers.dev
```

The Worker is named `kiiro-games` (`wrangler.jsonc`). Renaming a Worker creates a new one with an empty set of rooms; update `VITE_PARTYKIT_HOST` afterwards. Without Cloudflare *Workers Builds*, a `git push` does not redeploy the Worker: run `npm run party:deploy` after changing `src/games/mahjong/engine`, `src/games/mahjong/net` or `party/`.

### 2. Web app (Vercel)
1. Import the Git repo in Vercel (framework preset: Vite) or run `npx vercel`. `vercel.json` rewrites every path to `index.html`, which `/mahjong` needs.
2. Environment variable `VITE_PARTYKIT_HOST` = your Worker host without `https://`, e.g. `kiiro-games.<you>.workers.dev`.
3. Add the domain (for example `games.<your-domain>`) in the Vercel project and point its DNS record at Vercel.
4. Optional: make the old address redirect to `https://games.<your-domain>/mahjong` (Vercel → Domains → Redirect) so existing links keep working.
