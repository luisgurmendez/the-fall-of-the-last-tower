# Deploy (playing online)

Retro League runs on one machine: the Bun game server serves the built client and its
WebSocket from the same address, so players only need a link.

## How the server serves the game

- `vite build` builds the client into `dist/`.
- With `STATIC_DIR` set, `BunWebSocketServer` serves that folder over HTTP (`/` is
  `index.html`; paths can't leave the folder; Vite's hashed assets are cached for a year,
  pages not), and the WebSocket stays at `/ws`. Without it (local development) the server
  only answers the socket, `/health` and `/metrics`.
- A production build connects to `wss://<its own address>/ws` (`getServerUrl` in
  `src/index.ts`); `?server=` or `VITE_WS_URL` override it. In development the client (Vite
  on :3000/:3100) connects to `ws://localhost:8080/ws`.
- Ability icons are bundled by Vite (`abilityIconUrl` in `src/ui/AbilityIconLoader.ts`); the
  art and sounds come from `public/`, which isn't in git but goes into the build context.

## Docker and Fly.io

- `Dockerfile`: installs with Bun, builds `@siege/shared` (the server imports its `dist/`),
  builds the client, and runs `bun run src/server.ts` from `packages/server` with
  `STATIC_DIR=/app/dist`.
- `.dockerignore` keeps out **`.env*` (the PixelLab and ElevenLabs keys)**, `deploy/` (the old
  EC2 deploy and its private key), `.git`, `.claude`, node_modules and build output.
- `fly.toml`: app `retroleague` (https://retroleague.fly.dev; Fly can't rename an app: a new name is a new app), region `gru` (São Paulo, close to the River Plate), one dedicated
  CPU (`performance-1x`, which comes with 2 GB), HTTPS forced, `/health` checked. The machine stops when nobody's connected
  and starts on the next visit (a few seconds). **Run one machine only**: matches, rooms and
  the queue live in its memory, so two machines would split players apart.
  Why dedicated: a shared CPU guarantees 6.25% and lends more from a credit; a 5v5 runs at
  about 17%, so the credit ran out around minute 11 and the server was held back (the
  match slowed down for everyone).

First deploy (needs a Fly.io account, logged in with `fly auth login`):

```bash
fly launch --copy-config --no-deploy   # creates the app from fly.toml (pick another name if "retroleague" is taken)
fly deploy --ha=false                  # builds on Fly's builders and starts one machine
fly open                               # opens https://<app>.fly.dev
```

Later deploys: `fly deploy --ha=false`. Logs: `fly logs`. The public queue's team size is
`PLAYERS_PER_TEAM` in `fly.toml`; rooms and practice don't use it.

## Accounts volume

Accounts live in SQLite at `DATA_DIR/accounts.db` ([accounts.md](accounts.md)). A machine's own disk
is reset on every start (each deploy, each idle stop), so on Fly `DATA_DIR` must be a volume:

```bash
fly volumes create retroleague_data --region gru --size 1   # 1 GB; one machine, one volume
```

and in `fly.toml`:

```toml
[env]
  DATA_DIR = "/data"

[mounts]
  source = "retroleague_data"
  destination = "/data"
```

Without it the server still starts (in `./data` inside the machine), but accounts vanish on the next
restart. Set up on 2026-11-04: `retroleague_data` (1 GB, gru, encrypted; Fly keeps 5 daily snapshots).
The machine and its volume are in the same region; a volume belongs to one machine, another reason
to run only one.

`deploy/` holds an older EC2 + nginx deploy (São Paulo); it's no longer running.
