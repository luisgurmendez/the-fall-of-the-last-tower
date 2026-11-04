# Lanes and Minions

Server: `packages/server/src/simulation/ServerMinion.ts`, wave spawning in
`ServerGameContext.spawnLaneMinions()`, lane geometry in `navigation/LanePath.ts`.
Config: `MOBAConfig.LANES`, `MOBAConfig.MINION_WAVES`, stats in
`packages/shared/src/types/minions.ts` (`DEFAULT_MINION_STATS`).

## Waves

- A wave spawns per side in each lane every `SPAWN_INTERVAL` seconds (first after `FIRST_WAVE_DELAY`).
- Composition: `WAVE_COMPOSITION` melee (`swordsmen`) and casters (`archers`). Every `SIEGE_EVERY`th wave adds a siege minion between them.
- **Super minions:** while the enemy's inhibitor in a lane is destroyed, every wave in that lane brings a super minion and no siege minion; once all three of the enemy's inhibitors are down, two (`ServerGameContext.getSuperMinionCount`). This applies to waves spawned by hand too (`spawnLaneWave`, the simulation's `spawnWave`). Super minions are melee: 1500 health, 180 damage every 0.95s, radius 22, and they walk a little faster than the wave (96). It stops when the inhibitor rebuilds.
- The wave marches in rows: super minions in front, then melee, then siege, then casters. Up to three minions walk side by side (super minions 48 apart, the rest 22). Each minion keeps its own `laneOffset` from the lane center, so the wave doesn't walk single file.
- Stats grow with game time: +`SCALING_PER_MINUTE.health` health and +`SCALING_PER_MINUTE.damage` damage per minute. The bonus is fixed when the minion spawns and stops growing after `MAX_SCALING_MINUTES`.

## Movement

Each minion has a `LanePath`: its spawn point followed by the lane's waypoints (reversed for red). With no target, the minion projects itself onto the path and steers toward a point `LANE_LOOKAHEAD` units further along, shifted by its lane offset. Because of that:

- it follows the lane and rounds corners smoothly;
- after chasing something off the lane, it rejoins the lane further along instead of walking back to an old waypoint;
- at the end of the path (the enemy base) it stops and fights whatever is there.

Lanes run straight through their towers and inhibitors. When one of the minion's own towers, its inhibitor or its nexus is in the way (a destroyed one isn't), `steerAroundStructures` (`navigation/StructureAvoidance.ts`) aims it at a point beside the structure, on the side it is already on. The wave walks around instead of piling up behind it. Enemy structures are not avoided, because the minion walks up to them and attacks.

## Targeting

Minions follow League's rules (wiki: "Minion"), at this map's scale (0.42 of League's distances).
A minion attacks a target within `attackRange` of its body, edge to edge (see [champions.md](champions.md#attack-range)). It notices enemies within `max(220, attackRange + 30)` (League's 500; its sight, 400, is only for vision). Targets in priority order (ties go to the closest):

| Priority | Target |
|----------|--------|
| 100 | **Call for help**: an enemy champion that, in the last 2s, hit an allied champion within 400 units of the minion (League's 1000) with a **basic attack** or an **ability aimed at that champion** (`target_enemy`). An area ability, a skillshot, a damage over time or an item doesn't call for help |
| 50 | Enemy minions |
| 40 | Towers, inhibitors, nexus (a wave at a tower hits the tower, not a champion standing by) |
| 30 | Enemy champions |

Every wave minion moves at the same speed (88, a little under a champion's 99-105, so lanes read calmly) so the formation holds. Attack timings (melee every 1.1s, casters 22 damage every 1.75s, siege every 2.2s) are tuned so a wave deals more damage per second than the next wave brings in health; otherwise waves pile up. Slowing them further also leaves a farming champion alone ahead of its wave more often (the `bot-farms-alone` scenario's last hits halved with 1.2s/1.85s attacks; at 88 speed with these timings and champions at 99-105 it farms 28 in its 5 minutes, as waves arrive later). Each attack plays its type's attack strip (9 frames over 0.45s, 0.5s for siege) and lands on the frame the art shows it: the melee blow at 0.4s, the caster's bolt leaves at 0.3s, the cannon fires at 0.22s (`ServerMinion.ATTACK_ANIMATIONS`); a stun during the windup cancels it. Over a 9-minute simulation without champions, each side holds between about 20 and 40 minions across the three lanes, without piling up.

Minions never attack jungle creatures, wards, zones or projectiles, and never target units their side can't see.

A minion keeps its target while it's alive, visible, in reach and the minion is within `LANE_LEASH` (350) of its lane. Every 0.5s it checks for a better target. It switches to a higher-priority one, so a call for help interrupts a minion fight. A structure it's hitting holds it until it falls: nothing pulls it off, not even a call for help (as in League, so diving a champion under its tower doesn't turn the wave on you). It also switches to an enemy of the same priority that is clearly closer when its current target is out of range (for example walled off by other units). Champion-on-champion attacks are recorded by `ServerGameContext`: basic-attack damage from `DAMAGE` events (the source's `damageKind`), and abilities aimed at a champion when they're cast (`noteChampionAggression`, from the executor); `getRecentChampionVictim()` reads them.

**Damage to champions:** minions deal 60% of their damage to champions (`ServerMinion.DAMAGE_TO_CHAMPIONS`, League's rule), all of it to minions and structures. Health is League's (melee 477, caster 296, siege 900, super 1500; League 465, 284, 835, 1600). Against minions their damage per second is close to League's, whose minions add 2-5% of the target's current health; against champions a wave of three melee and three casters deals about 60 per second (League about 50).

Tests: `packages/server/src/test/MinionAggro.test.ts`, `ServerMinion.test.ts`; scenarios `minion-call-for-help`, `bot-sieges-tower`.

Casters and siege minions fire targeted projectiles (`minion_caster`, `minion_siege`). Melee and super minions hit instantly.

Structures fall in lane order (see [map.md](map.md)): a wave that has taken a lane's towers walks on to that lane's inhibitor and hits it, then, with it destroyed, walks past it to the nexus.

## Art

The minions are generated with PixelLab (`scripts/generate-sprites.ts`, keys `minion_melee`, `minion_caster`, `minion_siege`): a footman with sword and shield, a hooded acolyte with a wand, and a gunner with a shoulder cannon, each with idle, walk and attack strips in `public/assets/sprites/minions/<type>/`. They're drawn in the blue team's colors. `src/render/entities/teamColors.ts` makes the red team's version once per image, turning the strongly blue pixels red and leaving steel, skin and wood alone. Without the strips, `src/render/entities/minion.ts` falls back to the original warrior and archer sprites.

## Scenarios

`packages/server/scenarios/minion-*.ts`, `minions-pass-own-towers.ts` (which also walks past blue's bot inhibitor) and `inhibitor-super-minions.ts` show and check this behavior. For example, run `bun run sim minion-chase-and-return`; see [simulation.md](simulation.md).
