# Effects and Buffs System

This document describes the effects system including buffs, debuffs, crowd control, and status effects.

## Overview

Effects are temporary modifiers applied to units. They can modify stats, apply crowd control, deal damage over time, or provide shields.

## Effect Categories

```typescript
type EffectCategory = 'buff' | 'debuff' | 'neutral';

// buff: Positive effect (shield, stat boost)
// debuff: Negative effect (slow, damage over time)
// neutral: Tracking marks, neutral modifiers
```

## Effect Types

### Crowd Control (CC)

```typescript
type CrowdControlType =
  | 'stun'      // Cannot move, attack, or cast
  | 'silence'   // Cannot cast abilities
  | 'grounded'  // Cannot use mobility abilities
  | 'root'      // Cannot move
  | 'blind'     // Basic attacks miss
  | 'disarm'    // Cannot basic attack
  | 'slow'      // Reduced movement speed
  | 'knockup'   // Airborne, cannot act
  | 'knockback' // Pushed away from source
  | 'fear'      // Forced to run away
  | 'charm'     // Forced to walk toward source
  | 'taunt'     // Forced to attack source
  | 'sleep'     // Stunned until damaged
  | 'suppress'; // Complete disable, can't be cleansed
```

### Stat Modifications

```typescript
type StatModificationType =
  | 'attack_damage'
  | 'ability_power'
  | 'armor'
  | 'magic_resist'
  | 'attack_speed'
  | 'movement_speed'
  | 'health_regen'
  | 'mana_regen'
  | 'crit_chance'
  | 'crit_damage'
  | 'lifesteal'
  | 'spell_vamp'
  | 'armor_penetration'
  | 'magic_penetration';
```

### Over-Time Effects

```typescript
type OverTimeType =
  | 'damage'       // Damage over time (DoT)
  | 'heal'         // Heal over time (HoT)
  | 'mana_drain'   // Drain mana
  | 'mana_restore'; // Restore mana
```

## Effect Definition

### Base Effect Definition

```typescript
interface EffectDefinition {
  id: string;
  name: string;
  icon?: string;
  category: EffectCategory;
  duration: number;           // Seconds (-1 for permanent)
  stackBehavior: StackBehavior;
  maxStacks?: number;         // For stackable effects
  cleansable: boolean;        // Can be removed by cleanse
  persistsThroughDeath: boolean;
}
```

### Stack Behavior

How effects behave when reapplied:

```typescript
type StackBehavior =
  | 'refresh'   // Reset duration to full
  | 'extend'    // Add duration to remaining
  | 'stack'     // Add another stack
  | 'replace'   // Replace with new instance
  | 'ignore';   // No effect from reapplication
```

### Crowd Control Effect

```typescript
interface CrowdControlEffectDef extends EffectDefinition {
  ccType: CrowdControlType;
  // Duration in base definition
}

// Example: Stun
{
  id: 'warrior_q_stun',
  name: 'Stunned',
  category: 'debuff',
  duration: 1.5,
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  ccType: 'stun',
}
```

### Stat Modification Effect

```typescript
interface StatModificationEffectDef extends EffectDefinition {
  stat: StatModificationType;
  flatValue?: number;      // Absolute change (+50 AD)
  percentValue?: number;   // Percentage change (0.1 = +10%)
}

// Example: Attack speed buff
{
  id: 'attack_speed_buff',
  name: 'Haste',
  category: 'buff',
  duration: 5,
  stackBehavior: 'stack',
  maxStacks: 3,
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'attack_speed',
  percentValue: 0.15,  // +15% per stack
}
```

### Over-Time Effect

```typescript
interface OverTimeEffectDef extends EffectDefinition {
  otType: OverTimeType;
  valuePerTick: number;
  tickInterval: number;     // Seconds between ticks
  damageType?: DamageType;  // For DoT effects
}

// Example: Burn damage
{
  id: 'burn',
  name: 'Burning',
  category: 'debuff',
  duration: 3,
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  otType: 'damage',
  valuePerTick: 20,
  tickInterval: 0.5,
  damageType: 'magic',
}
```

### Shield Effect

```typescript
interface ShieldEffectDef extends EffectDefinition {
  shieldAmount: number;
  blocksPhysical: boolean;
  blocksMagic: boolean;
}

// Example: Magic shield
{
  id: 'magic_shield',
  name: 'Barrier',
  category: 'buff',
  duration: 3,
  stackBehavior: 'replace',
  cleansable: false,
  persistsThroughDeath: false,
  shieldAmount: 200,
  blocksPhysical: false,
  blocksMagic: true,
}
```

## Active Effect State

Runtime state of an applied effect:

```typescript
interface ActiveEffectState {
  definitionId: string;      // Which effect this is
  sourceId: string;          // Who applied it
  timeRemaining: number;     // Seconds left
  stacks: number;            // Current stack count
  shieldRemaining?: number;  // For shields
  nextTickIn?: number;       // For over-time effects
  instanceId: number;        // Unique ID for tracking
}
```

## Crowd Control Status

Computed from active effects:

```typescript
interface CCStatus {
  canMove: boolean;
  canAttack: boolean;
  canCast: boolean;
  canUseMobilityAbilities: boolean;
  isAirborne: boolean;
}

function computeCCStatus(activeEffects: ActiveEffectState[]): CCStatus {
  const ccTypes = new Set<CrowdControlType>();

  for (const effect of activeEffects) {
    const def = getEffectDefinition(effect.definitionId);
    if (def && 'ccType' in def) {
      ccTypes.add(def.ccType);
    }
  }

  const stunned = ccTypes.has('stun') || ccTypes.has('knockup') ||
                  ccTypes.has('suppress') || ccTypes.has('sleep');
  const rooted = ccTypes.has('root');
  const silenced = ccTypes.has('silence');
  const grounded = ccTypes.has('grounded');
  const disarmed = ccTypes.has('disarm');

  return {
    canMove: !stunned && !rooted,
    canAttack: !stunned && !disarmed,
    canCast: !stunned && !silenced,
    canUseMobilityAbilities: !stunned && !rooted && !silenced && !grounded,
    isAirborne: ccTypes.has('knockup') || ccTypes.has('knockback'),
  };
}
```

## Effect Processing

### Applying Effects

```typescript
function applyEffect(
  target: ServerChampion,
  effectDef: EffectDefinition,
  sourceId: string
): void {
  const existingIndex = target.activeEffects.findIndex(
    e => e.definitionId === effectDef.id
  );

  if (existingIndex >= 0) {
    const existing = target.activeEffects[existingIndex];

    switch (effectDef.stackBehavior) {
      case 'refresh':
        existing.timeRemaining = effectDef.duration;
        break;
      case 'extend':
        existing.timeRemaining += effectDef.duration;
        break;
      case 'stack':
        if (existing.stacks < (effectDef.maxStacks || Infinity)) {
          existing.stacks++;
          existing.timeRemaining = effectDef.duration;
        }
        break;
      case 'replace':
        target.activeEffects[existingIndex] = createEffectState(effectDef, sourceId);
        break;
      case 'ignore':
        // Do nothing
        break;
    }
  } else {
    target.activeEffects.push(createEffectState(effectDef, sourceId));
  }
}
```

### Updating Effects

```typescript
function updateEffects(champion: ServerChampion, dt: number): void {
  const toRemove: number[] = [];

  for (let i = 0; i < champion.activeEffects.length; i++) {
    const effect = champion.activeEffects[i];
    const def = getEffectDefinition(effect.definitionId);

    // Update duration
    effect.timeRemaining -= dt;

    // Process over-time effects
    if (def && 'otType' in def && 'tickInterval' in def) {
      effect.nextTickIn = (effect.nextTickIn || 0) - dt;
      if (effect.nextTickIn <= 0) {
        processOverTimeTick(champion, effect, def);
        effect.nextTickIn = def.tickInterval;
      }
    }

    // Mark expired effects for removal
    if (effect.timeRemaining <= 0) {
      toRemove.push(i);
    }
  }

  // Remove expired effects (reverse order to maintain indices)
  for (let i = toRemove.length - 1; i >= 0; i--) {
    champion.activeEffects.splice(toRemove[i], 1);
  }
}
```

### Calculating Stats with Effects

```typescript
function calculateEffectiveStats(
  baseStats: ChampionStats,
  activeEffects: ActiveEffectState[]
): ChampionStats {
  const stats = { ...baseStats };

  for (const effect of activeEffects) {
    const def = getEffectDefinition(effect.definitionId);
    if (!def || !('stat' in def)) continue;

    const statDef = def as StatModificationEffectDef;
    const stacks = effect.stacks;

    // Apply flat value
    if (statDef.flatValue) {
      stats[statDef.stat] += statDef.flatValue * stacks;
    }

    // Apply percent value
    if (statDef.percentValue) {
      stats[statDef.stat] *= 1 + (statDef.percentValue * stacks);
    }
  }

  return stats;
}
```

## Shield Processing

```typescript
function processShieldDamage(
  champion: ServerChampion,
  damage: number,
  damageType: DamageType
): number {
  let remainingDamage = damage;

  for (const effect of champion.activeEffects) {
    const def = getEffectDefinition(effect.definitionId);
    if (!def || !('shieldAmount' in def)) continue;

    const shieldDef = def as ShieldEffectDef;

    // Check if shield blocks this damage type
    if (damageType === 'physical' && !shieldDef.blocksPhysical) continue;
    if (damageType === 'magic' && !shieldDef.blocksMagic) continue;

    // Absorb damage
    const absorbed = Math.min(effect.shieldRemaining || 0, remainingDamage);
    effect.shieldRemaining = (effect.shieldRemaining || 0) - absorbed;
    remainingDamage -= absorbed;

    // Remove depleted shields
    if (effect.shieldRemaining <= 0) {
      effect.timeRemaining = 0;  // Mark for removal
    }

    if (remainingDamage <= 0) break;
  }

  return remainingDamage;
}
```

## Pre-Defined Effects

Common effects defined in `packages/server/src/data/effects.ts`:

```typescript
// Crowd Control
export const StunEffect: CrowdControlEffectDef = {
  id: 'stun',
  name: 'Stunned',
  category: 'debuff',
  duration: 1.0,
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  ccType: 'stun',
};

export const SilenceEffect: CrowdControlEffectDef = {
  id: 'silence',
  name: 'Silenced',
  category: 'debuff',
  duration: 1.5,
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  ccType: 'silence',
};

export const RootEffect: CrowdControlEffectDef = {
  id: 'root',
  name: 'Rooted',
  category: 'debuff',
  duration: 1.0,
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  ccType: 'root',
};
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/types/effects.ts` | Type definitions |
| `packages/server/src/data/effects.ts` | Pre-defined effects |
| `packages/server/src/simulation/ServerChampion.ts` | Effect application/processing |

## Cleansing Effects

```typescript
function cleanseEffects(champion: ServerChampion): void {
  champion.activeEffects = champion.activeEffects.filter(effect => {
    const def = getEffectDefinition(effect.definitionId);
    return def && !def.cleansable;
  });
}
```

## Tenacity (CC Duration Reduction)

```typescript
function applyTenacity(
  baseDuration: number,
  tenacity: number  // 0-1, where 0.3 = 30% reduction
): number {
  return baseDuration * (1 - tenacity);
}
```
