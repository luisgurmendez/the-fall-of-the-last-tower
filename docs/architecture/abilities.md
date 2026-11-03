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
  | 'target_ally'    // Click on ally (itself too, unless excludesSelf: Caelum's Martyr)
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
  charges?: number;                // Abilities with ammo: charges left
  chargeRegenRemaining?: number;   // ...and seconds until the next comes back (0 when full)
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
   - Not crowd controlled (stunned, silenced or taunted: a taunted champion only attacks its taunter, see [effects-and-buffs.md](effects-and-buffs.md#effect-processing))
   - Not already in another ability's cast time
3. Its cast time, if it has one (below): the champion stands still, then it goes off
4. Apply ability effects
5. Deduct mana cost and start cooldown
6. Broadcast state update

### Cast time

Most aimed abilities have a cast time, as in the classic MOBA: for a moment the caster stands
still, facing its aim, and then the ability goes off. It's the tell that makes skillshots
dodgeable and a missed one a commitment: standing still, with nothing else castable and no
basic attacks. `getCastTime()` (`packages/shared/src/types/abilities.ts`) gives an ability's
own `castTime`, or by its kind: skillshots, ground targets and enemy targets take
`DEFAULT_CAST_TIME` (0.25 s); dashes, blinks (and `movesCaster` abilities: Zhak'rul's burrow), self
casts, areas around the caster and casts on allies are instant (a dash is its own commitment, and buffs and saves should answer at once).

- `ServerAbilityExecutor` validates the cast, then `ServerChampion.startCast()` holds it: the
  champion faces its aim, doesn't move (a move order waits for the end) or attack, and drops a
  basic attack in its windup (which may then start again right away). `advanceCast()`, every
  tick, casts it at the end (`completeCast`: the ability, then its mana and cooldown).
- Stun, silence, a taunt or death in the cast time cancels it (`cancelCast`): nothing is spent.
- The cast's ability state has `isCasting` and `castTimeRemaining` while it lasts. Events:
  `ABILITY_WINDUP` when it starts (`castTime`, the aim), then `ABILITY_CAST` when it goes off,
  or `ABILITY_INTERRUPTED`. The client starts the cast animation, facing the aim, on
  `ABILITY_WINDUP`, carries it on through `ABILITY_CAST` and spawns the ability's VFX then
  (`src/core/state/gameEvents.ts`).
- A skillshot's projectile keyframe delay counts from the cast's start: the cast time takes
  it up (Magnus's fireball, at its 0.25 s keyframe, flies when the cast ends).
- An area's `aoeDelay` comes after the cast time (Kael's cleave: 0.25 s still, then 0.2 s swing).
- Bots wait out a cast (`isCasting()`); the test arena's `castAbility` lets it pass unless
  given `casting: true`.

## Server Execution

`ServerAbilityExecutor` is champion-agnostic. It validates the cast (rank, crowd control, cooldown, mana, target), waits out its [cast time](#cast-time), executes the ability one of two ways, then applies cost and cooldown:

1. **Ability handler**: if a handler is registered for the ability ID, it runs instead of the generic path. Handlers live in `packages/server/src/abilities/handlers/<championId>/` and implement `IAbilityHandler`, usually by extending `BaseAbilityHandler`. A handler that implements `canRecast`/`executeRecast` owns the ability's recast. If `canRecast` declines (for example, Lume's orb is already back), the leftover recast window is dropped and the key press is a normal cast. If `executeRecast` fails after `canRecast` accepted, the recast fails with `invalid_target`.
2. **Generic path**: otherwise the executor runs the path for the ability's `targetType` (`self`, `no_target`, `target_enemy`, `target_ally`, `skillshot`, `ground_target`), driven by definition fields such as `damage`, `heal`, `shield`, `appliesEffects`, projectile fields, cones, zones, traps, `statTransform`, `dash` and `teleport`. The paths live in `packages/server/src/abilities/generic/` (see [Generic Paths](#generic-paths)).

Generic path details:
- **`no_target` areas:** effects are split by category. Buffs (`category: 'buff'`) go to the caster and allies in the area. Debuffs and crowd control go to enemies. Gorath's slam no longer slows Gorath, and Elara's speed boost no longer speeds up enemies.
- **`aoeDelay`:** the windup of an area: `no_target` areas, `ground_target` circles, zones, cones and lines (and Lume's R, in its handler) land after the delay, while clients draw a warning filling up, so the area can be dodged. The generic paths use `ServerGameContext.schedule()`, which runs on game time; tests that update entities directly call `context.advanceTime()`, and the test arena's `castAbility` lets the windup pass unless given `windup: true`. A `no_target` area is centered where the caster stood when casting and doesn't land if the caster died; a line lands on the band where it was cast (where its warning is drawn), even if the caster rolled or Flashed since; a cone comes from the caster's position when it lands, aimed where the cast was. The ability VFX read the delay (`landsAt()` in `src/vfx/recipes.ts`), so their impact matches.
- **Dodging:** champions walk about 100 units a second and are 25 units in radius, so a skillshot of radius `r` takes `(r + 25) / 100` seconds to sidestep, plus a reaction. Skillshot speeds are set so a sidestep started a quarter second after the throw clears them from near max range (Magnus's fireball 430 over 440, Vex's shuriken 460 over 380, Vile's arrows 540 over 360-640; they're slowed along with walking, so the sidestep fits the same), and each has a cast time (0.25 s standing still, see [Cast time](#cast-time)) that the caster's animation shows. Ranges and areas follow the map's scale ([map.md](map.md#scale)). The `skillshots-can-be-dodged` simulation scenario checks this.
- **Walls:** projectiles fly over walls, except those of an ability with `stopsOnWall` (Vile's arrow): it stops at the first wall in its way, and an ability that recasts on a hit opens its recast there, as on a unit it hit (`ServerProjectile`).
- **Ammo:** an ability with `ammo` (Vile's traps) starts with its `startingCharges` when learned, spends one per cast and gets one back every `rechargeTime[rank]`, one at a time, up to `maxCharges` (`ChampionAbilities`). With none left the cast fails (`failReason: 'no_ammo'`), nothing spent. The ability state's `charges` and `chargeRegenRemaining` go in the snapshot.
- **Charging:** a `charge` ability charges on the client while its key is held and is cast when let go, with how long it charged (`chargeTime`, kept between `minChargeTime` and `maxChargeTime`); the server adds its share of `maxChargeRangeBonus` to the range. One with `canMoveWhileCharging: false` holds the champion still: the client stops it when the charge starts and sends no move orders until it's let go (`src/core/input/charging.ts`), unless the press is a recast or the ability isn't ready.
- **Out of range:** a `ground_target` aimed past its range is cast at its range, toward where it was aimed (the client sends the cursor; a cone or a line only needs the aim). The range isn't checked again after (rounding put about a third of those spots a hair past it, and the cast failed with no word).
- **What's hit:** `canAbilityAffectEntityType` decides, for every path, dash and handler: champions, minions and monsters unless the ability says otherwise (`affectsChampions`, `affectsMinions`, `affectsJungleCamps`), towers and wards only when it says so (`affectsTowers`, `affectsWards`), and nothing else: projectiles, zones, Lume's orb and blossoms never stop a skillshot or die to one. Heals, shields and buffs reach units only (`isUnitEntityType`; never a structure), for allies too.
- **Ally targets:** a `target_ally` ability with no ally under the cursor that it affects (none, or a minion for a champions-only one like Elara's Sacred Shield and Caelum's Embolden, `affectsMinions: false`, or a tower) goes on the caster, unless `excludesSelf` (Caelum's Martyr fails, nothing spent). An enemy under the cursor is refused.
- **Rooted or grounded:** nothing that moves the caster goes off (`failReason: 'rooted'`, nothing spent): a `dash`, a `teleport`, an ability whose handler moves the caster (`movesCaster`: Zhak'rul's burrow) or a recast that does (`recastMovesCaster`: Vile's arrow); the recast stays for when the root ends.
- **Lines:** a `ground_target` with `shape: 'line'` hits every enemy in a band from the caster toward the target, `range` long and twice `aoeRadius` wide, after its `aoeDelay`, from where the caster stood at the cast (Urûk's Spear Thrust, Elora's Arrow Barrage; `Line.ts`). `entitiesInBand()` there finds who touches any band; Lume's beams use it from her orb.
- **Executes:** `damage.executeBonus` on a targeted ability adds up to that much more damage the less health the target has (0.5: +50% at 0 health, Urûk's Fatal Strike).
- **Zone ticks:** a zone (`zoneDuration` D) with a `zoneTickRate` T hits D / T times, at 0, T, 2T... and not again as it ends (`ServerZone` keeps a little slack on its clock: at 60 Hz rounding gave Magnus's Inferno Zone a sixth burn), whatever the server's tick rate. A zone without a tick rate applies its effects every tick while units are inside.
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
| `GroundTarget.ts` | `ground_target`: picks trap, cone, line or circle; circles, delayed circles and `zoneDuration` zones |
| `Cone.ts` | Cones (`ground_target` with `shape: 'cone'` and `coneAngle`) |
| `Line.ts` | Lines (`ground_target` with `shape: 'line'`): every enemy in a band toward the target |
| `Trap.ts` | Trap placement (`ground_target` with `trap`). A trap (`ServerTrap`) arms a second after it's placed, and a champion it catches can't be caught by another trap for three seconds (`vile_trap_caught`), so traps dropped on someone don't chain into one long root |
| `Movement.ts` | `dash` and `teleport`, run after the path or handler, and the generic recast dash. A `target_enemy` with a `dash` is a leap at the enemy (`leapToTarget`: Kael's Heroic Strike, Urûk's Fatal Strike, Fenris's Pounce): nothing happens at the cast; it flies at the target (following it, over walls, for at most its dash distance and 120 more) and, next to it, the ability's damage and effects land on it alone (an execute reads its health then). A target that dies or gets away isn't hit. A dash puts its `appliesEffects` in the `buff` category on the caster and the rest on what it runs into; a `ground_target` dash with no `aoeRadius` is only the dash, with no circle at its end (Elora's roll quickens her alone). A dash with a hitbox hits each enemy once, only what its ability affects (not towers or wards). Every dash (generic or a handler's) sets `champion.dashAbilityId`, so the snapshot's `isDashing` is true and clients hold the ability's frame of motion and draw its afterimages (`DashSnapshot.test.ts`) |
| `AbilityHelpers.ts` | Scaling stats and effect application shared by the paths |

When a generic path learns a definition field, update its rule in the coverage contract's `GENERIC_SUPPORT`.

### Champion Hooks

Rules that belong to a champion rather than to one ability implement `IChampionHooks` and are registered with `championHooksRegistry` from the champion's `handlers/<championId>/index.ts`:

| Hook | Called by | Example |
|------|-----------|---------|
| `getAbilityDamageMultiplier`, `consumeAbilityDamageMultiplier` | Executor, every cast | Magnus: Arcane Surge +30% damage |
| `breaksStealthOnCast` | Executor, every cast | Vex: Shadow Shroud keeps stealth |
| `modifyAbilityCooldown` | Executor, after ability haste | Vex: Ninja Mode halves Q/E cooldowns |
| `onAbilityCast` | Executor, after a cast is paid for (not recasts) | Oitboil: his abilities heat him up, Blue Fire vents heat |
| `amplifyDamageTo` | `ServerChampion.amplifyDamageTo`, any damage it deals, before resistances and its items | Vex: +10% to an enemy her Shadow Shuriken marked |
| `updatePassiveState` | `ServerChampion`, every tick | Lume: passive follows the Light Orb, and the Prismatic Beam (E) hits along the line from her to it; Oitboil: heat falls, the overheat burns him (damage with no source: not his, for his stats, omnivamp or items); Caelum: Lightweaving's pulse; Fenris: feral under 40% health; Calamitus: tougher in his lava |
| `onMeleeAttackHit` | `ServerChampion`, melee hits (with the damage dealt) | Vex: empowered attack after Shadow Step; Fenris: Bloodthirst's life steal |
| `onRangedAttackHit` | A ranged basic attack's projectile, on hit | Elora: every third arrow on the same target strikes a weak point; the poisoned arrow (both scale with her attack damage, which a crit doesn't raise) |
| `basicAttackProjectileType` | A ranged basic attack about to be fired | Elora: the poisoned arrow and the weak point's arrow look different (their `<type>_impact` VFX play where they land) |
| `onChampionKill` | `ServerChampion.onDeath`, for the killer (an enemy champion with the last hit) | Fenris: a kill in his Bloodthirst heals him to full |
| `getAttackRange` | `ServerChampion.getAttackRange`, given the range it would have | Hop-To-Eat: 250 while its hop is ready (rooted or grounded, the hop waits: melee reach, nothing spent) |
| `onBasicAttackStart` | A basic attack starting, before its blow | Hop-To-Eat: an attack from out of melee reach hops onto the target (a dash); its bonus is basic attack damage (`withDamageKind`), so Veil doesn't block it |
| `onDamaged` | `ServerChampion.takeDamage`, after damage to its health or shields | Protobot: learns from the enemy champions that hit him |

Two engine pieces serve handlers that move or react to other units: a `ServerProjectile` takes an
`onHit(entity, context)` callback, called after its damage (Protobot's claw pulls the champion it
caught), and a `ForcedMovement` (a dash or a knockback, `champion.forcedMovement`) takes `touches`,
a callback for each unit it runs into on the way (the champions Hop-To-Eat's kick sends a champion
flying into). A dash or knockback stops at a wall in its way (`advanceUntilWall`, checked every 4
units): it never comes out on the far side. A `ForcedMovement` with `passesWalls` goes through them
and isn't pushed out of walls while it runs (Zhak'rul burrowed); it should end where
`Terrain.landingSpot` finds open ground, the spot Blink uses too. A `follow` one is a leap at a unit
(`leapToTarget`): it flies at the target wherever it moves, over walls, and lands next to it. The
generic cone (`executeConeAbility`) takes a `damageFor(entity, damage)` callback for damage that
depends on the target (Zhak'rul's pincers on the poisoned). Zones given the same `ZoneHitGroup`
(`ServerZone.ts`) burn as one: a unit standing in several takes one tick's damage per tick interval,
not one from each (the patches of Oitboil's trail of fire, which also never drops a patch on another,
as against a wall where he stopped).

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

When a passive's stacks run out (`stackDuration` after the last one, in `updatePassiveState`), the stat bonus they gave (the `passive_<id>` modifier) goes with them: Gorath's armor drops back as Immovable's stacks expire.

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
