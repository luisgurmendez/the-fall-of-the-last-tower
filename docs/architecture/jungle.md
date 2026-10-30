# Jungle

Server: `packages/server/src/simulation/ServerJungleCreature.ts` (AI), `ServerJungleCamp.ts` (spawning and respawn),
`systems/JungleBuffs.ts` (buff rewards). Config: `MOBAConfig.JUNGLE` (camps and creature stats).
Client: `src/render/entities/jungleCreature.ts`, camp timers in `OnlineMinimap`, announcements in `AnnouncementBanner`.

## Camps

Each team has six camps, two quadrants with three camps each, plus the dragon in the bot river. Positions are in [map.md](map.md).

| Creature | Camp | Notes |
|----------|------|-------|
| `blue_buff` | 1 per side | Drops Crest of Insight |
| `red_buff` | 1 per side | Drops Crest of Cinders |
| `gromp` | 2 per side | Ranged (spits) |
| `wolf` | 2 wolves | |
| `spider` | 3 spiders | |
| `dragon` | river, respawns in 300s | Ranged (fire); team buff |

## Behavior

Creatures are neutral monsters:

- **Passive until attacked.** Walking past a camp is safe.
- **Camp-wide aggro.** Hitting one creature makes every creature in that camp fight the attacker.
- **Sticky targets.** A creature keeps attacking whoever hit it first. When that target dies or leaves the leash area, it switches to the closest other champion that damaged it in the last few seconds.
- **Reset.** A creature resets when it is pulled more than `leashRange` from home, when it has no valid target, or when it is kited (no damage taken for 5s while its target is out of reach). It then walks home along a path around walls. It can't be damaged on the way and regains 30% of its health per second. It is back to full health when it arrives.
- **Ranged creatures** (gromp and dragon) attack with projectiles (`jungle_spit`, `dragon_fire`). The others hit instantly.
- **Special attacks.** Buff monsters and the dragon have a telegraphed area attack, see below.
- Minions and towers never attack jungle creatures.

## Special attacks

Configured in `MOBAConfig.JUNGLE.SPECIAL_ATTACKS`; the server logic is in `simulation/JungleSpecialAttacks.ts`.

During a fight the monster checks its special attack. It uses it when the attack is ready (`firstUseAfter` seconds into the fight, then every `cooldown` seconds) and its target would be hit. It stops moving and attacking for `windup` seconds and sends `ABILITY_CAST` with the attack's `abilityId`. Every champion still inside the area when the wind-up ends is hit; minions are never hit.

| Monster | Attack | Area | Wind-up | Hit |
|---------|--------|------|---------|-----|
| Blue buff | `jungle_slam_blue` | circle, radius 150 | 1.5s | 80 magic damage, 30% slow for 1.5s |
| Red buff | `jungle_slam_red` | circle, radius 150 | 1.5s | 90 physical damage, 30% slow for 1.5s |
| Dragon | `dragon_breath` | cone at its target, 300 long and 50° wide | 1.3s | 160 magic damage, 20% slow for 1s |

The sizes are tuned to champion speed (about 60 units/s). A melee champion fighting a buff monster stands 125-170 from its center, inside the slam, and has at least half a second to step out. The dragon's breath is too wide to outrun up close, so champions should fight it from beside or behind.

The client draws the warning from the same config (`src/vfx/world.ts`). The slam warning is a filled circle with a ring that grows from the center and reaches the edge when the slam lands. The breath warning is a faint cone, followed by a fire burst.

## Balance

A champion without a jungle role (no smite, no jungle item) should be able to take a buff camp alone around level 3, at a real cost. Blue buff has 1000 health and hits for 40 every 1.4s; red buff has 1000 health and hits for 45 every 1.2s. A level 3 Vex using only basic attacks and never dodging a slam drops to about 52% health fighting the blue buff and about 36% fighting the red buff. With abilities and dodging, a player does better. Casters with weak basic attacks need their spells. The dragon kills any single champion, even at level 6.

`bun run sim jungle-solo-buffs` guards this: the lowest health has to stay between 20% and 80%.

## Buffs

The killer must be a champion. The effects live in `packages/server/src/data/effects.ts`, and the HUD names come from `src/data/effectDisplayInfo.ts`.

| Kill | Effect | Duration |
|------|--------|----------|
| Blue buff | `crest_of_insight`: +15 ability haste; `crest_of_insight_regen`: +4 mana/energy per second | 90s |
| Red buff | `crest_of_cinders`: +4 health per second. Basic attacks on champions and minions apply `cinders_burn` (true damage over 3s) and `slow_10` for 1.5s (`ChampionBasicAttacks.applyOnHitBuffs`) | 90s |
| Dragon | `dragons_might` / `dragons_might_power`: +8% attack damage and ability power for the killer's whole team, kept through death | 150s |

Buff-camp buffs are lost on death.

## Events

- `CAMP_CLEARED` `{ campId, creatureType, x, y, respawnAt }`: sent reliably when a camp's last creature dies. The client shows a countdown at the camp on the minimap until `respawnAt`; dragon and buff timers are highlighted.
- `DRAGON_KILLED` `{ killerId, side, duration }`: the client shows "Your team / The enemy team slew the Dragon!" for 4 seconds.

## Looks

The client has two creature sprites, spider and bear. Each type gets its own size and canvas color filter. Buffs and the dragon also get a pulsing aura and a name plate ("Azure Warden", "Ember Brute", "Dragon").

## Scenarios

- `bun run sim jungle-aggro-and-reset`: a passing champion is ignored, the pack aggros together, and the creatures reset when kited.
- `bun run sim jungle-buffs`: the buffs are granted, red buff burns on hit, and the dragon buffs the whole team.
- `bun run sim jungle-solo-buffs`: a level 3 Vex takes each buff camp alone and stays above 20% health (see Balance).
- `bun run sim jungle-special-attacks`: a champion standing in a slam is hit and one that steps out is not; the dragon's breath hits the champion in front of it and misses the one behind.
