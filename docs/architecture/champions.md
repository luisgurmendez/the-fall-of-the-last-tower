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

// Melee: ~125 attack range
// Ranged: 500-700 attack range
```

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
  healthRegen: number;   // HP/5 seconds

  // Resource
  resource: number;      // Starting mana/energy
  resourceRegen: number; // Resource/5 seconds

  // Offense
  attackDamage: number;  // Base AD
  abilityPower: number;  // Base AP (usually 0)
  attackSpeed: number;   // Attacks per second (0.625-0.7)
  attackRange: number;   // Attack range in units

  // Defense
  armor: number;         // Physical damage reduction
  magicResist: number;   // Magic damage reduction

  // Mobility
  movementSpeed: number; // Units per second (325-355)

  // Critical
  critChance: number;    // 0-1, usually 0 at base
  critDamage: number;    // Multiplier, default 2.0
}
```

## Growth Stats

Stats gained per level:

```typescript
interface ChampionGrowthStats {
  health: number;        // +95 typical
  healthRegen: number;   // +0.8 typical
  resource: number;      // +45 typical
  resourceRegen: number; // +0.7 typical
  attackDamage: number;  // +3.5 typical
  attackSpeed: number;   // +0.025 typical (percentage)
  armor: number;         // +4.2 typical
  magicResist: number;   // +2.05 typical
}
```

## Stat Calculation

```typescript
function calculateStat(
  base: number,
  growth: number,
  level: number
): number {
  return base + growth * (level - 1);
}

// Example: Health at level 10
// base=580, growth=95
// 580 + 95 * (10-1) = 580 + 855 = 1435
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
    health: 580,
    healthRegen: 8.5,
    resource: 280,
    resourceRegen: 7.5,
    attackDamage: 60,
    abilityPower: 0,
    attackSpeed: 0.658,
    attackRange: 125,
    armor: 35,
    magicResist: 32,
    movementSpeed: 345,
    critChance: 0,
    critDamage: 2.0,
  },

  growthStats: {
    health: 95,
    healthRegen: 0.8,
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
Health:      580 + 95 * 17 = 2,195
Mana:        280 + 45 * 17 = 1,045
AD:          60 + 3.5 * 17 = 119.5
Armor:       35 + 4.2 * 17 = 106.4
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

  // Duration (-1 = permanent)
  duration?: number;
}
```

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
function calculatePhysicalDamage(
  rawDamage: number,
  targetArmor: number
): number {
  // Armor can be negative from penetration
  const effectiveArmor = Math.max(targetArmor, 0);
  const reduction = effectiveArmor / (100 + effectiveArmor);
  return rawDamage * (1 - reduction);
}

// Example: 100 damage vs 50 armor
// reduction = 50 / 150 = 0.333
// final = 100 * (1 - 0.333) = 66.7 damage
```

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
| `ChampionRecall.ts` | Recall channel and teleport to base | none | `startRecall`, `cancelRecall` |
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
8. Effects: over-time ticks, durations, CC status
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

1. Create champion definition in `packages/server/src/server.ts`
2. Add ability definitions for Q, W, E, R
3. Implement ability logic in an ability handler, or champion-specific rules in champion hooks (`packages/server/src/abilities/`)
4. Add champion assets (sprites, sounds) on client
5. Register in champion selection UI
