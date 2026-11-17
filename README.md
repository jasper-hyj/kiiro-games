# Kiiro Mahjong

Browser mahjong with **Japanese Riichi**, **Hong Kong** and **Taiwanese (16-tile)** rules.

- **Play vs bots** — runs fully in the browser, no server needed.
- **Online rooms** — share a room code; bots fill empty seats and take over if someone disconnects (they can rejoin). The game runs on an authoritative PartyKit server, so clients only ever see their own hand.
- Mahjong Soul-style helpers: auto-win, auto-discard, skip calls, wait/shanten hints.

## Develop

```bash
npm install
npm run dev          # web app on http://localhost:5173 (vs-bots mode works on its own)
npm run party:dev    # optional: online-rooms server (wrangler dev) on localhost:8787
npm test             # scoring/shanten unit tests
npm run sim          # bot-vs-bot full-game simulation (rules sanity check)
```

## Deploy

**1. Online server (Cloudflare Workers + PartyServer)** — only needed for online rooms. (The hosted PartyKit platform shut down in Oct 2026; this uses PartyServer on your own Cloudflare account.)

```bash
npx wrangler login
npm run party:deploy
# prints a URL like https://kiiro-mahjong.<you>.workers.dev
```

**2. Web app (Vercel)**:

1. Push this folder to a Git repo and import it in Vercel (framework preset: Vite, auto-detected), or run `npx vercel`.
2. Add the environment variable `VITE_PARTYKIT_HOST` = your Worker host (no `https://`), e.g. `kiiro-mahjong.<you>.workers.dev`.
3. Deploy. Vs-bots mode works even without step 1.

## Layout

```
src/engine   pure game logic: tiles, hand analysis, 3 rulesets, game state machine, bots, table host
src/net      client connections (local in-browser table / PartyKit socket) + protocol
src/ui       React components
party        PartyServer / Cloudflare Worker (wraps the same Table class)
scripts      tests and simulation
```

Adding a ruleset = a new file in `src/engine/rules/` exporting a `RuleSet` (`evaluate` + `settle`).
