# Deploy (playing online)

Wildcrown runs on one machine: the Bun game server serves the built client and its
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
- `fly.toml`: app `wildcrown`, region `gru` (São Paulo, close to the River Plate), one shared
  CPU and 512 MB, HTTPS forced, `/health` checked. The machine stops when nobody's connected
  and starts on the next visit (a few seconds). **Run one machine only**: matches, rooms and
  the queue live in its memory, so two machines would split players apart.

First deploy (needs a Fly.io account, logged in with `fly auth login`):

```bash
fly launch --copy-config --no-deploy   # creates the app from fly.toml (pick another name if "wildcrown" is taken)
fly deploy --ha=false                  # builds on Fly's builders and starts one machine
fly open                               # opens https://<app>.fly.dev
```

Later deploys: `fly deploy --ha=false`. Logs: `fly logs`. The public queue's team size is
`PLAYERS_PER_TEAM` in `fly.toml`; rooms and practice don't use it.

`deploy/` holds an older EC2 + nginx deploy (São Paulo); it's no longer running.
