# Abilities System

This document describes how abilities (spells) work in Siege.

## Overview

Abilities are the core combat mechanics for champions. Each champion has 4 ability slots (Q, W, E, R) following standard MOBA conventions.

## Ability Slots

```typescript
type AbilitySlot = 'Q' | 'W' | 'E' | 'R';

// Q, W, E: Basic abilities (max rank 5)
// R: Ultimate ability (max rank 3, unlocks at level 6)
```

## Ability Types

### Active Abilities

Manually cast by the player. Require targeting and mana/resource cost.

### Passive Abilities

Auto-triggered by specific conditions:

```typescript
type PassiveTrigger =
  | 'on_attack'           // When basic attacking
  | 'on_ability_cast'     // When casting any ability
  | 'on_damage_taken'     // When receiving damage
  | 'on_kill'             // When killing a unit
  | 'on_assist'           // When assisting a kill
  | 'on_low_health'       // When health drops below threshold
  | 'on_interval';        // Every X seconds
```

## Target Types

```typescript
type AbilityTargetType =
  | 'self'           // Cast on self (shields, buffs)
  | 'target_enemy'   // Click on enemy
  | 'target_ally'    // Click on ally
  | 'target_unit'    // Click on any unit
  | 'skillshot'      // Direction-based projectile
  | 'ground_target'  // Click on ground location
  | 'aura'           // Persistent area around caster
  | 'toggle'         // Toggle on/off
  | 'no_target';     // Auto-cast (press key)
```

## Ability Definition

Static ability data defined in champion configurations:

```typescript
interface AbilityDefinition {
  id: string;
  name: string;
  description: string;

  // Type and targeting
  type: 'active' | 'passive';
  targetType: AbilityTargetType;

  // Leveling
  maxRank: number;  // 5 for basic, 3 for ultimate

  // Costs per rank
  manaCost: number[];      // [40, 45, 50, 55, 60]
  cooldown: number[];      // [8, 7.5, 7, 6.5, 6] in seconds

  // Range and area
  range: number;
  aoeRadius?: number;
  shape?: 'circle' | 'cone' | 'line' | 'rectangle';

  // Damage configuration
  damage?: {
    type: 'physical' | 'magic' | 'true';
    base: number[];           // Base damage per rank
    adRatio?: number;         // AD scaling (0.6 = +60% AD)
    apRatio?: number;         // AP scaling
    bonusHealthRatio?: number;
    maxHealthRatio?: number;
  };

  // Healing configuration
  heal?: {
    base: number[];
    apRatio?: number;
    missingHealthRatio?: number;
  };

  // Shield configuration
  shield?: {
    base: number[];
    apRatio?: number;
  };

  // Passive trigger (for passive abilities)
  passiveTrigger?: PassiveTrigger;
  passiveCondition?: {
    healthThreshold?: number;  // For on_low_health
    intervalSeconds?: number;  // For on_interval
  };
}
```

## Ability State (Runtime)

Each champion tracks ability state per slot:

```typescript
interface AbilityState {
  rank: number;                    // 0 = not learned, 1-5 = level
  cooldownRemaining: number;       // Seconds until ready
  isCasting: boolean;              // Currently in cast animation
  isToggled: boolean;              // For toggle abilities
  passiveCooldownRemaining: number; // Internal CD for passives
}
```

## Damage Scaling

Abilities scale with champion stats:

```typescript
function calculateAbilityValue(
  base: number[],
  rank: number,
  stats: ChampionStats,
  ratios: {
    adRatio?: number;
    apRatio?: number;
    bonusHealthRatio?: number;
  }
): number {
  let value = base[rank - 1];

  if (ratios.adRatio) {
    value += stats.attackDamage * ratios.adRatio;
  }
  if (ratios.apRatio) {
    value += stats.abilityPower * ratios.apRatio;
  }
  if (ratios.bonusHealthRatio) {
    const bonusHealth = stats.maxHealth - baseHealth;
    value += bonusHealth * ratios.bonusHealthRatio;
  }

  return value;
}
```

## Ability Casting Flow

### Client Side

1. Player presses ability key (Q/W/E/R)
2. `OnlineInputHandler` captures input
3. Send `ABILITY` input to server with:
   - `slot`: Which ability
   - `targetType`: How it's being targeted
   - `targetX`, `targetY`: For ground/skillshot
   - `targetEntityId`: For unit targeting

### Server Side

1. `InputHandler` receives ability input
2. Validate ability can be cast:
   - Rank > 0 (ability learned)
   - Cooldown ready
   - Sufficient mana
   - In range (if targeted)
   - Not crowd controlled (stunned/silenced)
3. Deduct mana cost
4. Apply ability effects
5. Start cooldown
6. Broadcast state update

## Example: Warrior Champion

```typescript
abilities: {
  Q: {
    id: 'warrior_q',
    name: 'Slash',
    description: 'A powerful slash dealing damage',
    maxRank: 5,
    cooldowns: [8, 7.5, 7, 6.5, 6],
    costs: [40, 45, 50, 55, 60],
    ranges: [300, 300, 300, 300, 300],
    targeting: 'direction',
    damageType: 'physical',
  },
  W: {
    id: 'warrior_w',
    name: 'Shield',
    description: 'Gain a protective shield',
    maxRank: 5,
    cooldowns: [14, 13, 12, 11, 10],
    costs: [60, 60, 60, 60, 60],
    ranges: [0, 0, 0, 0, 0],  // Self-cast
    targeting: 'self',
    damageType: 'physical',
  },
  E: {
    id: 'warrior_e',
    name: 'Charge',
    description: 'Dash forward',
    maxRank: 5,
    cooldowns: [12, 11, 10, 9, 8],
    costs: [50, 50, 50, 50, 50],
    ranges: [500, 500, 500, 500, 500],
    targeting: 'direction',
    damageType: 'physical',
  },
  R: {
    id: 'warrior_r',
    name: 'Ultimate Blow',
    description: 'A devastating attack',
    maxRank: 3,  // Ultimate has 3 ranks
    cooldowns: [120, 100, 80],  // Long cooldowns
    costs: [100, 100, 100],
    ranges: [400, 400, 400],
    targeting: 'unit',
    damageType: 'physical',
  },
}
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/types/abilities.ts` | Type definitions |
| `packages/server/src/simulation/ServerChampion.ts` | Server-side ability logic |
| `packages/server/src/server.ts` | Champion ability definitions |
| `src/core/input/OnlineInputHandler.ts` | Client ability input |

## Cooldown Reduction

Cooldown reduction (CDR) reduces ability cooldowns:

```typescript
effectiveCooldown = baseCooldown * (1 - cooldownReduction);
// Max CDR is typically capped at 40%
```

## Ability Haste (Alternative)

Some games use ability haste instead of CDR for linear scaling:

```typescript
effectiveCooldown = baseCooldown * (100 / (100 + abilityHaste));
// 100 haste = 50% more casts
// 200 haste = 66% more casts
```
