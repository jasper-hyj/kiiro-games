# Kiiro Games

A collection of browser games for friends, free to play: https://games.jasperhuang.me

| Kind  | Games                                                                                          |
| ----- | ---------------------------------------------------------------------------------------------- |
| Tiles | Mahjong (Taiwanese, Hong Kong, Japanese Riichi with 3 or 4 players, Chinese Official, Sichuan) |
| Cards | Texas Hold'em, Blackjack, Big Two, Crazy Eights, Dou Dizhu, Bridge, Hearts, Spades             |
| Board | Gomoku, Chess, Xiangqi, Go, Checkers, Reversi, Chinese Checkers                                |
| Dice  | Yahtzee, Liar's Dice                                                                           |

Every game has bots and a practice mode, and no sign-in is needed to play casually. Languages: English, 繁體中文, 简体中文 and 日本語.

## Develop

```bash
npm install
npm run dev                  # web app on http://localhost:5173 (practice and same-device modes work on their own)
npm run party:dev            # the server (wrangler dev) on localhost:8787: rooms, tables, accounts
npm run format               # Prettier
npm run check                # types, formatting and the rules tests
```

The server needs the local database once: `npx wrangler d1 migrations apply kiiro-games --local`. For a local admin put `ADMIN_USERS=yourname` in `.dev.vars` (gitignored).

## Layout

```text
src/
  main.tsx, App.tsx, route.ts, i18n.tsx   entry, page addresses (route.ts describes every one), language
  hub/  room/  account/                   the front page, the room where a game is chosen, sign-in / profile / admin
  ui/                                     shared components; styles/ holds colours, controls and table pieces
  net/                                    the socket that reconnects by itself
  games/
    catalog.ts, icons.tsx, strings.ts     the one list of games, their pictograms, every game's text
    frame/                                the shared turn-based frame (see below)
    <game>/                               engine.ts (rules and bot), Board.tsx, strings.ts, styles.css
    trick/                                the table Hearts and Spades share
    holdem/  blackjack/  bigtwo/          engine/, net/, ui/ and the page of each
    mahjong/                              engine/ (tiles, rulesets, bots), net/, ui/
    shared/                               what several card tables use: chat box, practice tables, cash-game contract
party/                                    Cloudflare Worker
  index.ts                                entry: API, WebSocket routes, daily clean-up
  durable/                                main.ts (Mahjong, Hold'em, Blackjack, Big Two tables), room.ts, play.ts (frame games)
  lib/                                    chat and auto-start shared by them
  api.ts  auth.ts  economy.ts  matches.ts  d1.ts
migrations/                               D1 database
scripts/                                  tests by area (generic/, site/, accounts/, one folder per larger game), live/ checks, tools/
```

### The turn-based frame

`src/games/frame/base.ts` (`TurnGame`) gives a game seats with bots, a host, a lobby, spectators, turn timers, reconnect grace, a rematch and a result for the leaderboards. A game only writes its rules (`gomoku/engine.ts` is the smallest example). The same engine runs on the server (`party/durable/play.ts`) and in the browser for practice and same-device play (`frame/client.ts`); `frame/PlayApp.tsx` is the page. Chess and Xiangqi have their own rules engines, checked against the published perft node counts.

To add a game:

1. `src/games/<id>/`: `engine.ts`, `Board.tsx` (importing its `styles.css`), `strings.ts` (English, Chinese and Japanese; the name under the key `<id>`).
2. Add the id to `frame/kinds.ts`, the engine to `frame/registry.ts`, the screen to `frame/boards.ts`.
3. Add an entry to `games/catalog.ts`, an icon to `games/icons.tsx`, the text to `games/strings.ts`, a page title to `src/i18n.tsx`.
4. Add rules tests under `scripts/generic/`; `engine-test.ts` and `layout-check.ts` pick the game up from the lists.

## Addresses

| Address                                        | Page                                                                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/`                                            | hub                                                                                                                    |
| `/room`, `/room/new?game=holdem`, `/room/1234` | create or join, a new room, a room (the invite link)                                                                   |
| `/<game>/1234`, `/<game>/1234?watch=1`         | that room's table (play, or only watch)                                                                                |
| `/<game>/practice`, `/mahjong/tutorial`        | against bots in the browser                                                                                            |
| `/<game>/local`                                | two people on one device: Gomoku, Chess, Xiangqi, Checkers, Reversi, Go, Chinese Checkers, Yahtzee (nothing is hidden) |
| `/admin`, `/admin/users`                       | admin                                                                                                                  |

Older addresses (`/holdem?room=1234&from=room`, `/?solo=1`, ...) are rewritten to these. The API is listed at the top of `party/api.ts`.

## Rooms

"Create a room" opens `/room/1234`. The host chooses the game and its rules; everyone sees the choice live and says whether they will play or watch. On Start the room's server prepares the table through an internal route the Worker refuses from outside, and sends everyone to `/<game>/1234`. The game starts by itself once the room's players are seated (or 6 seconds after the first one sat); competitive tables wait for the host. "Back to room" returns to the same room, which stays findable for 12 hours. Rooms and tables have chat; watchers never see a hand.

## Accounts, chips and admin

Optional sign-in. Guests can play every casual game; nothing is saved for them.

- **Sign-in:** username and password (no email): 3-20 letters, numbers or underscores; passwords 8-72 characters, salted PBKDF2-SHA256; failed logins are rate limited. Google sign-in is optional. There is no self-service reset: an admin sets a temporary password, which signs the player out everywhere.
- **Chips:** play money. Everyone starts a monthly season with 10,000; once a day anyone under 3,000 (counting chips on tables) is topped back up. Every movement is a row in the `ledger` table.
- **Leaderboards:** per game, plus an overall board that scores each result in that game's own stakes (`unit` in `games/catalog.ts`); listed after 3 results. Competitive payouts are zero-sum and bots never move chips. The admin Audit tab lists account pairs whose games keep moving chips one way.
- **History:** every finished game is saved; replay logs are trimmed after 90 days.
- **Admins:** `/admin`. Roles are stored in the database and changed on the Users tab; root admins come from `ADMIN_USERS` (usernames) or `ADMIN_EMAILS` (Google) and cannot be removed there. To make the first admin without them: `UPDATE users SET role='admin' WHERE username='...'`.
- Tunables are at the top of `party/economy.ts`.

## Notes per game

- **Hold'em / Blackjack:** 8 seats. Casual tables use free stacks; cash tables buy in from the season balance and cash out on leaving (a daily alarm brings chips home if a table is evicted). Blackjack: six decks, dealer stands on all 17s, 3:2, double on any two, one split, dealer peeks; a day's net win at cash tables is capped (`BLACKJACK_DAILY_CAP` in `party/durable/main.ts`).
- **Big Two:** 3 low, 2 high; diamonds, clubs, hearts, spades; a straight cannot include a 2; the 3 of diamonds opens.
- **Mahjong:** coach, wait hints, auto-play options, hand review, rulebook with worked examples and a guided tutorial. Debug addresses: `/mahjong/practice?rule=riichi&players=3&speed=0.05`, `?stress=full`, `?tiles=1`. Design notes are in `NOTES.md`.

## Tests

```bash
npm test                 # rules, bots and translations; nothing needs to be running
npm run test:server      # the Worker over HTTP and WebSockets; needs `npm run party:dev`
npm run test:browser     # pages in Chrome; needs the Worker and `npm run dev -- --port 5200`
npm run test:mahjong     # the full Mahjong engine suite (a few minutes)
```

Browser tests use the local Google Chrome through `puppeteer-core`. Registration is limited per address, so `test:server` clears the local `throttle` table before each test. Longer or special checks are run one at a time with `npx tsx scripts/...`, each file says how at the top: card fairness statistics (`site/fairness-test.ts`), playthroughs (`site/playthrough.ts`, `mahjong/playthrough.ts`), screen audits (`tools/layout-audit.ts`, `tools/touch-audit.ts`, `tools/contrast-audit.ts`), and `live/live-e2e.ts`, which starts every game on the deployed site.

## Deploy

**Server (Cloudflare Worker `kiiro-games`):** `npm run party:deploy` deploys and applies the database migrations. If Cloudflare builds it from GitHub, make that the deploy command so migrations run too. Secrets (all optional): `ADMIN_USERS`, `ADMIN_EMAILS`, `GOOGLE_CLIENT_ID` via `npx wrangler secret put <NAME>`.

**Web app (Vercel):** import the repository (Vite preset); `vercel.json` rewrites every path to `index.html`. Set `VITE_PARTYKIT_HOST` to the Worker host without `https://`.
