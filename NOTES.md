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
- **Cloudflare is not auto-deployed by `git push`** — run `npm run party:deploy` after engine/server changes (or enable Workers Builds in the Cloudflare dashboard). Vercel deploys on push.
- **Bots** play sensibly (shanten/ukeire, basic defence, call heuristics) but are not strong; Easy mode adds random mistakes.
- **Taiwanese:** common tai are implemented; rarer bonuses (半求, 地聽/天聽, etc.) are not, because house rules vary.
- **Hong Kong:** no seven pairs / nine gates; limit capped at 13 fan.
- **Riichi:** no pao (liability), no west-round extension, no all-last stop, no kyuushu for sanma, no aka/ura tuning options.
- No spectators; no accounts; no persistence of history across sessions; no sound (by design).
- Hit areas on a scaled stage can be smaller than the 44 px guideline on tiny screens; buttons grow to compensate up to a limit.

## CI / deploys
- `.github/workflows/ci.yml` runs `npm run check` + `npm run build` on every push/PR.
- `.github/workflows/deploy-worker.yml` deploys the Cloudflare Worker; it is manual-only until you add `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets and enable its `push:` trigger.
- Vercel redeploys on push by itself.

## Rulesets people ask about (not built)
Chinese Official / Guobiao (MCR, 81 fans), Sichuan "bloody" mahjong (108 tiles, missing suit), Guangdong (ghost/wild tiles), Singapore/Malaysia (HK-like with animals), Shanghai/Nanjing variants, American (NMJL card + jokers).
