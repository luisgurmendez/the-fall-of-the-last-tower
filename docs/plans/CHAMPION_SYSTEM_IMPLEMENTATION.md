# Champion System Implementation Plan

## Goal
Implement a unified champion system that works identically in offline and online modes, with full ability casting, effects, damage calculation, cooldowns, and mana management.

---

## Current State Analysis

### What Exists (Offline Mode)
The offline mode has a complete champion system in `src/champions/` and `src/abilities/`:

1. **Champion.ts** (~2000 lines) - Full implementation:
   - Stats system (base + growth + modifiers)
   - Damage calculation with armor/magic resist
   - Shield system
   - Effect/buff management
   - Ability casting with mana costs
   - Basic attacks (melee + ranged projectiles)
   - Leveling and skill points
   - Item inventory
   - Death/respawn

2. **Ability System** (`src/abilities/`):
   - `Ability.ts` - Base class with cooldowns, scaling
   - `ActiveAbility.ts` - Cast abilities with targeting
   - `PassiveAbility.ts` - Triggered abilities
   - `AbilityProjectile.ts` - Traveling projectiles
   - `AreaOfEffect.ts` - AoE damage zones

3. **Effect System** (`src/effects/`):
   - Buffs/debuffs with duration
   - Stat modifiers (flat + percent)
   - Crowd control (stun, silence, slow, etc.)
   - Damage over time
   - Stack behaviors (refresh, extend, stack)

4. **Champion Implementations** (`src/champions/implementations/`):
   - Magnus (Mage) - Fireball, Shield, Blink, Meteor
   - Elara (Support) - Heal, Barrier, etc.
   - Vex (Assassin)
   - Gorath (Tank)
   - Kira (Marksman)

### What Exists (Server - Partial)
The server has scaffolding but abilities don't do anything:

1. **ServerChampion.ts** - Has stats, cooldowns, but no ability effects
2. **InputHandler.ts** - Validates ability input but doesn't execute effects
3. **ChampionSnapshot** - Syncs state to client but missing active effects

### What's Missing
1. Server doesn't execute ability effects (damage, healing, CC)
2. Server doesn't have ability definitions linked
3. Client online mode doesn't show active effects in HUD
4. No shared ability/effect logic between client and server

---

## Architecture Design

### Principle: Shared Core Logic
Move pure game logic to `@siege/shared` package so both client and server use identical calculations.

```
@siege/shared/
├── src/
│   ├── champions/
│   │   ├── ChampionDefinition.ts    # Champion static data
│   │   ├── ChampionStats.ts         # Stat calculations
│   │   └── index.ts
│   ├── abilities/
│   │   ├── AbilityDefinition.ts     # Ability static data
│   │   ├── AbilityScaling.ts        # Damage/heal calculations
│   │   ├── AbilityRegistry.ts       # All ability definitions
│   │   └── index.ts
│   ├── effects/
│   │   ├── EffectDefinition.ts      # Effect static data
│   │   ├── EffectLogic.ts           # Stack behavior, CC computation
│   │   ├── EffectRegistry.ts        # All effect definitions
│   │   └── index.ts
│   └── combat/
│       ├── DamageCalculation.ts     # Armor/MR formulas
│       └── index.ts
```

### Server Architecture
```
packages/server/src/
├── simulation/
│   ├── ServerChampion.ts            # Uses shared definitions
│   ├── ServerAbilityExecutor.ts     # NEW: Executes ability effects
│   ├── ServerEffectManager.ts       # NEW: Manages active effects
│   └── ServerProjectile.ts          # NEW: Server-side projectiles
└── systems/
    └── CombatSystem.ts              # NEW: Damage resolution
```

### Client Architecture (Online Mode)
```
src/
├── online/
│   ├── OnlineChampionAdapter.ts     # Wraps server state for HUD
│   ├── OnlineEffectRenderer.ts      # NEW: Renders effects from server
│   └── OnlineAbilityAdapter.ts      # Wraps ability state for HUD
└── render/
    └── EntityRenderer.ts            # Already renders champions
```

---

## Implementation Phases

### Phase 1: Shared Definitions (Foundation)
**Goal:** Move all pure game data and calculations to @siege/shared

#### 1.1 Champion Definitions
Move to `@siege/shared/src/champions/`:

```typescript
// ChampionRegistry.ts
export const CHAMPION_DEFINITIONS: Record<string, ChampionDefinition> = {
  magnus: {
    id: 'magnus',
    name: 'Magnus',
    title: 'The Battlemage',
    class: 'mage',
    attackType: 'ranged',
    resourceType: 'mana',
    baseStats: { health: 425, healthRegen: 5, resource: 375, ... },
    growthStats: { health: 85, healthRegen: 0.5, ... },
    abilities: { Q: 'magnus_fireball', W: 'magnus_shield', E: 'magnus_blink', R: 'magnus_meteor' },
  },
  warrior: { ... },
  elara: { ... },
  // etc.
};

export function getChampionDefinition(id: string): ChampionDefinition | undefined;
```

#### 1.2 Ability Definitions
Move to `@siege/shared/src/abilities/`:

```typescript
// AbilityRegistry.ts
export const ABILITY_DEFINITIONS: Record<string, AbilityDefinition> = {
  magnus_fireball: {
    id: 'magnus_fireball',
    name: 'Fireball',
    description: 'Launch a fireball dealing {damage} magic damage',
    type: 'active',
    targetType: 'skillshot',
    maxRank: 5,
    manaCost: [60, 65, 70, 75, 80],
    cooldown: [8, 7.5, 7, 6.5, 6],
    range: 900,
    damage: {
      type: 'magic',
      scaling: { base: [80, 120, 160, 200, 240], apRatio: 0.75 }
    },
    projectileSpeed: 1200,
    projectileRadius: 30,
  },
  // ... all abilities
};

export function getAbilityDefinition(id: string): AbilityDefinition | undefined;
export function calculateAbilityDamage(def: AbilityDefinition, rank: number, stats: ChampionStats): number;
export function calculateAbilityHeal(def: AbilityDefinition, rank: number, stats: ChampionStats): number;
```

#### 1.3 Effect Definitions
Move to `@siege/shared/src/effects/`:

```typescript
// EffectRegistry.ts
export const EFFECT_DEFINITIONS: Record<string, EffectDefinition> = {
  stun: {
    id: 'stun',
    name: 'Stunned',
    category: 'debuff',
    ccType: 'stun',
    cleansable: true,
    stackBehavior: 'refresh',
  },
  slow_30: {
    id: 'slow_30',
    name: 'Slowed',
    category: 'debuff',
    ccType: 'slow',
    statModifications: [{ stat: 'movement_speed', percentValue: -0.30 }],
    cleansable: true,
    stackBehavior: 'refresh',
  },
  // ... all effects
};

export function getEffectDefinition(id: string): EffectDefinition | undefined;
export function computeCCStatus(effects: ActiveEffect[]): CrowdControlStatus;
```

#### 1.4 Combat Calculations
Move to `@siege/shared/src/combat/`:

```typescript
// DamageCalculation.ts
export function calculatePhysicalDamage(rawDamage: number, armor: number): number {
  // Standard MOBA formula: damage * (100 / (100 + armor))
  const effectiveArmor = Math.max(0, armor); // Can't go negative
  return rawDamage * (100 / (100 + effectiveArmor));
}

export function calculateMagicDamage(rawDamage: number, magicResist: number): number {
  const effectiveMR = Math.max(0, magicResist);
  return rawDamage * (100 / (100 + effectiveMR));
}

export function calculateTrueDamage(rawDamage: number): number {
  return rawDamage; // True damage ignores resistances
}

export function calculateDamage(rawDamage: number, type: DamageType, targetStats: { armor: number, magicResist: number }): number;
```

---

### Phase 2: Server-Side Ability Execution
**Goal:** Make abilities actually do something on the server

#### 2.1 ServerAbilityExecutor
New class to execute ability effects:

```typescript
// packages/server/src/simulation/ServerAbilityExecutor.ts
export class ServerAbilityExecutor {
  constructor(private context: ServerGameContext) {}

  /**
   * Execute an ability after validation passes.
   */
  executeAbility(
    caster: ServerChampion,
    slot: AbilitySlot,
    targetType: 'none' | 'position' | 'unit',
    targetX?: number,
    targetY?: number,
    targetEntityId?: string
  ): void {
    const abilityId = caster.definition.abilities[slot];
    const definition = getAbilityDefinition(abilityId);
    if (!definition) return;

    const rank = caster.abilityRanks[slot];

    switch (definition.targetType) {
      case 'skillshot':
        this.executeSkillshot(caster, definition, rank, targetX!, targetY!);
        break;
      case 'ground_target':
        this.executeGroundTarget(caster, definition, rank, targetX!, targetY!);
        break;
      case 'target_enemy':
        this.executeTargetedEnemy(caster, definition, rank, targetEntityId!);
        break;
      case 'self':
        this.executeSelfTarget(caster, definition, rank);
        break;
      // ... other target types
    }
  }

  private executeSkillshot(caster: ServerChampion, def: AbilityDefinition, rank: number, targetX: number, targetY: number): void {
    // Create projectile traveling toward target position
    const direction = new Vector(targetX - caster.position.x, targetY - caster.position.y).normalize();

    const projectile = new ServerProjectile({
      owner: caster,
      position: caster.position.clone(),
      direction,
      speed: def.projectileSpeed!,
      radius: def.projectileRadius!,
      maxDistance: def.range!,
      damage: calculateAbilityDamage(def, rank, caster.getStats()),
      damageType: def.damage!.type,
      effects: def.appliesEffects?.map(id => getEffectDefinition(id)) ?? [],
      piercing: def.piercing ?? false,
    });

    this.context.addProjectile(projectile);
  }

  private executeGroundTarget(caster: ServerChampion, def: AbilityDefinition, rank: number, x: number, y: number): void {
    // Create area of effect at target position
    const aoe = new ServerAreaOfEffect({
      owner: caster,
      position: new Vector(x, y),
      radius: def.aoeRadius!,
      duration: def.aoeDuration ?? 0, // 0 = instant
      tickRate: def.aoeTickRate ?? 0.5,
      damage: calculateAbilityDamage(def, rank, caster.getStats()),
      damageType: def.damage!.type,
      effects: def.appliesEffects?.map(id => getEffectDefinition(id)) ?? [],
    });

    this.context.addAreaOfEffect(aoe);
  }

  private executeTargetedEnemy(caster: ServerChampion, def: AbilityDefinition, rank: number, targetId: string): void {
    const target = this.context.getEntity(targetId) as ServerChampion;
    if (!target || target.isDead) return;

    // Apply damage
    if (def.damage) {
      const damage = calculateAbilityDamage(def, rank, caster.getStats());
      target.takeDamage(damage, def.damage.type, caster);
    }

    // Apply heal to caster if ability heals
    if (def.heal) {
      const heal = calculateAbilityHeal(def, rank, caster.getStats());
      caster.heal(heal);
    }

    // Apply effects to target
    if (def.appliesEffects) {
      for (const effectId of def.appliesEffects) {
        const effectDef = getEffectDefinition(effectId);
        if (effectDef) {
          target.applyEffect(effectDef, caster, def.effectDuration ?? 2);
        }
      }
    }
  }

  private executeSelfTarget(caster: ServerChampion, def: AbilityDefinition, rank: number): void {
    // Shield
    if (def.shield) {
      const shieldAmount = calculateAbilityShield(def, rank, caster.getStats());
      caster.addShield(shieldAmount, def.shield.duration);
    }

    // Self-heal
    if (def.heal) {
      const healAmount = calculateAbilityHeal(def, rank, caster.getStats());
      caster.heal(healAmount);
    }

    // Self-buff
    if (def.appliesEffects) {
      for (const effectId of def.appliesEffects) {
        const effectDef = getEffectDefinition(effectId);
        if (effectDef) {
          caster.applyEffect(effectDef, caster, def.effectDuration ?? 5);
        }
      }
    }

    // Dash (for mobility abilities like blink)
    if (def.dash) {
      // Handled separately via forced movement
    }
  }
}
```

#### 2.2 ServerEffectManager
New class to manage active effects on champions:

```typescript
// packages/server/src/simulation/ServerEffectManager.ts
export class ServerEffectManager {
  /**
   * Apply an effect to a champion.
   */
  applyEffect(
    target: ServerChampion,
    definition: EffectDefinition,
    source: ServerChampion | null,
    duration: number
  ): void {
    const existing = target.activeEffects.find(e => e.definition.id === definition.id);

    switch (definition.stackBehavior) {
      case 'refresh':
        if (existing) {
          existing.timeRemaining = duration;
        } else {
          target.activeEffects.push(this.createEffect(definition, source, duration));
        }
        break;
      case 'extend':
        if (existing) {
          existing.timeRemaining += duration;
        } else {
          target.activeEffects.push(this.createEffect(definition, source, duration));
        }
        break;
      case 'stack':
        if (existing && existing.stacks < (definition.maxStacks ?? 1)) {
          existing.stacks++;
          existing.timeRemaining = duration;
        } else if (!existing) {
          target.activeEffects.push(this.createEffect(definition, source, duration));
        }
        break;
      case 'replace':
        target.activeEffects = target.activeEffects.filter(e => e.definition.id !== definition.id);
        target.activeEffects.push(this.createEffect(definition, source, duration));
        break;
      case 'ignore':
        if (!existing) {
          target.activeEffects.push(this.createEffect(definition, source, duration));
        }
        break;
    }

    // Apply stat modifiers
    this.applyStatModifiers(target, definition);
  }

  /**
   * Update effects each tick - decrement duration, apply DoT, etc.
   */
  updateEffects(champion: ServerChampion, dt: number): void {
    for (const effect of champion.activeEffects) {
      effect.timeRemaining -= dt;

      // Damage/heal over time
      if (effect.definition.overTime) {
        effect.nextTickIn = (effect.nextTickIn ?? effect.definition.overTime.tickInterval) - dt;
        if (effect.nextTickIn <= 0) {
          this.applyOverTimeTick(champion, effect);
          effect.nextTickIn = effect.definition.overTime.tickInterval;
        }
      }
    }

    // Remove expired effects
    const expired = champion.activeEffects.filter(e => e.timeRemaining <= 0);
    for (const effect of expired) {
      this.removeStatModifiers(champion, effect.definition);
    }
    champion.activeEffects = champion.activeEffects.filter(e => e.timeRemaining > 0);
  }

  private applyOverTimeTick(champion: ServerChampion, effect: ActiveEffect): void {
    const ot = effect.definition.overTime!;
    switch (ot.type) {
      case 'damage':
        champion.takeDamage(ot.valuePerTick, ot.damageType ?? 'magic', effect.source);
        break;
      case 'heal':
        champion.heal(ot.valuePerTick);
        break;
    }
  }

  private createEffect(def: EffectDefinition, source: ServerChampion | null, duration: number): ActiveEffect {
    return {
      definition: def,
      source,
      timeRemaining: duration,
      stacks: 1,
      instanceId: `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }
}
```

#### 2.3 ServerProjectile
Server-side projectile that travels and hits targets:

```typescript
// packages/server/src/simulation/ServerProjectile.ts
export class ServerProjectile {
  id: string;
  position: Vector;
  direction: Vector;
  speed: number;
  radius: number;
  maxDistance: number;
  distanceTraveled: number = 0;

  owner: ServerChampion;
  damage: number;
  damageType: DamageType;
  effects: EffectDefinition[];
  piercing: boolean;

  hitTargets: Set<string> = new Set();
  shouldDispose: boolean = false;

  constructor(config: ProjectileConfig) {
    this.id = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // ... assign from config
  }

  update(dt: number, context: ServerGameContext): void {
    // Move projectile
    const moveDistance = this.speed * dt;
    this.position.x += this.direction.x * moveDistance;
    this.position.y += this.direction.y * moveDistance;
    this.distanceTraveled += moveDistance;

    // Check max distance
    if (this.distanceTraveled >= this.maxDistance) {
      this.shouldDispose = true;
      return;
    }

    // Check collisions with enemy champions
    const enemies = context.getChampionsBySide(this.owner.side === 0 ? 1 : 0);
    for (const enemy of enemies) {
      if (this.hitTargets.has(enemy.id)) continue;
      if (enemy.isDead) continue;

      const dist = this.position.distanceTo(enemy.position);
      if (dist <= this.radius + 30) { // 30 = champion collision radius
        this.onHit(enemy, context);
        this.hitTargets.add(enemy.id);

        if (!this.piercing) {
          this.shouldDispose = true;
          return;
        }
      }
    }
  }

  private onHit(target: ServerChampion, context: ServerGameContext): void {
    // Apply damage
    target.takeDamage(this.damage, this.damageType, this.owner);

    // Apply effects
    for (const effectDef of this.effects) {
      context.effectManager.applyEffect(target, effectDef, this.owner, effectDef.defaultDuration ?? 2);
    }
  }
}
```

#### 2.4 Update ServerChampion
Add missing methods:

```typescript
// Add to ServerChampion.ts

// Active effects array
activeEffects: ActiveEffect[] = [];

// Shields
shields: { amount: number; duration: number; source?: string }[] = [];

/**
 * Take damage with armor/MR calculation.
 */
takeDamage(rawDamage: number, type: DamageType, source?: ServerChampion): void {
  // Consume shields first
  let remaining = rawDamage;
  for (const shield of this.shields) {
    if (remaining <= 0) break;
    const absorbed = Math.min(shield.amount, remaining);
    shield.amount -= absorbed;
    remaining -= absorbed;
  }
  this.shields = this.shields.filter(s => s.amount > 0);

  if (remaining <= 0) return;

  // Apply resistance
  const stats = this.getStats();
  const finalDamage = calculateDamage(remaining, type, {
    armor: stats.armor,
    magicResist: stats.magicResist,
  });

  this.health = Math.max(0, this.health - finalDamage);

  // Check death
  if (this.health <= 0 && !this.isDead) {
    this.die(source);
  }
}

/**
 * Heal the champion.
 */
heal(amount: number): void {
  const stats = this.getStats();
  this.health = Math.min(stats.health, this.health + amount);
}

/**
 * Add a shield.
 */
addShield(amount: number, duration: number, source?: string): void {
  this.shields.push({ amount, duration, source });
}

/**
 * Apply an effect.
 */
applyEffect(definition: EffectDefinition, source: ServerChampion | null, duration: number): void {
  // Delegate to effect manager
  this.context.effectManager.applyEffect(this, definition, source, duration);
}

/**
 * Get computed stats including modifiers from effects/items.
 */
getStats(): ComputedChampionStats {
  const base = calculateStatsAtLevel(this.definition.baseStats, this.definition.growthStats, this.level);

  // Apply stat modifiers from effects
  for (const effect of this.activeEffects) {
    if (effect.definition.statModifications) {
      for (const mod of effect.definition.statModifications) {
        // Apply flat and percent modifiers
      }
    }
  }

  // Apply item stats
  // ...

  return base;
}

/**
 * Get CC status from active effects.
 */
getCrowdControlStatus(): CrowdControlStatus {
  return computeCCStatus(this.activeEffects);
}
```

#### 2.5 Update InputHandler
Connect to ability executor:

```typescript
// In InputHandler.handleAbilityInput()

// After validation passes...
const abilityId = champion.definition.abilities[slot];
const definition = getAbilityDefinition(abilityId);

if (!definition) {
  console.warn(`[InputHandler] Unknown ability: ${abilityId}`);
  return;
}

// Get mana cost from definition
const rank = champion.abilityRanks[slot];
const manaCost = definition.manaCost?.[rank - 1] ?? 0;

// Check mana
if (champion.resource < manaCost) {
  console.log(`[InputHandler] Not enough mana for ${slot}`);
  return;
}

// Validate range if targeted
if (definition.range && targetX !== undefined && targetY !== undefined) {
  const distance = champion.position.distanceTo(new Vector(targetX, targetY));
  if (distance > definition.range) {
    console.log(`[InputHandler] Target out of range for ${slot}`);
    return;
  }
}

// Deduct mana
champion.resource -= manaCost;

// Set cooldown from definition
const cooldown = definition.cooldown?.[rank - 1] ?? 10;
champion.abilityCooldowns[slot] = cooldown;

// Execute ability effects
this.abilityExecutor.executeAbility(champion, slot, targetType, targetX, targetY, targetEntityId);

console.log(`[InputHandler] ${champion.playerId} cast ${slot} (${abilityId})`);
```

---

### Phase 3: Network Sync for Effects
**Goal:** Send active effects to client for HUD display

#### 3.1 Update ChampionSnapshot
Add active effects to the snapshot:

```typescript
// packages/shared/src/types/network.ts

interface ChampionSnapshot extends EntitySnapshot {
  // ... existing fields

  // Add active effects for HUD display
  activeEffects: {
    id: string;           // Effect definition ID
    name: string;         // Display name
    icon?: string;        // Icon path
    category: 'buff' | 'debuff' | 'neutral';
    timeRemaining: number;
    stacks: number;
  }[];

  // Add shield amount
  totalShield: number;
}
```

#### 3.2 Update Snapshot Creation
In ServerChampion.createSnapshot():

```typescript
createSnapshot(): ChampionSnapshot {
  return {
    // ... existing fields

    activeEffects: this.activeEffects.map(e => ({
      id: e.definition.id,
      name: e.definition.name,
      icon: e.definition.icon,
      category: e.definition.category,
      timeRemaining: e.timeRemaining,
      stacks: e.stacks,
    })),

    totalShield: this.shields.reduce((sum, s) => sum + s.amount, 0),
  };
}
```

---

### Phase 4: Client-Side Effect Display (Online Mode)
**Goal:** Show active effects in HUD for online mode

#### 4.1 Update OnlineChampionAdapter
Add methods to expose active effects:

```typescript
// src/online/OnlineChampionAdapter.ts

getActiveEffects(): ActiveEffectDisplay[] {
  const snapshot = this.stateManager.getLocalChampionSnapshot();
  if (!snapshot) return [];

  return snapshot.activeEffects.map(e => ({
    id: e.id,
    name: e.name,
    icon: e.icon,
    category: e.category,
    timeRemaining: e.timeRemaining,
    duration: e.timeRemaining, // Total duration not tracked, use remaining
    stacks: e.stacks,
  }));
}

getTotalShield(): number {
  const snapshot = this.stateManager.getLocalChampionSnapshot();
  return snapshot?.totalShield ?? 0;
}
```

#### 4.2 Update ChampionHUD
The HUD already has effect bar rendering. Ensure it works with online adapter:

```typescript
// src/ui/hud/ChampionHUD.ts

// In render method, the effect bar should already work if adapter implements getActiveEffects()
// Just verify the interface is properly implemented
```

#### 4.3 Verify HUD Components
Check these components work with OnlineChampionAdapter:
- `HealthBar` - Shows health + shield
- `ResourceBar` - Shows mana
- `AbilityBar` - Shows cooldowns
- `EffectBar` - Shows active buffs/debuffs (needs to read from adapter)

---

### Phase 5: Define All Abilities
**Goal:** Create complete ability definitions for all champions

#### 5.1 Warrior Abilities
```typescript
// @siege/shared/src/abilities/definitions/warrior.ts

export const WARRIOR_ABILITIES = {
  warrior_slash: {
    id: 'warrior_slash',
    name: 'Slash',
    description: 'Slash enemies in front, dealing {damage} physical damage',
    type: 'active',
    targetType: 'ground_target',
    maxRank: 5,
    manaCost: [40, 45, 50, 55, 60],
    cooldown: [6, 5.5, 5, 4.5, 4],
    range: 300,
    aoeRadius: 150,
    aoeAngle: Math.PI / 2, // 90 degree cone
    shape: 'cone',
    damage: {
      type: 'physical',
      scaling: { base: [60, 95, 130, 165, 200], adRatio: 0.8 }
    },
  },
  warrior_shield: {
    id: 'warrior_shield',
    name: 'Iron Will',
    description: 'Gain a shield absorbing {shield} damage for 3 seconds',
    type: 'active',
    targetType: 'self',
    maxRank: 5,
    manaCost: [60, 65, 70, 75, 80],
    cooldown: [14, 13, 12, 11, 10],
    shield: {
      scaling: { base: [80, 120, 160, 200, 240], bonusHealthRatio: 0.08 },
      duration: 3,
    },
  },
  warrior_charge: {
    id: 'warrior_charge',
    name: 'Charge',
    description: 'Dash forward, dealing {damage} physical damage and slowing enemies by 30% for 1.5s',
    type: 'active',
    targetType: 'skillshot',
    maxRank: 5,
    manaCost: [50, 50, 50, 50, 50],
    cooldown: [12, 11, 10, 9, 8],
    range: 500,
    dash: { speed: 1200, distance: 500 },
    damage: {
      type: 'physical',
      scaling: { base: [50, 85, 120, 155, 190], adRatio: 0.6 }
    },
    appliesEffects: ['slow_30'],
    effectDuration: 1.5,
  },
  warrior_ultimate: {
    id: 'warrior_ultimate',
    name: 'Heroic Strike',
    description: 'Leap to target and slam down, dealing {damage} physical damage and stunning for 1s',
    type: 'active',
    targetType: 'target_enemy',
    maxRank: 3,
    manaCost: [100, 100, 100],
    cooldown: [120, 100, 80],
    range: 600,
    damage: {
      type: 'physical',
      scaling: { base: [150, 250, 350], adRatio: 1.0 }
    },
    appliesEffects: ['stun'],
    effectDuration: 1,
  },
};
```

#### 5.2 Magnus (Mage) Abilities
```typescript
export const MAGNUS_ABILITIES = {
  magnus_fireball: {
    id: 'magnus_fireball',
    name: 'Fireball',
    description: 'Launch a fireball dealing {damage} magic damage',
    type: 'active',
    targetType: 'skillshot',
    maxRank: 5,
    manaCost: [60, 65, 70, 75, 80],
    cooldown: [8, 7.5, 7, 6.5, 6],
    range: 900,
    projectileSpeed: 1200,
    projectileRadius: 30,
    damage: {
      type: 'magic',
      scaling: { base: [80, 120, 160, 200, 240], apRatio: 0.75 }
    },
  },
  magnus_shield: {
    id: 'magnus_shield',
    name: 'Arcane Shield',
    description: 'Create a shield absorbing {shield} damage for 4 seconds',
    type: 'active',
    targetType: 'self',
    maxRank: 5,
    manaCost: [80, 90, 100, 110, 120],
    cooldown: [18, 16, 14, 12, 10],
    shield: {
      scaling: { base: [60, 100, 140, 180, 220], apRatio: 0.4 },
      duration: 4,
    },
  },
  magnus_blink: {
    id: 'magnus_blink',
    name: 'Blink',
    description: 'Teleport to target location',
    type: 'active',
    targetType: 'ground_target',
    maxRank: 5,
    manaCost: [90, 85, 80, 75, 70],
    cooldown: [22, 20, 18, 16, 14],
    range: 450,
    teleport: true, // Instant position change, not dash
  },
  magnus_meteor: {
    id: 'magnus_meteor',
    name: 'Meteor',
    description: 'Call down a meteor dealing {damage} magic damage in an area after 1s delay',
    type: 'active',
    targetType: 'ground_target',
    maxRank: 3,
    manaCost: [100, 100, 100],
    cooldown: [120, 100, 80],
    range: 800,
    aoeRadius: 250,
    aoeDelay: 1,
    damage: {
      type: 'magic',
      scaling: { base: [200, 350, 500], apRatio: 0.9 }
    },
  },
};
```

#### 5.3 Effect Definitions
```typescript
// @siege/shared/src/effects/definitions/cc.ts

export const CC_EFFECTS = {
  stun: {
    id: 'stun',
    name: 'Stunned',
    category: 'debuff',
    ccType: 'stun',
    cleansable: true,
    stackBehavior: 'refresh',
  },
  slow_30: {
    id: 'slow_30',
    name: 'Slowed',
    category: 'debuff',
    ccType: 'slow',
    statModifications: [{ stat: 'movement_speed', percentValue: -0.30 }],
    cleansable: true,
    stackBehavior: 'refresh',
  },
  root: {
    id: 'root',
    name: 'Rooted',
    category: 'debuff',
    ccType: 'root',
    cleansable: true,
    stackBehavior: 'refresh',
  },
  silence: {
    id: 'silence',
    name: 'Silenced',
    category: 'debuff',
    ccType: 'silence',
    cleansable: true,
    stackBehavior: 'refresh',
  },
};
```

---

## Implementation Order

### Week 1: Foundation
1. [ ] Move stat calculations to @siege/shared
2. [ ] Move damage calculations to @siege/shared
3. [ ] Create AbilityRegistry in @siege/shared
4. [ ] Create EffectRegistry in @siege/shared
5. [ ] Define Warrior abilities
6. [ ] Define Magnus abilities

### Week 2: Server Execution
7. [ ] Implement ServerAbilityExecutor
8. [ ] Implement ServerEffectManager
9. [ ] Implement ServerProjectile
10. [ ] Update ServerChampion with takeDamage, heal, shields
11. [ ] Connect InputHandler to ability executor
12. [ ] Test Warrior abilities work

### Week 3: Network & Client
13. [ ] Add activeEffects to ChampionSnapshot
14. [ ] Update OnlineChampionAdapter for effects
15. [ ] Verify ChampionHUD shows effects
16. [ ] Test full flow: cast -> damage -> effect -> HUD display

### Week 4: Polish & More Champions
17. [ ] Define Elara (Support) abilities
18. [ ] Define Vex (Assassin) abilities
19. [ ] Add champion selection (basic)
20. [ ] Test all champions work

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `@siege/shared/src/champions/ChampionRegistry.ts` | All champion definitions |
| `@siege/shared/src/abilities/AbilityRegistry.ts` | All ability definitions |
| `@siege/shared/src/abilities/AbilityScaling.ts` | Damage/heal calculations |
| `@siege/shared/src/effects/EffectRegistry.ts` | All effect definitions |
| `@siege/shared/src/effects/EffectLogic.ts` | Stack/CC logic |
| `@siege/shared/src/combat/DamageCalculation.ts` | Armor/MR formulas |
| `packages/server/src/simulation/ServerAbilityExecutor.ts` | Execute abilities |
| `packages/server/src/simulation/ServerEffectManager.ts` | Manage effects |
| `packages/server/src/simulation/ServerProjectile.ts` | Projectile logic |

### Files to Modify
| File | Changes |
|------|---------|
| `packages/server/src/simulation/ServerChampion.ts` | Add takeDamage, heal, shields, effects |
| `packages/server/src/network/InputHandler.ts` | Use ability definitions, execute abilities |
| `packages/shared/src/types/network.ts` | Add activeEffects to ChampionSnapshot |
| `src/online/OnlineChampionAdapter.ts` | Expose active effects |
| `src/ui/hud/ChampionHUD.ts` | Verify effect bar works |

---

## Success Criteria

1. **Abilities Execute**: Pressing Q/W/E/R actually deals damage/heals/applies CC
2. **Mana Works**: Abilities cost mana, low mana prevents casting
3. **Cooldowns Work**: Abilities go on cooldown, can't spam
4. **Effects Apply**: Stuns stun, slows slow, shields absorb
5. **HUD Shows Effects**: Active buffs/debuffs visible in online mode
6. **Damage Calculated**: Armor/MR reduce damage appropriately
7. **Multiple Champions**: At least Warrior + Magnus work differently

---

## Notes

- The offline mode Champion.ts is ~2000 lines but well-structured
- We can reuse 80%+ of the logic by moving calculations to shared
- Server doesn't need rendering code, just game logic
- Client online mode just needs to read from server state, not compute
- Effect system is the most complex part - handle stacking carefully
