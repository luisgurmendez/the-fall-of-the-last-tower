# Lanes and Minions

Server: `packages/server/src/simulation/ServerMinion.ts`, wave spawning in
`ServerGameContext.spawnLaneMinions()`, lane geometry in `navigation/LanePath.ts`.
Config: `MOBAConfig.LANES`, `MOBAConfig.MINION_WAVES`, stats in
`packages/shared/src/types/minions.ts` (`DEFAULT_MINION_STATS`).

## Waves

- A wave spawns per side in each lane every `SPAWN_INTERVAL` seconds (first after `FIRST_WAVE_DELAY`).
- Composition: `WAVE_COMPOSITION` melee (`swordsmen`) and casters (`archers`). Every `SIEGE_EVERY`th wave adds a siege minion between them.
- The wave marches in rows: melee in front, then siege, then casters. Up to three minions walk side by side. Each minion keeps its own `laneOffset` from the lane center, so the wave doesn't walk single file.
- Stats grow with game time: +`SCALING_PER_MINUTE.health` health and +`SCALING_PER_MINUTE.damage` damage per minute. The bonus is fixed when the minion spawns and stops growing after `MAX_SCALING_MINUTES`.

## Movement

Each minion has a `LanePath`: its spawn point followed by the lane's waypoints (reversed for red). With no target, the minion projects itself onto the path and steers toward a point `LANE_LOOKAHEAD` units further along, shifted by its lane offset. Because of that:

- it follows the lane and rounds corners smoothly;
- after chasing something off the lane, it rejoins the lane further along instead of walking back to an old waypoint;
- at the end of the path (the enemy base) it stops and fights whatever is there.

## Targeting

A minion notices enemies within `max(sightRange, attackRange + 100)`. Targets in priority order (ties go to the closest):

| Priority | Target |
|----------|--------|
| 100 | **Call for help**: an enemy champion that damaged an allied champion within 500 units of the minion in the last 2s |
| 50 | Enemy minions |
| 30 | Enemy champions |
| 10 | Towers, inhibitors, nexus |

Every wave minion moves at the same speed (42) so the formation holds. Attack timings (melee 1.0s, casters 22 damage every 1.6s) are tuned so a wave deals more damage per second than the next wave brings in health; otherwise waves pile up. Over a 9-minute simulation without champions, each side holds a steady 45-50 minions across the three lanes.

Minions never attack jungle creatures, wards, zones or projectiles, and never target units their side can't see.

A minion keeps its target while it's alive, visible, in reach and the minion is within `LANE_LEASH` (350) of its lane. Every 0.5s it checks for a better target. It switches to a higher-priority one, so a call for help interrupts a minion fight. It also switches to an enemy of the same priority that is clearly closer when its current target is out of range (for example walled off by other units). Champion-on-champion damage is recorded by `ServerGameContext` from `DAMAGE` events (`getRecentChampionVictim()`).

Casters and siege minions fire targeted projectiles (`minion_caster`, `minion_siege`). Melee minions hit instantly.

## Scenarios

`packages/server/scenarios/minion-*.ts` show and check this behavior. For example, run `bun run sim minion-chase-and-return`; see [simulation.md](simulation.md).
