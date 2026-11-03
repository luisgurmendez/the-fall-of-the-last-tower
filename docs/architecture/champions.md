# Champions System

This document describes the champion system including classes, stats, leveling, and runtime state.

## Overview

Champions are the player-controlled units in Siege. Each champion has unique abilities, base stats, and growth characteristics.

## Champion Classes

```typescript
type ChampionClass =
  | 'warrior'   // Melee bruiser, balanced offense/defense
  | 'tank'      // High durability, crowd control
  | 'assassin'  // High burst damage, mobile, fragile
  | 'mage'      // Magic damage, ability focused
  | 'marksman'  // Physical damage, basic attack focused
  | 'support';  // Utility, healing, buffs
```

## Attack Types

```typescript
type AttackType = 'melee' | 'ranged';

// Melee: 40-50 attack range (Uruk's spear 65)
// Ranged: 150-240 attack range
```

### Attack range

Attack range is the gap between the attacker's body and the target's (edge to edge):
a target is in range when the distance between centers is at most
`attackRange + attacker radius + target radius` (`ServerEntity.isInAttackRange`). The same
rule applies to champions, minions, towers and jungle creatures. Ability ranges are still
measured center to center (`isInRange`).

Ranges follow the map's scale (0.4 of the classic MOBA's, see [map.md](map.md#scale)):
a melee unit hits with its body almost touching the target's, and a ranged champion's range
is under two seconds of walking. Melee ranges are measured against walking speed rather than
the map: champions walk about 100 (the classic MOBA's 340 would be 136 at our scale), so the
classic 125-175 comes to 40-50 here; at 55-95 melee champions hit from too far, and Uruk's
spear from twice Kael's sword. A basic attack lands if the target is still within its range
plus 25 when the windup ends (about what it walks in a windup; it was 50). Current values:
Kael, Vex, Hop-To-Eat and Fenris 40, Gorath and Protobot 45, Calamitus and Zhak'rul 50, Uruk 65
(a spear: the longest melee), Vile 180 (45 during R), Hop-To-Eat 250 when its hop is ready,
Oitboil 150 (short bursts of flame), Caelum 200, Elara 210, Magnus and Lume 220,
Elora 240 (the longest bow). Minions: melee 44, super 70, siege 140,
caster 220. Towers 300 (they see 440). Melee monsters 40-60, thornspitter 100, dragon 200.
Champions walk 99-106 units a second (under the classic MOBA's at our scale, for a calmer pace with the closer camera) and see 560; minions walk 88.

## Resource Types

```typescript
type ResourceType =
  | 'mana'     // Standard mana pool
  | 'energy'   // Fast regenerating, capped at 200
  | 'rage'     // Builds from combat, decays over time
  | 'health'   // Abilities cost health
  | 'none';    // No resource (cooldown only)
```

## Base Stats

Stats at level 1:

```typescript
interface ChampionBaseStats {
  // Health
  health: number;        // Starting health pool
  healthRegen: number;   // Health per second (x2.5 out of combat); 1-1.8 (LoL lists it per 5 seconds: a LoL value / 5)

  // Resource
  resource: number;      // Starting mana/energy
  resourceRegen: number; // Resource per second (x2.5 out of combat); mana users 2-5

  // Offense
  attackDamage: number;  // Base AD
  abilityPower: number;  // Base AP (usually 0)
  attackSpeed: number;   // Attacks per second (0.625-0.7)
  attackRange: number;   // Attack range in units

  // Defense
  armor: number;         // Physical damage reduction
  magicResist: number;   // Magic damage reduction

  // Mobility
  movementSpeed: number; // Units per second (99-105; minions walk 88)

  // Critical
  critChance: number;    // 0-1, usually 0 at base
  critDamage: number;    // Multiplier, default 2.0
}
```

The HUD shows the health and resource regenerated per second right now on their bars (`+1.6`): the server
sends them in the champion snapshot (`healthRegen`, `resourceRegen`, from `ServerChampion.getRegeneration()`:
the stats, x2.5 out of combat). Health regen used to be LoL's per-5-seconds numbers read per second (8 a
second at level 1, 20 out of combat), so trades healed back in seconds; items and buffs that add it
(Mossweave Band +1, Oakbark Buckler +0.6, the red buff +1.5) are per second too.

**Against the classic MOBA** (its 173 champions' averages, from its wiki's base stats table): level 1
health 617 (ours 612: everyone got +50), attack damage 59 (57), armor 30 (29), magic resist 31 (31),
attack speed 0.65 (0.64). Ours grow linearly and theirs on a curve, so at level 6 both are about 1050
health and at 18 ours have about 12% less. It takes about 15 basic attacks to kill an average level 1
champion (14 there); a rank 1 damaging ability takes 9-18% of its health, and Q3 W1 E1 R1 at level 6
about a quarter without items (a mage's a third), as there. `bun run duels` measures champions
against each other.

## Growth Stats

Stats gained per level:

```typescript
interface ChampionGrowthStats {
  health: number;        // +95 typical
  healthRegen: number;   // +0.1-0.2 typical
  resource: number;      // +45 typical
  resourceRegen: number; // +0.7 typical
  attackDamage: number;  // +3.5 typical
  attackSpeed: number;   // +0.025 typical (percentage)
  armor: number;         // +4.2 typical
  magicResist: number;   // +2.05 typical
}
```

## Health bar

A champion's health bar goes above the top of its art: the visible part of its idle
strip's first frame (`getTop` on its body renderer, `getSpriteTop` in
`src/render/entities/shared.ts`), or above `visualHeight` when that's higher. A staff or a
hood that reaches above the height the definition gives no longer sits under the bar.

## Stat Calculation

Items add stats of their own: penetration, crit, life steal, omnivamp, heal and shield
power and tenacity (`ItemCombatStats`; see [items.md](items.md#stats)). Basic attacks
crit with `critChance` for `critDamage` times their damage. A champion's death counts
the enemy champions that hurt it in the last 15 seconds: if a tower, minion or monster
lands the last hit, the kill goes to the one of them that hurt it last (so nothing steals
it), and the others get assists (and half the kill gold among them).

```typescript
function calculateStat(
  base: number,
  growth: number,
  level: number
): number {
  return base + growth * (level - 1);
}

// Example: Health at level 10
// base=630, growth=95
// 630 + 95 * (10-1) = 630 + 855 = 1485
```

### Attack Speed Calculation

Attack speed scales differently:

```typescript
function calculateAttackSpeed(
  base: number,
  growthPercent: number,
  level: number,
  bonusPercent: number
): number {
  const levelBonus = growthPercent * (level - 1);
  return base * (1 + levelBonus + bonusPercent);
}

// Example: Attack speed at level 10 with 20% bonus
// base=0.658, growth=0.025
// 0.658 * (1 + 0.025*9 + 0.2) = 0.658 * 1.425 = 0.938
```

## Champion Definition

Static champion data:

```typescript
interface ChampionDefinition {
  id: string;           // Unique identifier
  name: string;         // Display name
  title: string;        // "The Warrior", etc.

  class: ChampionClass;
  attackType: AttackType;
  resourceType: ResourceType;

  baseStats: ChampionBaseStats;
  growthStats: ChampionGrowthStats;

  abilities: {
    Q: AbilityDefinition;
    W: AbilityDefinition;
    E: AbilityDefinition;
    R: AbilityDefinition;
  };
}
```

## Example: Warrior Champion

```typescript
const warriorDefinition: ChampionDefinition = {
  id: 'warrior',
  name: 'Warrior',
  title: 'The Brave',

  class: 'warrior',
  attackType: 'melee',
  resourceType: 'mana',

  baseStats: {
    health: 630,
    healthRegen: 1.6,
    resource: 280,
    resourceRegen: 7.5,
    attackDamage: 60,
    abilityPower: 0,
    attackSpeed: 0.658,
    attackRange: 55,
    armor: 35,
    magicResist: 32,
    movementSpeed: 103,
    critChance: 0,
    critDamage: 2.0,
  },

  growthStats: {
    health: 95,
    healthRegen: 0.16,
    resource: 45,
    resourceRegen: 0.7,
    attackDamage: 3.5,
    attackSpeed: 0.025,
    armor: 4.2,
    magicResist: 2.05,
  },

  abilities: {
    Q: { /* Slash ability */ },
    W: { /* Shield ability */ },
    E: { /* Charge ability */ },
    R: { /* Ultimate Blow ability */ },
  },
};
```

## Warrior Stats at Level 18

```
Health:      630 + 95 * 17 = 2,245
Mana:        280 + 45 * 17 = 1,045
AD:          60 + 3.5 * 17 = 119.5
Armor:       32 + 3.6 * 17 = 93.2
Magic Resist: 32 + 2.05 * 17 = 66.85
Attack Speed: 0.658 * (1 + 0.025 * 17) = 0.938
```

## Experience and Leveling

### Level Thresholds

```typescript
const LEVEL_EXPERIENCE = [
  0,      // Level 1
  280,    // Level 2
  660,    // Level 3
  1140,   // Level 4
  1720,   // Level 5
  2400,   // Level 6 (Ultimate unlocks)
  3180,   // Level 7
  4060,   // Level 8
  5040,   // Level 9
  6120,   // Level 10
  7300,   // Level 11 (Ultimate rank 2)
  8580,   // Level 12
  9960,   // Level 13
  11440,  // Level 14
  13020,  // Level 15
  14700,  // Level 16 (Ultimate rank 3)
  16480,  // Level 17
  18360,  // Level 18 (Max level)
];
```

These are totals. A champion's `experience` is what it has earned within its current level, and `experienceToNextLevel` is the difference between two totals: 280 at level 1, 380 at level 2, 480 at level 3, and so on (`getExperienceToNextLevel`). A champion that has earned 2400 in total is level 6. In a 1v1 mid bot match that takes about 5-6 minutes. `src/test/ChampionLeveling.test.ts` checks the thresholds.

### Experience Sources

| Source | Experience |
|--------|------------|
| Melee minion | 60 XP |
| Caster minion | 32 XP |
| Siege minion | 92 XP |
| Champion kill | 150-300 XP (scales with level) |
| Assist | 50% of kill XP |
| Tower | 50-100 XP |

### Skill Points

- Gain 1 skill point per level
- Basic abilities (Q/W/E) max at rank 5
- Ultimate (R) unlocks at level 6, max rank 3
- Can level R at levels 6, 11, 16

## Champion State (Runtime)

```typescript
interface ChampionState {
  // Current resources
  health: number;
  resource: number;

  // Progression
  level: number;
  experience: number;
  skillPoints: number;

  // Ability ranks
  abilityRanks: {
    Q: number;  // 0-5
    W: number;  // 0-5
    E: number;  // 0-5
    R: number;  // 0-3
  };

  // Combat state
  inCombat: boolean;
  timeSinceCombat: number;

  // Death state
  isDead: boolean;
  respawnTimer: number;

  // Active modifiers from items/effects
  modifiers: StatModifier[];
}
```

## Stat Modifiers

Temporary stat changes from items, buffs, etc:

```typescript
interface StatModifier {
  source: string;  // Item ID, effect ID, etc.

  // Flat bonuses (+50 AD)
  flat?: Partial<ChampionBaseStats>;

  // Percentage bonuses (1.1 = +10%)
  percent?: Partial<ChampionBaseStats>;

  // Duration in seconds, and the time it has left (no timeRemaining = permanent)
  duration?: number;
  timeRemaining?: number;
}
```

A modifier with a `timeRemaining` counts down every tick and is dropped when it runs out
(`tickStatModifiers` in `champion/ChampionStats.ts`): Vex's Ninja Mode attack speed, a stat
transform's stats. Extending the effect that goes with one (`extendEffectDuration`, Ninja Mode on
a kill) extends the modifier too.

## Effective Stats Calculation

```typescript
function getEffectiveStats(
  baseStats: ChampionBaseStats,
  growthStats: ChampionGrowthStats,
  level: number,
  modifiers: StatModifier[]
): ChampionStats {
  // 1. Calculate level-scaled stats
  const stats = calculateStatsAtLevel(baseStats, growthStats, level);

  // 2. Apply flat modifiers
  for (const mod of modifiers) {
    if (mod.flat) {
      for (const [key, value] of Object.entries(mod.flat)) {
        stats[key] += value;
      }
    }
  }

  // 3. Apply percentage modifiers
  for (const mod of modifiers) {
    if (mod.percent) {
      for (const [key, value] of Object.entries(mod.percent)) {
        stats[key] *= value;
      }
    }
  }

  return stats;
}
```

## Damage Calculation

### Physical Damage

```typescript
// 100 damage vs 50 armor: reduction = 50 / 150 = 0.333, 66.7 damage
calculatePhysicalDamage(rawDamage, targetArmor, armorPenFlat, armorPenPercent)
```

Every unit reduces the damage it takes in one place, `ServerEntity.calculateDamage`, from the
resists it declares (`getResists()`: a champion's current stats, a minion's or tower's stats,
the nexus and inhibitors' fixed values; jungle monsters have none), less the attacker's **armor
penetration** (`getArmorPenetration()` of whatever dealt the damage, flat, never below 0
armor). A champion's comes from effects with an `armor_penetration` stat and from its hooks
(`IChampionHooks.getArmorPenetration`: 10-26 for 4 s after Urûk's Spear Charge).

### Magic Damage

```typescript
function calculateMagicDamage(
  rawDamage: number,
  targetMagicResist: number
): number {
  const effectiveMR = Math.max(targetMagicResist, 0);
  const reduction = effectiveMR / (100 + effectiveMR);
  return rawDamage * (1 - reduction);
}
```

### True Damage

```typescript
function calculateTrueDamage(rawDamage: number): number {
  return rawDamage;  // No reduction
}
```

## Respawn Timer

```typescript
function calculateRespawnTime(level: number): number {
  // Base respawn time increases with level
  const baseTime = 10 + level * 2.5;

  // Late game penalty
  if (level >= 11) {
    return baseTime + (level - 10) * 5;
  }

  return baseTime;
}

// Level 1: 12.5 seconds
// Level 10: 35 seconds
// Level 18: 55 + 40 = 95 seconds
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/types/champions.ts` | Type definitions |
| `packages/server/src/simulation/ServerChampion.ts` | Server champion: state, tick order, public API |
| `packages/server/src/simulation/champion/` | Champion collaborators (one concern per file, see below) |
| `packages/server/src/server.ts` | Champion definitions |
| `src/render/champions/<championId>.ts` | How the client draws a champion: body, projectiles, status marks |

### Movement orders

A move (right-click) walks the champion along a path around walls (`PathFollower`). Attacking
a unit chases it until it's in attack range. Attack-move (A + left-click, `ATTACK_MOVE`)
walks to the point but attacks the closest visible enemy champion, minion or structure that
comes within attack range (+60) on the way, then walks on (`ServerChampion.updateAttackMove`;
jungle monsters are left alone). Any other move, attack, stop or recall order ends it. On the client, holding A shows the
attack cursor and the click leaves a red move marker; it also works on the minimap.

### Champion art

Vex and Lume have hand-made sprite sheets. The other five are generated with PixelLab by
`scripts/generate-sprites.ts`, in `public/assets/champs/<championId>/`: Vile (a hooded
archer with a bone bow), Kael (`warrior`, a knight with sword and shield), Magnus (a
battlemage with a burning staff), Elara (a priestess with a golden staff) and Gorath (a
stone-armored guardian with a hammer). Each has idle, walk, attack and an animation per
ability (Vile has none for W, his veil). Their ability icons are generated by
`scripts/generate-ability-icons.ts` into `src/assets/abilities/<championId>/`.

All eight champions are playable (`ENABLED_CHAMPIONS` in `src/ui/matchmaking/championSelect.ts`);
champion select shows each one's idle sprite as its portrait (`portraits.ts`). `src/render/champions/stripBody.ts` draws such
strips for any champion: an ability's strip over its cast animation, the attack once per
basic attack, walk while moving, idle otherwise. The generated strips rarely land their
blow where the game does (Magnus stands still for eight frames and throws on the ninth,
with his damage landing halfway; Kael's cleave swept after it had hit), so each champion
names its strips' blow frames (`StripTiming`: `attackBlow`, `abilityBlows`, the third
argument of `generatedStrips`) and `retimedFrame` retimes a strip: the frames before the
blow fill the time until just before it lands, the rest fill what's left. An attack's blow
lands when its damage does (the shared `getBasicAttackDamageDelay` /
`getBasicAttackDuration`, the same the server schedules it with); an ability's when it
takes effect (`abilityImpactTime` in `src/core/state/abilityTiming.ts`: an area after its
`aoeDelay`, a projectile as it's thrown, at once otherwise), which its VFX and sounds use
too. A cast animation lasts at least 0.25 s past that moment. The walk cycle runs at 8 frames a
second at the base pace (100 units a second) and follows the champion's movement speed (0.4x to
1.8x), so a slowed champion's steps slow down and a hasted one's speed up instead of sliding. A champion's `visualHeight` places its
health bar above its art. During Vile's R the server puts a `vile_transformed` marker effect
on him; his renderer draws him 30% bigger with a pulsing violet glow. Champions without art are drawn as a team-colored circle.

**Four directions.** Zhak'rul and Hop-To-Eat are drawn facing east, south and north (west is
east mirrored); the others only sideways. Each of their strips has a `_south` and a `_north` version
(`idle_south.png`), named by the fourth argument of `generatedStrips`. The client turns a
champion up or down the screen once what it faces (its move target or its target; while it
casts, where the ability is aimed, unless that point is at its feet like a cloud around it) is clearly
more above or below it than beside it (`src/render/entities/facing.ts`: 1.25 times, back
sideways under 0.9, so diagonals keep the side view), and draws that direction's strip when it
has one. In `scripts/generate-sprites.ts` such a set has `directions`, a `reference` (the
create-image-pixen take of its south-facing look the character is turned from; a character
drawn "from the side" comes out sideways in every direction), `lockPalette` (every frame on the
character's own colors, plus `paletteExtras` for a prop like Hop's carrot), looping idle and walk (drawn back to their first pose) and, when only
part of what PixelLab drew fits, `trim` (the frames of a strip to keep). Each animation is one
PixelLab animation holding all its directions; PixelLab draws each direction on its own, so the
north one is also told it's seen from behind (told to strike "forward", the scorpion turned
around to face the viewer mid-animation). The descriptions only say how the body moves, since
effects drawn into the sprite clash with the game's own VFX: his first take had a glowing
stinger dripping venom in every frame, and told to burst out of the sand his E drew the dirt,
in his own reds with the palette locked (now he just rears up). Every run checks each
strip for frames that lost part of the body, grew something or jump from the one before;
`--review <dir>` writes contact sheets to look at (a turn-around only shows there), and
`--redo <name>` draws an animation again with another `--seed`. `--new-character
--character-only` makes the character and stops, to look at it facing every direction before
paying for its animations (about USD 0.04 for the character, 0.01 per animation and direction). Where
the hint isn't enough, `directionActions` gives one direction its own action: told to bite or
kick seen from behind, Hop turned round to show its face, so its north bite describes its head
darting forward with its ears flattening back.

## Server Champion

`ServerChampion` (`packages/server/src/simulation/ServerChampion.ts`) extends `ServerEntity`. It is a coordinator:

- It holds the authoritative champion state as public fields
- It runs the per-tick update in a fixed order
- It handles movement, combat state, damage, death/respawn, regeneration, passives, progression (XP, levels, gold) and collision
- It delegates every other concern to a collaborator in `simulation/champion/`

### Collaborators

| File | Concern | Owns private state | Champion methods that delegate to it |
|------|---------|--------------------|--------------------------------------|
| `ChampionStats.ts` | Effective stats: base + growth, then stat modifiers, items, stat effects (pure function `calculateChampionStats`) | none | `getStats` (after the cache check) |
| `ChampionEffects.ts` | Applying, stacking, removing and cleansing effects, over-time ticks, CC status (`calculateCCStatus`), stealth, invulnerability, duration extension, shield decay and absorption | none | `applyEffect`, `removeEffect`, `removeEffectsByCategory`, `cleanse`, `hasEffect`, `getEffect`, `breakStealth`, `isInvulnerable`, `extendEffectDuration` |
| `ChampionBasicAttacks.ts` | Attack timer, attack start (`on_attack`, `BASIC_ATTACK` event), damage at the animation keyframe, ranged projectiles, melee hits, on-hit jungle buffs (`applyOnHitBuffs`), `onMeleeAttackHit` hooks, `on_hit` passives | attack cooldown, attack animation scheduler | (internal, from `updateCombat`) |
| `ChampionAbilities.ts` | Ability leveling (R at 6/11/16), cooldown/cast/recast-window ticking, recasts, ability projectiles scheduled at an animation keyframe | recast hit positions, ability animation scheduler | `levelUpAbility`, `scheduleAbilityProjectile`, `enableRecast`, `hasRecastAvailable`, `getRecastHitPosition`, `consumeRecast` |
| `ChampionTransform.ts` | Timed transforms (Vile's R): attack range override and damage aura | transform clock, range override, aura | `setTransformAttackRange`, `startTransformAura`, `getAttackRange`, `isTransformed`, `updateTransformAura` |
| `ChampionForcedMovement.ts` | Dashes and knockbacks, dash hit detection (function `updateForcedMovement`) | none | (internal, from `update`) |
| `ChampionRecall.ts` | Recall channel and teleport to base: B stops the champion and starts it any time while alive, even in combat; moving, attacking or dealing or taking damage cancel it | none | `startRecall`, `cancelRecall` |
| `ChampionTrinket.ts` | Ward charges, cooldown and recharge | none | `canPlaceWard`, `consumeTrinketCharge`, `getTrinketRechargeProgress` |
| `ChampionInventory.ts` | Buying and selling items | none | `buyItem`, `sellItem`, `hasItem` |
| `ChampionSnapshot.ts` | Network snapshot (function `buildChampionSnapshot`) | none | `toSnapshot` |

Rules the structure follows:

- **State that other code reads or writes stays on the champion.** Ability handlers, passives, the ability executor, systems such as fog of war, bots, the sim and tests use `activeEffects`, `ccStatus`, `shields`, `abilityRanks`, `abilityStates`, `forcedMovement`, `dashAbilityId`, `isRecalling`, the trinket fields, `items` and `gold` directly. Collaborators act on these fields through the champion.
- **State only one concern uses lives in that collaborator** (attack cooldown, animation schedulers, recast hit positions, transform timers).
- **Collaborators call back through the champion's public methods** (`getStats`, `takeDamage`, `breakStealth`, `getEffect`, ...) so overrides and test spies see the same calls as before the split.
- Classes are owned by the champion (`private readonly effects = new ChampionEffects(this)`) and keep a reference to it. Single calculations (stats, snapshot, forced movement step) are plain functions that take the champion.
- `ActiveShield` and `ForcedMovement` are defined next to their concern and re-exported from `ServerChampion.ts`.

### Stats cache

`getStats()` caches its result. It recalculates when the cache is empty and then copies `maxHealth`, `maxResource` and `movementSpeed` onto the champion. The cache is cleared:

- at the end of every tick, and after effects update during the tick
- by `addModifier` / `removeModifier`
- by `applyEffect`, `removeEffect`, `removeEffectsByCategory` and `cleanse` (not `breakStealth`)
- by `buyItem` / `sellItem` and level-ups

Collaborators clear it with `invalidateStats()`. Code that changes `items`, `level` or `activeEffects` directly must call `invalidateStats()` (or wait for the next tick) to see the new stats.

### Tick order

`ServerChampion.update(dt, context)` runs, in order:

1. Advance the transform clock (also while dead)
2. If dead: count down the respawn timer, respawn when it ends, and stop here
3. Forced movement if one is active, otherwise normal movement if CC allows
4. Combat: attack cooldown, combat timeout, target visibility check, start an auto-attack if ready
5. Scheduled basic attack damage (cancelled if the champion can't attack)
6. Scheduled ability projectiles (cancelled if the champion can't cast)
7. Ability cooldowns, cast times and recast windows
8. Effects: over-time ticks, durations, CC status; then timed stat modifiers count down
9. Transform aura damage
10. Shield decay
11. Recall progress (if recalling)
12. Health and resource regeneration
13. Trinket recharge
14. Passive state (trigger system, low-health trigger, champion hooks)
15. Passive gold income
16. Clear the stats cache

### Where to add code

- A new rule for an existing concern goes in its collaborator.
- A new concern with its own state gets a new collaborator in `simulation/champion/`, owned by `ServerChampion`, called from `update()` at a fixed point. Add it to the table above.
- Champion-specific rules usually belong in ability handlers or champion hooks (`packages/server/src/abilities/`) rather than in `ServerChampion`.

## Adding New Champions

Urûk, Oitboil, Elora, Caelum, Fenris, Calamitus, Protobot 45 and Hop-To-Eat were added this way, all adapted from the
user's own card game, and Zhak'rul, designed by the user (see their files for examples; Oitboil's passive is heat shown as the
passive's stacks, with `stackName` naming them in the tooltip, and Elora's is her aim the same way):

| Champion | Role | Kit in short |
|----------|------|--------------|
| Elora, the Master Hunter | Marksman (bot) | The longest bow (240); every third arrow on the same target strikes a weak point. Q poisons her next arrow (bonus damage, slow, poison ticks), W a pinning arrow (root), E a roll and faster attacks, R a barrage down a long lane |
| Caelum, of the Whispering Woods | Support | Lightweaving heals him and allies near him every 8 s once someone is hurt. Q a ray of light (slow), W emboldens an ally (+20% attack damage and ability power, speed), E roots rising after a moment, R Martyr: a quarter of his health to another ally, who heals much more |
| Fenris, the Cursed Howler | Jungle and top | Feral under 40% health (+30% ability damage, a bigger bite heal, speed). Q a bite that heals, W a rake of claws (slow), E a pounce, R Bloodthirst: faster attacks with life steal, a kill heals him to full |
| Calamitus, the Flowing Magma | Tank (top, support) | His Q and W leave pools of lava that burn enemies; in his lava he gains 15 armor and magic resist (one effect, Lavaborn). Q lava around him, W a landslide down a line leaving a stream of lava, E an obsidian shield (stronger on his lava), R after 0.6 s every pool erupts, and the ground around where he cast it, and stuns |
| Protobot 45, the Sentient Machine | Tank (support, top) | Machine Learning: each time an enemy champion damages him (once a second) he gains 3 armor and magic resist for 6 s, up to 6 times. Q a magnetic claw: the first enemy hit is damaged, a champion is pulled to him (stunned on the way) and he gains a shield. W a shield and speed, E a rocket punch (knock-up, a small shield), R a pulse after half a second: damage, silence, and it breaks enemy champions' shields |
| Zhak'rul, the Ancient Scorpion | Fighter on ability power (jungle, top) | Ancient Venom: basic attacks, Toxic Cloud and Death Stinger poison for 3 s (magic damage each second per dose, up to 3; at 3 it's ancient, +40%); the doses are kept on him so monsters are poisoned too, and the bots build ability power (`CHAMPION_BUILDS` in `LaneBot.ts`). Q pincers in a cone, +10% per dose on the target, W a cloud that stays 4 s (slows, hurts 25% more each second an enemy stays, a dose each second), E travels underground, under walls too, and bursts out (knock-up), R a stinger: stun, then magic damage over 3 s (+15% per dose) and every dose |
| Hop-To-Eat, Deadly Cuteness | Assassin (jungle, mid) | Hop to It!: every 6 s its next basic attack reaches 250 and hops onto the target (a dash timed to land before the blow) for bonus damage. Q a bite through armor (-10 armor for 4 s, refreshed by another bite, then the damage), W eats a carrot (a heal on missing health, rooted 0.75 s, then +30% attack speed), E a hop that readies the next Hop to It!, R a kick that sends an enemy champion flying 380, stunned; enemy champions it crashes into take the same damage and are knocked up for 1 s |


1. **Definition** (`packages/shared/src/champions/definitions/<id>.ts`): stats, Q/W/E/R and the
   passive. Register it in `definitions/index.ts`, `ChampionRegistry.ts`, `AbilityRegistry.ts` and
   `PassiveRegistry.ts`.
2. **Server rules** (`packages/server/src/abilities/handlers/<id>/`): what the generic paths
   don't do. Give an ability a handler when it uses a field no generic path executes (the
   `AbilityCoverageContract` test says which), and put rules that span abilities or ticks in the
   champion's hooks (`IChampionHooks`: passives, empowered attacks, armor penetration).
   Register them from `abilities/index.ts`.
3. **Effects** (`packages/server/src/data/effects.ts`) for its buffs, and their names and icons on
   the client (`src/data/effectDisplayInfo.ts`, `src/render/overlays/statusIndicators.ts`).
4. **Scenario** (`packages/server/scenarios/`): its kit piece by piece (`uruk-kit`), and a bot
   playing it (`bot-plays-<id>`); bots read `ABILITY_ROLES` in `LaneBot.ts` for abilities the
   generic rules would misuse, and `ROLE_PICKS` in `practiceMatch.ts` for the roles it suits.
5. **Art** with PixelLab: its sprite set in `scripts/generate-sprites.ts` (a 64 canvas with
   `detail: 'low detail'` reads better at the game's size than the older 96 ones), ability icons
   in `scripts/generate-ability-icons.ts`, a portrait in `scripts/generate-portraits.ts`.
6. **Client**: a renderer in `src/render/champions/<id>.ts` (its scale and its strips' blow
   frames) listed in `CHAMPION_RENDERERS`; VFX in `src/vfx/champions/<id>.ts` imported from
   `src/vfx/champions/index.ts` (cast events that aren't plain casts go in the client contract's
   `OTHER_CAST_EVENT_IDS`); sounds in `src/audio/soundCatalog.ts` with cues in `abilitySounds.ts`;
   any impact time in `src/core/state/abilityTiming.ts`; and `ENABLED_CHAMPIONS` for champion
   select.
