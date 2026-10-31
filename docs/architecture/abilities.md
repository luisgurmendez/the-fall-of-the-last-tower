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
4. The HUD (`ui/hud/abilityBar.ts`) tints a ready ability blue when the champion can't pay for it. If the key is pressed while the ability can't be cast (not learned, on cooldown or too expensive, see `canCastAbility`), its slot flashes red, since the server ignores the press.

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

## Server Execution

`ServerAbilityExecutor` is champion-agnostic. It validates the cast (rank, crowd control, cooldown, mana, target), applies cost and cooldown, then executes the ability one of two ways:

1. **Ability handler**: if a handler is registered for the ability ID, it runs instead of the generic path. Handlers live in `packages/server/src/abilities/handlers/<championId>/` and implement `IAbilityHandler`, usually by extending `BaseAbilityHandler`. A handler that implements `canRecast`/`executeRecast` owns the ability's recast. If `canRecast` declines (for example, Lume's orb is already back), the leftover recast window is dropped and the key press is a normal cast. If `executeRecast` fails after `canRecast` accepted, the recast fails with `invalid_target`.
2. **Generic path**: otherwise the executor runs the path for the ability's `targetType` (`self`, `no_target`, `target_enemy`, `target_ally`, `skillshot`, `ground_target`), driven by definition fields such as `damage`, `heal`, `shield`, `appliesEffects`, projectile fields, cones, zones, traps, `statTransform`, `dash` and `teleport`. The paths live in `packages/server/src/abilities/generic/` (see [Generic Paths](#generic-paths)).

Generic path details:
- **`no_target` areas:** effects are split by category. Buffs (`category: 'buff'`) go to the caster and allies in the area. Debuffs and crowd control go to enemies. Gorath's slam no longer slows Gorath, and Elara's speed boost no longer speeds up enemies.
- **`aoeDelay`:** the windup of an area: `no_target` areas, `ground_target` circles, zones and cones (and Lume's R, in its handler) land after the delay, while clients draw a warning filling up, so the area can be dodged. The generic paths use `ServerGameContext.schedule()`, which runs on game time; tests that update entities directly call `context.advanceTime()`, and the test arena's `castAbility` lets the windup pass unless given `windup: true`. A `no_target` area is centered where the caster stood when casting and doesn't land if the caster died; a cone comes from the caster's position when it lands, aimed where the cast was. The ability VFX read the delay (`landsAt()` in `src/vfx/recipes.ts`), so their impact matches.
- **Dodging:** champions walk about 100 units a second and are 25 units in radius, so a skillshot of radius `r` takes `(r + 25) / 100` seconds to sidestep, plus a reaction. Skillshot speeds are set so a sidestep started a quarter second after the throw clears them from near max range (Magnus's fireball 430 over 440, Vex's shuriken 460 over 380, Vile's arrows 540 over 360-640; they're slowed along with walking, so the sidestep fits the same), and each has a short windup (its animation's projectile keyframe, 0.2-0.25 s) that the VFX show. Ranges and areas follow the map's scale ([map.md](map.md#scale)). The `skillshots-can-be-dodged` simulation scenario checks this.
- **Handler results:** if a handler's `validate` or `execute` fails, the cast fails and costs nothing (no mana, no cooldown). `cooldownOverride`, `skipCooldown` and `skipManaCost` are applied after the standard cooldown; this is how Vex's Shadow Step resets on a marked enemy.

### Generic Paths

`ServerAbilityExecutor` keeps the cast flow: validation, recasts, mana, cooldowns, the `ABILITY_CAST` event and the `on_ability_cast` trigger. It dispatches to plain functions in `packages/server/src/abilities/generic/`, one module per target type or path family. Each takes the cast params, the definition and the rank, plus the damage multiplier where the path deals damage:

| Module | Path |
|--------|------|
| `SelfAbility.ts` | `self`: shield and effects on the caster, or a stat transform |
| `StatTransform.ts` | `statTransform`: timed stat modifiers, attack range override, soul stacks, trap explosions, transform aura |
| `NoTargetArea.ts` | `no_target` areas around the caster: buff/debuff split, `aoeDelay` scheduling |
| `TargetedAbility.ts` | `target_enemy` (damage, effects) and `target_ally` (heal, shield, effects) |
| `Skillshot.ts` | `skillshot` projectiles: animation keyframe delay, charge range bonus |
| `GroundTarget.ts` | `ground_target`: picks trap, cone or circle; circles, delayed circles and `zoneDuration` zones |
| `Cone.ts` | Cones (`ground_target` with `shape: 'cone'` and `coneAngle`) |
| `Trap.ts` | Trap placement (`ground_target` with `trap`) |
| `Movement.ts` | `dash` and `teleport`, run after the path or handler, and the generic recast dash. A dash puts its `appliesEffects` in the `buff` category on the caster and the rest on what it runs into |
| `AbilityHelpers.ts` | Scaling stats and effect application shared by the paths |

When a generic path learns a definition field, update its rule in the coverage contract's `GENERIC_SUPPORT`.

### Champion Hooks

Rules that belong to a champion rather than to one ability implement `IChampionHooks` and are registered with `championHooksRegistry` from the champion's `handlers/<championId>/index.ts`:

| Hook | Called by | Example |
|------|-----------|---------|
| `getAbilityDamageMultiplier`, `consumeAbilityDamageMultiplier` | Executor, every cast | Magnus: Arcane Surge +30% damage |
| `breaksStealthOnCast` | Executor, every cast | Vex: Shadow Shroud keeps stealth |
| `modifyAbilityCooldown` | Executor, after ability haste | Vex: Ninja Mode halves Q/E cooldowns |
| `updatePassiveState` | `ServerChampion`, every tick | Lume: passive follows the Light Orb |
| `onMeleeAttackHit` | `ServerChampion`, melee hits | Vex: empowered attack after Shadow Step |

`initializeAbilityHandlers()` (called at server startup) registers both handlers and hooks.

### Coverage Contract

`packages/server/src/test/AbilityCoverageContract.test.ts` checks every champion in `CHAMPION_DEFINITIONS`: each Q/W/E/R ability must have a registered handler, or use only definition fields the generic path executes for its target type. Its `GENERIC_SUPPORT` table mirrors the executor and the generic path modules and is typed over every `AbilityDefinition` field, so a new field fails the typecheck until it is classified. Known generic-path bugs are listed in `KNOWN_GAPS`.

### Passive Triggers

`PassiveTriggerSystem` registers each champion type's passive under its triggers and dispatches them: `dispatchTrigger` for events (`on_hit`, `on_take_damage`, `on_ability_cast`, `on_kill`, `on_low_health`, ...), and `processAlwaysPassives`/`processIntervalPassives` every tick. A passive registered without its own handler gets a default handler picked from its definition. The default handlers live in `packages/server/src/systems/passives/`:

| Module | Default handler | Picked for | Example |
|--------|-----------------|------------|---------|
| `LowHealthShieldPassive.ts` | `on_low_health_shield` | `on_low_health` with a `shield` | Warrior: Undying Resolve |
| `StackPassives.ts` | `stack_accumulation` | `usesStacks` on `on_ability_cast` | Magnus: Arcane Surge |
| `StackPassives.ts` | `on_hit_damage` | `usesStacks` on `on_hit` with `damage` | Vex: Assassin's Mark |
| `StackPassives.ts` | `on_take_damage_stack` | `usesStacks` on `on_take_damage` | Gorath: Immovable |
| `AuraHealPassive.ts` | `aura_heal` | `always` with `auraRadius` and `heal` | Elara: Blessed Presence |
| `SoulStacksPassive.ts` | `soul_stacks` | `soulScaling` with `usesStacks` | Vile: Souls of Vilix |

Any other passive gets the generic handler, which only marks it active.

### Adding a Champion (Server)

1. Define the champion and its abilities in `packages/shared/src/champions/definitions/`
2. Create `packages/server/src/abilities/handlers/<championId>/index.ts` with a `register<Champion>Handlers()` function, called from `initializeAbilityHandlers()`
3. Add handlers for abilities the generic path cannot run, and hooks for champion-wide rules
4. Run `bun test AbilityCoverageContract` in `packages/server`

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
| `packages/shared/src/champions/definitions/` | Champion ability definitions |
| `packages/server/src/simulation/ServerAbilityExecutor.ts` | Cast validation, recasts, costs, cooldowns, dispatch to a handler or generic path |
| `packages/server/src/abilities/generic/` | Generic execution paths, one module per target type or path family |
| `packages/server/src/abilities/` | Ability handlers, champion hooks and their registries |
| `packages/server/src/systems/PassiveTriggerSystem.ts` | Passive registry and trigger dispatch |
| `packages/server/src/systems/passives/` | Default passive handlers |
| `packages/server/src/simulation/ServerChampion.ts` | Ability state (ranks, cooldowns, recasts) |
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
