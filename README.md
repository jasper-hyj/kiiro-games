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

## Accounts, chips and admin

Optional sign-in for the whole site. Guests can still play every casual game; nothing is saved for them.

- **Sign-in:** username + password (no email needed): usernames are 3-20 letters, numbers or underscores; passwords 8-72 characters, stored as salted PBKDF2-SHA256. Failed logins are rate limited per username and per IP. Google sign-in is an optional extra. Sessions are bearer tokens kept in localStorage. There is no self-service reset: an admin sets a temporary password from the Users tab, which also signs the player out everywhere. Players can change their own password from their profile.
- **Chips:** play money, no cash value. Everyone starts a season with 10,000. A daily floor tops anyone under 2,000 back up. Veterans get a small start bonus capped at 10%. Every movement is a row in the `ledger` table.
- **Seasons:** monthly (`YYYY-MM`). The leaderboard ranks season *profit* (grants excluded), so a newcomer's first good session already counts. Lifetime games and level stay.
- **Ranked Mahjong:** the host switches a room to Ranked. It needs 2+ players, all signed in; chips move zero-sum between them at game end. Bots and guests never move chips. Casual rooms and practice never touch chips.
- **History:** every finished game is saved (summary, per-seat results, replay log; replays are trimmed after 90 days by a daily cron).
- **Admin:** `/admin`, for usernames listed in `ADMIN_USERS` (or Google emails in `ADMIN_EMAILS`): overview, users (ban, rename, grant chips), matches, ledger, and an audit that flags balance/ledger drift.
- Tunables live at the top of `party/economy.ts`.

### Set it up

```sh
npx wrangler secret put ADMIN_USERS             # comma-separated usernames, e.g. jasper
npx wrangler secret put GOOGLE_CLIENT_ID        # optional: OAuth web client; add the site origin as an authorised JavaScript origin
npx wrangler secret put ADMIN_EMAILS            # optional: admin Google accounts
npm run party:deploy   # deploys; wrangler creates the D1 database on the first deploy (no id needed), then applies the migrations
```

If the Worker is built by Cloudflare from GitHub, set the deploy command to `npm run party:deploy` so the migrations run too.

For local work put `ADMIN_USERS=yourname` in `.dev.vars` (gitignored). Local database: `npx wrangler d1 migrations apply kiiro-games --local`. Tests: `npx tsx scripts/accounts/auth-test.ts` (needs `wrangler dev`; clear the `throttle` table between many runs, registration is limited to 10 per hour per IP), `npx tsx scripts/accounts/economy-test.ts` (stop `wrangler dev` first) and `ranked-ws-test.ts` (needs `wrangler dev`).

## Texas Hold'em

`/holdem`, 2 to 6 players, no bots. Room codes are shared with Mahjong: the first player to create a code decides its game, and joining a code from the other game's page redirects to the right one (the hub has one "room code" box for everything).

- **Casual tables:** free temporary stacks, guests welcome, nothing saved.
- **Cash tables:** need an account. The buy-in (20 to 100 big blinds) comes off the season balance as a ledger `hold`; leaving returns the stack and the difference is booked as profit (`play:holdem`). A daily alarm and a 60 s disconnect grace make sure chips come home even if the room object is evicted. Each hand is saved as a match.
- **Engine:** `src/games/holdem/engine` (evaluator, betting rounds, side pots, timers). `npm run test:holdem` includes a fuzz test that checks chips are conserved. `scripts/holdem/ws-test.ts` plays casual and cash tables over WebSockets (needs `wrangler dev`).
- Not built yet: chat at the table, tournaments.

## Blackjack

`/blackjack`, 1 to 6 players at a shared table against the dealer. Six-deck shoe, dealer stands on all 17s, blackjack pays 3:2, double on any two cards, one split (split aces get one card each), dealer peeks for a natural, no insurance. Casual tables are free; cash tables bet from a ledger buy-in exactly like Hold'em. Because the house is not a player, a day's net profit at cash tables is capped (`BLACKJACK_DAILY_CAP` in `party/server.ts`, 20,000): anything above it is not paid out when the player leaves. Engine tests: `npm run test:blackjack`.

## Big Two

`/bigtwo`, four players, bots fill empty seats. 3 is lowest, 2 highest; suits low to high diamonds, clubs, hearts, spades (`SUIT_POWER` in `src/games/bigtwo/engine/combos.ts`). Singles, pairs, triples and the five-card hands; a straight cannot include a 2. The 3 of diamonds opens. A game is one deal: the first to go out wins, others pay 1 point per card left (x2 from 8 cards, x3 from 10, x4 for all 13). Ranked rooms settle 50 chips per point, zero-sum between the signed-in humans (bots never move chips). Engine tests: `npm run test:bigtwo`.

All chip games share one room-code space; `src/games/shared/cash.ts` is the contract a new table game implements.

## Checks for the card games

- `npm run check` runs the type check plus the Mahjong, Hold'em, Blackjack and Big Two engine tests.
- `npm run test:cards` runs the statistical checks (shuffle uniformity, seven-card hand frequencies against the exact values, pocket aces equity, blackjack basic strategy against the known house edge of about -0.5%, even seat wins at Hold'em, fair Big Two deals) and the disconnect/timeout tests.
- With `wrangler dev` (:8787) and `vite --port 5200` running: `scripts/cards/layout-audit.ts` (244 screens over 19 phone, tablet and desktop sizes; `ONLY=390x844 ...` narrows it), `scripts/cards/talk-test.ts` (chat), `scripts/cards/collision-test.ts` (room codes shared between games), `scripts/cards/practice-test.ts` (offline practice, needs only vite), and the `ws-test.ts` in each game's folder (real tables over WebSockets, with the ledger audit).
- `scripts/cards/i18n-audit.ts` checks every text key exists in English, Chinese and Japanese.

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
