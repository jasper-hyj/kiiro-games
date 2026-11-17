# Kiiro Mahjong — working notes

## What exists
- **Rulesets:** Taiwanese (default, 16 tiles), Hong Kong, Japanese Riichi (4-player and 3-player sanma).
- **Play:** vs bots in the browser, or online rooms (room code / invite link, bots fill empty seats, bots take over after a short grace period when a player drops, late joiners can replace a bot).
- **UI:** light page + green felt table, EN / 繁中, Mahjong Soul-style tiles, call/action panel on the right of the hand, tap a tile twice to discard, auto-win / auto-discard / skip-calls, hints (waits, tiles left, hand value), round history, keyboard shortcuts, quick chat.
- **Table = fixed stage.** The table is laid out once at 1600 x (720..900) design pixels and scaled to the window; on a portrait phone it rotates sideways. Menus/lobby/modals are normal responsive pages.

## Tests (all in `scripts/`)
| command | what it checks |
|---|---|
| `npm test` | scoring / shanten unit tests |
| `npx tsx scripts/win-test.ts` | the whole win flow: ron on a discard, tsumo, double ron, furiten, last discard, flowers, rotation, via Table + UI view |
| `npm run sim -- N rule rounds players` | N full bot-vs-bot games, point conservation |
| `npx tsx scripts/fuzz.ts [scenarios] [seconds]` | random settings × rules × player actions (valid and invalid) × disconnects/rejoins/late joins; checks tile uniqueness, hand sizes, points, hidden-hand leaks |
| `npx tsx scripts/layout-test.ts` | worst-case table (`?stress=full/call/min`) at 200+ window sizes: overlaps, clipping, covered/overlapping buttons |
| `npx tsx scripts/ui-test.ts` | real clicks/taps through every screen on 6 device profiles, EN + 繁中 |
| `npx tsx scripts/online-ui-test.ts` | two browsers: invite link, lobby, start, chat, play, refresh/rejoin (needs vite + `npm run party:dev`) |
| `npx tsx scripts/server-fuzz.ts` | hostile WebSocket client against the real server |
| `npx tsx scripts/game-test.ts` | full games to the game-over screen with real clicks/taps, all rulesets, desktop + touch phone |
| `npx tsx scripts/reconnect-test.ts` | connection trouble in a live room: short drop (keeps seat), long outage (bot takes over), regain control |
| `npx tsx scripts/room-full-test.ts` | five browsers: the 'room is full' screen and way back |
| `npx tsx scripts/bot-strength.ts N [rule]` | Normal vs Easy bot tournament (Normal wins clearly) |

## Results of the last full test pass
- Unit/scoring: 77 checks (every Taiwanese tai and Hong Kong fan item, dora, Riichi match end, win flows).
- Fuzz: ~280k random operations over 24 parallel tables (all rules, 3/4 players, easy/normal, timers on/off, disconnects, late joins, garbage input): no invariant violations after fixes.
- Layout sweep: 1,134 window sizes x worst-case tables x EN/繁中 (+ Riichi/dora tables): no overlaps, clipping, covered or overlapping buttons.
- UI: 192+ real-input checks on 6 device profiles; full games to game-over on desktop and touch phone for all three rulesets; two-browser online play; hostile WebSocket client.

## Known limitations
- **Small phones:** (rotate-table toggle in the Auto menu) the stage scales down, so on a 360px-wide phone tiles are ~20 px (hand) and ~10 px (ponds). Everything is correct and tappable but small. A larger-tile phone layout would need a second design.
- **Server state is in memory.** A Cloudflare Worker restart/redeploy drops running rooms. Players can re-create the room.
- **Deploys:** Vercel deploys on push, and Cloudflare auto-deploy is set up on the owner's account. `npm run party:deploy` stays available for manual deploys.
- **Bots** play sensibly (shanten/ukeire, basic defence, call heuristics) but are not strong; Easy mode adds random mistakes.
- **Taiwanese:** common tai are implemented; rarer bonuses (半求, 地聽/天聽, etc.) are not, because house rules vary.
- **Hong Kong:** no seven pairs / nine gates; limit capped at 13 fan.
- **Riichi:** no pao (liability), no west-round extension, no all-last stop, no kyuushu for sanma, no aka/ura tuning options.
- No spectators; no accounts; no persistence of history across sessions; no sound (by design).
- Hit areas on a scaled stage can be smaller than the 44 px guideline on tiny screens; buttons grow to compensate up to a limit.

## CI / deploys
- `.github/workflows/ci.yml` runs `npm run check` + `npm run build` on every push/PR.
- `.github/workflows/deploy-worker.yml` deploys the Cloudflare Worker; it is manual-only because Cloudflare already auto-deploys; enabling its `push:` trigger as well would deploy twice.
- Vercel redeploys on push by itself.

## Rulesets people ask about (not built)
Chinese Official / Guobiao (MCR, 81 fans), Sichuan "bloody" mahjong (108 tiles, missing suit), Guangdong (ghost/wild tiles), Singapore/Malaysia (HK-like with animals), Shanghai/Nanjing variants, American (NMJL card + jokers).


## Design (Nov 2026 redesign)
- Look: midnight blue / black / silver, ivory tiles with amber caps. Fonts: Italiana (display), Zen Antique (title/glyphs), LXGW WenKai TC (Chinese UI), Instrument Sans (UI), loaded from Google Fonts with system fallbacks. All styling overrides live in `src/parlour.css` (loaded after `styles.css`); the stage layout (sizes/positions) stays in `styles.css`.
- No top bar: menus are full-screen; the table has a corner dock (burger) with auto options, hints, chat, history, shortcuts, language, leave.
- Home is a step-by-step flow (start -> rules -> options -> name; friends skips options, join uses code -> name).
- Table shows essentials only (hints off by default). Call buttons live in a reserved centered row above the hand. Results show headline + hand + scores with a Details toggle. Discard: double-tap or drag a tile upward.
- Tests: `scripts/orient-test.ts` and `scripts/webkit-game-test.ts` run in WebKit/Chromium via Playwright (see their headers); `scripts/flick-test.ts` covers drag-to-discard.

## Added in the Nov 2026 pass
- Rooms persist in Durable Object storage (`party/server.ts`, `Table.serialize/restore`, `Game.serialize/restore`); `scripts/persist-test.ts` and `scripts/restart-test.ts` cover it. Empty rooms are dropped from storage.
- Hand review (replay) after a finished game: `Game.replays` (a public snapshot per discard), shown only when the game is over (`src/ui/Replay.tsx`).
- Accessibility settings: reduce motion, larger text, upright discards (`src/settings.ts`).
- Hard bots: dora/red-five aware, riichi vs dama decision. Measured +246 pts/seat/game against Normal over 150 Riichi games; no measurable gain in Taiwanese/Hong Kong (results there are mostly luck), so Hard behaves like Normal in those.
- Tiles: traditional style (multicolour coins, painted flower emblems, ivory face on a jade back with visible thickness). Centre: compass plate; ponds are six per row, turned toward each seat.
