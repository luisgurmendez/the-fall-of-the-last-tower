## Siege

A multiplayer MOBA with a server-authoritative game loop, champion-based combat, lanes, minions, towers and a jungle.

- **Server** (`packages/server`): authoritative 30 Hz simulation on Bun, fog of war, delta-compressed state sync
- **Client** (`src/`, `packages/client`): canvas renderer at 60 Hz with interpolation, HUD, shop and matchmaking UI
- **Shared** (`packages/shared`): champion/ability definitions, types and config used by both sides

Architecture docs live in [`docs/architecture/`](docs/architecture/README.md).

### Run it locally

```bash
npm install

# Start the server
cd packages/server
bun run src/server.ts

# Start the client (in another terminal, from the repo root)
npm run serve
```

To test ultimates without leveling up, start the server with `SIEGE_STARTING_LEVEL=6`.

### Tests

```bash
npm run test:packages   # server, client networking, shared and protocol tests
```

### Build

```bash
npm run build           # client production build into dist/
```

Deployment scripts are in [`deploy/`](deploy/README.md).

### History

Siege started as "The Fall of the Last Tower", a tower defense entry for the
[js13kGames 2023](https://js13kgames.com/entries/the-fall-of-the-last-tower) competition, and has since been rebuilt as an online MOBA.

Thanks to:
Catalina Sterenstein,
Facundo Duarte,
Ignacio Gurmendez,
Juan Diego Duarte,
JV. Gurmendez,
Pedro Duarte,
and special thanks to Mark Vasilkov for sharing his pixel art strategy.
