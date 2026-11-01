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
| `report.md` | Champions table, towers and inhibitors standing, units alive, deaths grouped by who killed whom, damage by source, full log, check results |
| `log.txt` | Timestamped log: spawns, deaths (with killer), ability casts, level ups, recalls, champion respawns and inhibitor rebuilds, scenario notes |
| `sheet.png` | Contact sheet: N frames over the run with movement trails |
| `final.png` | Final frame, larger |
| `timeline.json` | One compact frame per second (`SimEntity[]`: id, kind, side, x, y, hp, label, target) |

Agents: open `sheet.png` / `final.png` with an image-capable file reader to look at the run.

**Reading the images:** blue/red are the two sides and amber is jungle. Squares are towers, inhibitors and nexuses (the big one), with faint rings for tower range. Small dots are minions (darker for melee, lighter for caster). Ringed circles are champions, labeled with champion and level. A yellow ring means the champion is recalling. Thin lines show who is attacking whom. Dotted tails show movement over the last 4 seconds. Gray X marks are dead units, and destroyed towers and inhibitors (an inhibitor's X turns back into a square when it rebuilds).

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
| `addChampion({ playerId, championId, side, at?, level?, ranks?, summoners?, bot? })` | Spawn a champion. `bot: 'lane'` attaches a LaneBot; pass a controller (`new JungleBot(...)`) for another |
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

- **Practice mode.** The client's PRACTICE button sends `READY` with `mode: 'practice'` and a team size. The server starts a match right away, with the player in mid on blue and bots in every other role (see [matchmaking.md](matchmaking.md#practice-mode)).
- **Simulations.** Use `addChampion({ bot: 'lane' })` or `addBot()`.

`LaneBot` follows these rules, in priority order:
1. Spend skill points.
2. Shop at base. The build depends on the champion's class and follows item trees.
3. Retreat and recall when low, using defensive abilities if the enemy is close. It walks off until it's out of combat and out of enemy tower range first, since damage cancels a recall.
   Also recall to shop with 1100+ gold and an affordable next item, when no enemy champion is within 900, it's out of combat and it's out of enemy tower range.
4. Leave enemy tower range unless allied minions are tanking the tower. "Tanking" means at least two allied minions are under it, and at the rate they're losing health (the tower plus half the enemy minions' damage) they'll last 1.5 s longer than the bot needs to walk back out of range.
5. Fight the enemy champion when it is weak, when the bot has a clear health lead, or to hit back when attacked (including from range).
6. Last-hit minions. For each minion it predicts the health left when its hit would land: allied minions and towers keep hitting it during the cooldown, walk, windup and projectile flight. It hits when that kills the minion, and holds its attack when a last hit is due before another attack would be ready.
7. Poke the enemy champion only from ahead.
8. Siege: hit an enemy tower its minions are tanking, or an inhibitor or the nexus, once the structure order lets it take damage (`isStructureVulnerable`).
9. Otherwise push: a minion nothing allied is hitting, else the healthiest one, since hitting a weak one gives it to allied minions. It keeps hitting the same minion.
10. Stand behind the allied wave. Minions it would have to hit from inside enemy tower range are off limits unless allied minions are tanking the tower.

Champion abilities are bespoke. `ABILITY_ROLES` in `LaneBot.ts` says how to use the ones the generic rules would misuse: offense (self buffs, transforms), defense (stealth, invulnerability) or engage (dashes). `lastDecision` shows what the bot is doing. Scenarios `bot-vs-bot-mid`, `bot-fights-back`, `bot-goes-shopping`, `bot-farms-alone` and `bot-sieges-tower` cover the bot.

Summoner spells come before everything after the level up, when their moment arrives (`summonerTactics.ts`): Purge when stunned or rooted with an enemy near; Mend and Aegis under 30% health in a fight or a chase; Blink toward home under 20% with a chaser within 350, or onto a fleeing enemy under 15% just out of reach; Haste to run or to chase a weakened enemy; Scorch on an enemy under 30% in a fight; Hinder on the enemy in a fight the bot is losing; Reap on a big monster it would kill. Scenarios `bot-summoners-escape` and `bot-summoners-finish` cover them.

`JungleBot` (`JungleBot.ts`) extends `LaneBot` and replaces its lane steps (`chooseLaneAction`, from last-hitting on): it ganks a visible enemy under 55% health within 1600 and out of its towers' reach (from level 3, above 60% health; once on its way it keeps after that enemy while it's under 70% and within 2000, so a little regeneration doesn't call it off), else clears the nearest camp of its own jungle that's up (the dragon from level 8), focusing the weakest monster and using abilities while it has over 35% mana, else plays mid like a LaneBot until a camp is back. `SupportBot` (`SupportBot.ts`) also extends `LaneBot`: while its carry (`carryPlayerId`, the bot lane's laner in practice) is within 900 and not recalling, it heals or shields the most hurt ally in reach, pokes the enemy champion when it's ahead, and otherwise leaves the minions to the carry and stands 90 behind it; without its carry near it plays the lane like a LaneBot. Any bot's heals and shields on allies (`target_ally`) go to the most hurt ally in reach under 60% health, itself included. Scenario `bot-support-heals` covers it.

Scenarios `bot-jungles` and `bot-jungle-ganks` cover the jungler, and `bots-5v5` plays a whole practice 5v5 with ten bots for four minutes (nobody standing 45 s in one spot without hitting anything, everyone out of base, the lanes and junglers farming).

The simulation log lists summoner spell casts too.

## Structures

Scenarios start with every tower, inhibitor and nexus (`structures: false` leaves them out). To get at a structure, destroy the ones before it with true damage, in lane order (`takeDamage(health + 1, 'true', killerId, sim.context)`; StructureRules ignores damage to a protected one). Waves spawned by hand (`spawnWave`, `context.spawnLaneWave`) bring super minions like timed ones while an enemy inhibitor is down. `inhibitor-super-minions` shows the whole cycle: blue's mid inhibitor protected by its towers, destroyed by a red champion, red's next mid wave led by a super minion, and the inhibitor rebuilding 240 seconds later; `map-overview` checks every structure spawns.
