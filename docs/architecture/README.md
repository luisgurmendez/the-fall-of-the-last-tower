# Siege MOBA - Architecture Documentation

This directory contains detailed documentation for the Siege MOBA architecture.

> **Keep these docs up to date!** When modifying any system, update the corresponding documentation file. See the update guidelines in [CLAUDE.md](../../CLAUDE.md).

## Documentation Index

### Core Systems

| Document | Description |
|----------|-------------|
| [infrastructure.md](infrastructure.md) | Server-client architecture, game loop, component overview |
| [networking.md](networking.md) | WebSocket protocol, message types, state synchronization |
| [matchmaking.md](matchmaking.md) | Player queue system, match creation, team assignment |

### Game Systems

| Document | Description |
|----------|-------------|
| [champions.md](champions.md) | Champion classes, stats, leveling, damage calculation |
| [abilities.md](abilities.md) | Ability system, targeting types, cooldowns, scaling |
| [effects-and-buffs.md](effects-and-buffs.md) | Buffs, debuffs, crowd control, stat modifiers |
| [collision.md](collision.md) | Unit collision detection, separation, spatial grid |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Client                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ OnlineGame  │  │ StateManager│  │  OnlineInputHandler │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                   NetworkClient                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                      WebSocket
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                         Server                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  BunWebSocketServer                  │    │
│  └──────────────────────────┬──────────────────────────┘    │
│                             │                                │
│  ┌──────────────┐  ┌────────┴────────┐  ┌──────────────┐    │
│  │  Matchmaker  │  │ GameRoomManager │  │InputHandler  │    │
│  └──────────────┘  └────────┬────────┘  └──────────────┘    │
│                             │                                │
│                    ┌────────┴────────┐                      │
│                    │    GameRoom     │                      │
│                    │  ┌───────────┐  │                      │
│                    │  │ServerGame │  │                      │
│                    │  │ (30 Hz)   │  │                      │
│                    │  └───────────┘  │                      │
│                    │  ┌───────────┐  │                      │
│                    │  │  Context  │  │                      │
│                    │  │ Entities  │  │                      │
│                    │  └───────────┘  │                      │
│                    └─────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Server-Authoritative

All game logic runs on the server. Clients send inputs and receive state updates. This prevents cheating and ensures fair gameplay.

### Delta Compression

State updates only include changed entity fields, reducing bandwidth by 60-70% compared to full snapshots.

### Fixed Tick Rate

Server runs at 30 Hz (33.3ms per tick). Clients render at 60 Hz with interpolation for smooth visuals.

## Package Structure

```
packages/
├── server/          # Game server (Bun runtime)
│   └── src/
│       ├── game/        # Game loop, room management
│       ├── simulation/  # Champions, minions, towers
│       ├── network/     # WebSocket, serialization
│       └── matchmaking/ # Player queue
│
├── shared/          # Shared code
│   └── src/
│       ├── types/       # Type definitions
│       ├── config/      # MOBAConfig, game constants
│       └── math/        # Vector operations
│
└── client/          # Client networking
    └── src/
        └── network/     # NetworkClient
```

## Getting Started

### Start the server:
```bash
cd packages/server
bun run src/server.ts
```

### Connect clients:
Open the game in browser (default mode is online multiplayer).

### Test locally:
Open two browser tabs and click "Play" in each to start a 1v1 match.
