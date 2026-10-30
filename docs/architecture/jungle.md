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
- Minions and towers never attack jungle creatures.

## Buffs

The killer must be a champion. The effects live in `packages/server/src/data/effects.ts`, and the HUD names come from `src/data/effectDisplayInfo.ts`.

| Kill | Effect | Duration |
|------|--------|----------|
| Blue buff | `crest_of_insight`: +15 ability haste; `crest_of_insight_regen`: +4 mana/energy per second | 90s |
| Red buff | `crest_of_cinders`: +4 health per second. Basic attacks on champions and minions apply `cinders_burn` (true damage over 3s) and `slow_10` for 1.5s (`ServerChampion.applyOnHitBuffs`) | 90s |
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
