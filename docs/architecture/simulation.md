# Simulation framework (for agents and humans)

A headless way to set up a situation, run the real server simulation, and see
what happened: a text report, a log, and PNG images. Built so an AI agent can
change gameplay code and check the result without a browser or a second player.

Code: `packages/server/src/sim/`. Scenarios: `packages/server/scenarios/`.

## Quick start

```bash
cd packages/server

bun run sim list                      # scenarios and what they show
bun run sim minion-waves-mid          # run one, print the report
bun run sim bot-vs-bot-mid --duration 300 --center 0,0 --size 1500
```

Each run writes to `packages/server/sim-output/<scenario>/` (gitignored):

| File | What it is |
|------|------------|
| `report.md` | Champions table, units alive, deaths grouped by who killed whom, damage by source, full log, check results |
| `log.txt` | Timestamped log: spawns, deaths (with killer), ability casts, level ups, recalls, scenario notes |
| `sheet.png` | Contact sheet: N frames over the run with movement trails |
| `final.png` | Final frame, larger |
| `timeline.json` | One compact frame per second (`SimEntity[]`: id, kind, side, x, y, hp, label, target) |

Agents: open `sheet.png` / `final.png` with an image-capable file reader to look at the run.

**Reading the images:** blue/red are the two sides and amber is jungle. Squares are towers and nexuses, with faint rings for tower range. Small dots are minions (darker for melee, lighter for caster). Ringed circles are champions, labeled with champion and level. A yellow ring means the champion is recalling. Thin lines show who is attacking whom. Dotted tails show movement over the last 4 seconds. Gray X marks are dead units.

Flags: `--duration s`, `--seed n`, `--frames n`, `--center x,y`, `--size worldUnits`, `--px cellPixels`, `--out dir`. The command exits with code 1 when the scenario's checks fail.

## Writing a scenario

```ts
// packages/server/scenarios/my-scenario.ts
import { defineScenario } from '../src/sim';

export default defineScenario({
  name: 'my-scenario',
  description: 'One line shown by `bun run sim list`',
  options: { minionWaves: false, jungle: false },   // SimulationOptions
  duration: 30,
  setup(sim) {
    sim.addChampion({ playerId: 'me', championId: 'vex', side: 'blue', at: { x: 0, y: 200 }, level: 6 });
    sim.addChampion({ playerId: 'bot', championId: 'vile', side: 'red', bot: 'lane' });
    sim.spawnWave('mid');
  },
  steps: [
    { at: 5, note: 'vex dashes in', run: sim => sim.cast('me', 'E', { x: 100, y: 100 }) },
    { at: 6, run: sim => sim.attack('me', sim.champion('bot').id) },
  ],
  view: { center: { x: 0, y: 0 }, size: 1200 },   // camera for the images
  check(sim, report, expect) {
    expect(report.deaths.length > 0, 'something should die');
  },
});
```

Every scenario runs in the test suite (`src/test/Scenarios.test.ts`), so its checks act as gameplay tests.
Runs are seeded (`seed: 1` by default), so the same scenario gives the same result.

## Simulation API

`new Simulation(options)` sets up a match like `GameRoom` does, using the shared `MatchSetup`:

- `structures`, `jungle`, `minionWaves`: each defaults to true.
- `map`: map config, default `MOBAConfig`.
- `seed`: seeds `Math.random`; `dispose()` restores it.
- `sampleInterval`: seconds between recorded frames.

| Method | |
|--------|---|
| `addChampion({ playerId, championId, side, at?, level?, ranks?, bot? })` | Spawn a champion. `bot: 'lane'` attaches a LaneBot |
| `addBot(controller)` | Any `BotController` |
| `spawnWave(lane, side?)` | One minion wave (both sides by default) |
| `move / attack / stop / cast / levelUp / recall / buy` | Inputs, queued through the real `InputHandler` |
| `input(playerId, input)` | Any raw `ClientInput` (without seq/clientTime) |
| `tick() / run(seconds) / runUntil(predicate, maxSeconds)` | Advance time (30 ticks per second) |
| `champion(playerId) / entity(id) / entities(filter?)` | Read state (`entities` returns compact `SimEntity`) |
| `note(text)` | Add a line to the log |
| `report()` | `SimReport` with `markdown` |
| `recorder.frames / recorder.log` | Raw recording |

Rendering: `new FrameRenderer({ center, size, px }).render(frame, { history })` returns a `Raster`. Call `.toPNG()` on it. `renderSheet(frames, allFrames, options)` builds a contact sheet.

## Interactive sandbox

To play step by step (an agent driving a champion, or poking at a situation), start the sandbox:

```bash
cd packages/server
bun run sim:serve --port 8090 --scenario bot-vs-bot-mid   # run in the background

curl -s localhost:8090/step -d '{"seconds": 5}'            # advance, get new log lines + champions
curl -s localhost:8090/command -d '{"playerId":"blue-bot","action":"move","x":0,"y":0}'
curl -s localhost:8090/command -d '{"playerId":"blue-bot","action":"cast","slot":"Q","x":200,"y":-200}'
curl -s "localhost:8090/state?near=0,0,600"                # entities around a point
curl -s "localhost:8090/frame.png?x=0&y=0&size=1200" -o frame.png
curl -s "localhost:8090/sheet.png?seconds=20" -o sheet.png
curl -s localhost:8090/reset -d '{"scenario":"minion-waves-mid"}'
curl -s localhost:8090/report
```

Command actions: `move`, `attack` (`targetId`), `stop`, `cast` (`slot`, plus `x,y` or `targetId`), `level` (`slot`), `recall`, `buy` (`itemId`).

## Bots

`BotController` (`packages/server/src/bots/`) is the interface for anything that plays a champion without a connection. Bots return client inputs. `BotDriver` stamps them with sequence numbers and queues them through the `InputHandler`, so bots follow the same validation and rate limits as players. The same bots run in:

- **Practice mode.** The client's PRACTICE button sends `READY` with `mode: 'practice'`. The server starts a match right away, with the player on blue and a `LaneBot` on red.
- **Simulations.** Use `addChampion({ bot: 'lane' })` or `addBot()`.

`LaneBot` follows these rules, in priority order:
1. Spend skill points.
2. Retreat and recall when low.
3. Trade with the enemy champion when the fight looks even.
4. Last-hit minions.
5. Stand behind the allied wave and stay out of enemy tower range unless minions are tanking it.
