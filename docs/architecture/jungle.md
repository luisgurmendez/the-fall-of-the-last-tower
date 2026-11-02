# Jungle

Server: `packages/server/src/simulation/ServerJungleCreature.ts` (AI), `ServerJungleCamp.ts` (spawning and respawn),
`systems/JungleBuffs.ts` (buff rewards). Config: `MOBAConfig.JUNGLE` (camps and creature stats).
Client: `src/render/entities/jungleCreature.ts`, camp timers in `OnlineMinimap`, announcements in `AnnouncementBanner`.

## Camps

Each team has six camps, two quadrants with three camps each, plus two epic monsters in the river's pits: the dragon in the bot river and the Rootwyrm in the top river. The top side's camp spots are `TOP_SIDE_CAMPS` in `siegeMap.ts` (`MOBAConfig.JUNGLE.CAMPS` reflects them across mid for the bot side and mirrors them for red); the layout around them is in [map.md](map.md).

| Creature | Camp | Notes |
|----------|------|-------|
| `blue_buff` | 1 per side | Drops Crest of Insight |
| `red_buff` | 1 per side | Drops Crest of Cinders |
| `thornspitter` | 2 per side | Ranged (spits) |
| `wolf` | 2 wolves | |
| `spider` | 3 spiders | |
| `dragon` | bot river, respawns in 300s | Ranged (fire); team buff |
| `rootwyrm` | top river, first at 4:00 (`firstSpawnAt`), respawns in 360s | Melee with long reach (110); 3200 health; team buff |

A camp with `firstSpawnAt` starts empty and counts down to it like a respawn: `ServerJungleCamp.start` sends `CAMP_CLEARED` with its `respawnAt`, so clients show the Rootwyrm's timer on the minimap from the start.

## Behavior

Creatures are neutral monsters:

- **Passive until attacked.** Walking past a camp is safe.
- **Camp-wide aggro.** Hitting one creature makes every creature in that camp fight the attacker.
- **Sticky targets.** A creature keeps attacking whoever hit it first. When that target dies or leaves the leash area, it switches to the closest other champion that damaged it in the last few seconds.
- **Reset.** A creature resets when it is pulled more than `leashRange` from home, when it has no valid target, or when it is kited: its patience runs out (5 s with no blow either way, neither hitting nor being hit) while its target is out of reach. It then walks home along a path around walls. It can't be damaged on the way and regains 30% of its health per second. It is back to full health when it arrives.
- **Ranged creatures** (thornspitter and dragon) attack with projectiles (`jungle_spit`, `dragon_fire`). The others hit instantly.
- **Special attacks.** Buff monsters and the dragon have a telegraphed area attack, see below.
- Minions and towers never attack jungle creatures.
- **Side 2.** Creatures have side 2 (neutral) on the server and in their snapshot. The client's
  right-click targeting treats any side other than the player's as an enemy; without `side`
  in the snapshot, creatures could only be hit with abilities.

## Leash and patience on screen

The creature's snapshot carries its home (`homeX`, `homeY`) and, while it fights, how far it's pulled (`leash`: its distance from home over `leashRange`, so it resets past 1) and its patience (`patience`: 1 just after a blow, down to 0 five seconds later), both rounded to two decimals; `isReturning` while it walks home. The client warns before a reset:

- **Tether** (`src/render/overlays/jungleLeash.ts`, on the ground under the units): from 45% of the leash, a line of moving dashes runs from the monster to a ring at its spot in the camp, faint amber at first, red and blinking near the end. From 65%, an arc of dashes on the leash's edge shows where it's heading, so a player can see how much further it follows.
- **Patience bar**: a thin amber bar under the health bar, draining between blows; red and blinking below a third.
- **Giving up**: the red "!" over a fighting monster turns into a bobbing amber "?" past 80% of the leash or below a third of its patience.
- **Reset**: a pale puff with a ring closing in on it (`fx_creature_reset`) and a grumbling huff (`monster_reset`); while it walks home it's drawn pale and see-through (it can't be hurt) with a curling arrow over it.

## Special attacks

Configured in `MOBAConfig.JUNGLE.SPECIAL_ATTACKS`; the server logic is in `simulation/JungleSpecialAttacks.ts`.

During a fight the monster checks its special attack. It uses it when the attack is ready (`firstUseAfter` seconds into the fight, then every `cooldown` seconds) and its target would be hit. It stops moving and attacking for `windup` seconds and sends `ABILITY_CAST` with the attack's `abilityId`. Every champion still inside the area when the wind-up ends is hit; minions are never hit.

| Monster | Attack | Area | Wind-up | Hit |
|---------|--------|------|---------|-----|
| Blue buff | `jungle_slam_blue` | circle, radius 130 | 1.1s | 80 magic damage, 30% slow for 1.5s |
| Red buff | `jungle_slam_red` | circle, radius 130 | 1.1s | 90 physical damage, 30% slow for 1.5s |
| Dragon | `dragon_breath` | cone at its target, 260 long and 50° wide | 1.0s | 160 magic damage, 20% slow for 1s |
| Rootwyrm | `rootwyrm_eruption` | circle, radius 190 | 1.3s | 150 magic damage, rooted for 1s |

The sizes are tuned to champion speed (about 100 units/s). A melee champion fighting a buff monster stands about 110 from its center (attack range 55 plus both bodies), inside the slam, and has over half a second to spare when it steps out. The dragon's breath is too wide to outrun up close, so champions should fight it from beside or behind.

The client draws the warning from the same config (`src/vfx/world.ts`). While winding up, the monster holds its attack's gathering pose, trembles, swells and glows brighter until the attack lands (`renderJungleCamp`). The slam warning is a filled circle with a ring that grows from the center and reaches the edge when the slam lands. The breath warning is a faint cone, followed by a fire burst.

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
| Rootwyrm | `heartwood_pact` / `heartwood_pact_ward` / `heartwood_pact_sap` (Heartwood Pact): +12 armor, +12 magic resist and +5 health per second for the killer's whole team, kept through death | 150s |

Buff-camp buffs are lost on death.

## Events

- `CAMP_CLEARED` `{ campId, creatureType, x, y, respawnAt }`: sent reliably when a camp's last creature dies. The client shows a countdown at the camp on the minimap until `respawnAt`; dragon and buff timers are highlighted.
- `DRAGON_KILLED` `{ killerId, side, duration, creatureType }`: an epic monster slain (`dragon` or `rootwyrm`; the event kept the dragon's name). The client shows "Your team / The enemy team slew the Dragon!" (or the Rootwyrm) with its buff for 4 seconds.

## Looks

Each spawned creature type has its own monster, designed for Siege:

| Type | Monster | Canvas |
|------|---------|--------|
| `wolf` | Cinder Hound: a dark hound with smoldering ember cracks | 80 px |
| `spider` | Gloom Crawler: a small purple cave spider | 64 px |
| `thornspitter` | Thornspitter: a carnivorous plant that spits | 84 px |
| `blue_buff` | Azure Warden: an ancient tortoise with a blue crystal shell | 124 px |
| `red_buff` | Ember Brute: a hunched brute of molten rock | 132 px |
| `dragon` | Dragon: purple scales, folded wings, glowing belly | 164 px |
| `rootwyrm` | Rootwyrm: an ancient four-legged wyrm of twisted roots and bark, a mossy back with glowing mushrooms | 128 px canvas, drawn at 1.7 |

Each has idle, run and attack strips in `public/assets/sprites/monsters/<type>/`: square
frames side by side, facing right (`renderJungleCamp` mirrors them to face left). The
frame size is the strip's height and the frame count its width over its height. Idle and
run loop; the attack plays once over the server's attack animation; a special attack's
wind-up holds the attack's gathering pose. Bars, name plates and the aura are placed from
the art's measured top and width, so they fit any monster size. Buffs and the dragon also
get a pulsing aura and a name plate ("Azure Warden", "Ember Brute", "Dragon").

The strips come from PixelLab, made by `scripts/generate-sprites.ts` (each
monster's description, canvas and animation prompts are in `SPRITE_SETS` there):

- A character per monster (`create-character-v3`, 8 directions; only east is used).
- Idle from a description (`v3` mode), the attack on PixMiniMax (8 frames), and the run
  from a skeleton template (`running-6-frames`, `walking-6-frames`) when the monster's
  body has one, else on PixMiniMax.
- The frames are laid on one square canvas per monster with every animation's feet on
  the idle's row, so switching animations doesn't make the monster jump.

`scripts/sprites.json` keeps the PixelLab character and animation ids; a run
only generates what's missing (`--redo attack --seed 8` regenerates an animation with another seed). `public/` is
not in git, so a machine without the strips draws the older looks: the shared bear and
spider sprites with a color filter per type.

## Scenarios

- `bun run sim jungle-aggro-and-reset`: a passing champion is ignored, the pack aggros together, and the creatures reset when kited.
- `bun run sim jungle-buffs`: the buffs are granted, red buff burns on hit, and the dragon buffs the whole team.
- `bun run sim jungle-solo-buffs`: a level 3 Vex takes each buff camp alone and stays above 20% health (see Balance).
- `bun run sim jungle-special-attacks`: a champion standing in a slam is hit and one that steps out is not; the dragon's breath hits the champion in front of it and misses the one behind.
