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

**How long crowd control lasts.** Against the classic MOBA's: a slow from an ability 1.25-2 s (a
zone's while inside, lingering 1 s after; Zhak'rul's cloud lingered 0.5 s), a root 1.5-1.75 s,
a stun 1.25 s, a knockup 1 s (it's also the airtime), a taunt 1.5 s, a silence 1.5 s. Shorter
ones read as a flicker, too brief to punish with: Kael's charge slows 30% for 1.5 s and his
leap stuns 1.25 s, Elora's arrow roots 1.75 s, Caelum's roots 1.5 s, Gorath's slam slows 40%
for 1.5 s, Magnus's meteor zone slows 20%. Cheap, spammable control stays short (Vile's traps
root 1 s, the red buff's on-hit slow 10% for 1.5 s). Tenacity shortens them (below).

On the client, crowd control is drawn on the champion it holds (`src/render/overlays/crowdControl.ts`). Stun, suppress and knockup get stars circling the head; root gets vines at the feet (violet for Vile's `vile_root`); silence gets a crossed-out speech bubble; taunt a red "!"; blind a dark cloud. Under the feet, a label names the strongest one (STUNNED, ROOTED, ...) over a bar of its time left. A new CC effect id needs an entry in `CC_EFFECTS` there.

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

One effect can change several stats the same way (`alsoModifies` on the server's definition): one
effect, so one icon on the HUD, for Calamitus's Lavaborn and Protobot's Machine Learning (armor and
magic resist each).

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
  const taunted = ccTypes.has('taunt');  // isTaunted
  const feared = ccTypes.has('fear');    // isFeared

  return {
    canMove: !stunned && !rooted,
    canAttack: !stunned && !disarmed && !feared,
    canCast: !stunned && !silenced && !taunted && !feared,
    canUseMobilityAbilities: !stunned && !rooted && !silenced && !grounded && !taunted && !feared,
    isAirborne: ccTypes.has('knockup') || ccTypes.has('knockback'),
  };
}
```

`ServerAbilityExecutor.castAbility` refuses abilities with a `dash` or `teleport` while `canUseMobilityAbilities` is false (fail reason `rooted`), so rooted and grounded champions can't dash out.

## Effect Processing

**Tenacity** (`ChampionEffects.apply`): crowd control and slows an enemy puts on a
champion last `1 - tenacity` as long (from items like Mystic Treads; several sources
combine). Displacements (knockup, knockback), suppression and stasis aren't shortened.

**Healing reduction**: an effect's `healingReduction` cuts the heals its holder receives
(Wounds 40%, from items; Scorch 40%); the strongest counts (`ChampionEffects.healingReduction`).

**Taunt** (`ccType: 'taunt'`, effect `taunt`, Gorath's Defiant Roar): the taunter is the
effect's `sourceId`. A taunted champion walks to its taunter and basic-attacks it, seen or
not (a roar from a bush still pulls): `ServerChampion.followTaunt`, every tick, makes the
taunter its target and drops an attack winding up on anyone else. It can't cast
(`canCast` is false: the cast fails with `taunted`, and one in its cast time is
interrupted), use summoner spells or dash items, and `InputHandler` ignores its orders to
move, attack-move, attack something else, stop, recall, cast or use a summoner spell
(players and practice bots alike). A taunt whose taunter dies, is gone or is farther than
a champion's sight (560: it blinked or was carried away) ends (`ChampionEffects.taunter`).
After it, the champion keeps attacking the taunter until ordered otherwise. Tenacity
shortens it. A taunted jungle monster fights its taunter (an idle camp turns on it, as
when hit) and keeps on after: a taunt takes a monster's aggro ([jungle.md](jungle.md)).
Minions aren't taunted (the roar has `affectsMinions: false`).

**Fear** (`ccType: 'fear'`, effect `fear`, Nocthar's Lament): the unit runs straight away
from whoever scared it (the effect's `sourceId`), from wherever the source is now; a source
that's dead or gone leaves it running the way it was going (`simulation/fear.ts`). A feared
champion can't attack, cast (the cast fails with `feared`, and one in its cast time is
interrupted) or use summoner spells, a recall is interrupted, and the input handler ignores
its orders to move, attack, cast or recall, as for a taunt (`ServerChampion.flee`, every
tick). When it ends, the champion stands where the fear left it. Minions, summons and
jungle monsters flee the same way and don't attack meanwhile (a shot already in the air
still lands). Tenacity shortens it.

**Slow resistance**: an effect's `slowResist` shrinks every slow on its holder (a movement
speed effect with a negative value) by that share while it lasts: Vile's Dark Resilience,
after his Veil, halves them. The strongest counts (`ChampionStats`).

**Damage amplification**: an effect's `damageAmpMagic` makes its holder take that share
more magic damage from the effect's source (its `sourceId`) while it lasts: Lume's Guiding
Glow, on enemy champions near her orb, adds 8% to hers. The strongest counts
(`ChampionEffects.damageAmpFrom`, applied in `ServerChampion.takeDamage` before resistances).

**Reveal**: an effect with `revealsHolder` makes its holder seen by its source's team while it
lasts, in the fog and in bushes (not through stealth): `FogOfWarServer.isRevealedTo`. Kip's mark
(`kip_mark`, 4 s, cleansable); see [networking.md](networking.md#fog-of-war-filtering) for the
client's side.

**Rewarding attackers**: an effect with `rewardsAttackers` gives a champion of its source's team
that lands a basic attack on the holder another effect (`ServerChampion.onBasicAttackTaken`,
called by melee hits and by every targeted projectile that isn't an ability's). Kip's mark gives
the attacker `kip_hunt_speed` (+20% movement speed, 1.5 s, refreshed by each attack); minions
and the marked's own team get nothing.

**Stasis** (`ccType: 'stasis'`, effect `item_stasis`, Hourglass of Stillness): the
champion is frozen like a stun and invulnerable; clients draw a golden shell and the
label STASIS. See [items.md](items.md) for the item effects.

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

A cleanse goes by what an effect is (its `category`, `cleansable` and `ccType` in
`packages/server/src/data/effects.ts`), never by its id. Knockups and suppression are
`cleansable: false`. Elara's Divine Intervention (`ElaraRHandler`) takes off her allies the
cleansable debuffs an enemy put on them (an effect with no known source counts as an
enemy's): crowd control, slows, poisons (Elora's, Zhak'rul's), armor shred, summoners' and
items' debuffs; never airborne (knockup, knockback) or suppression, buffs (Elora's poisoned
arrow, Vile's slow resist), or what her team put on itself. The Cleanse summoner spell and
item actives call `ServerChampion.cleanse()`:

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
