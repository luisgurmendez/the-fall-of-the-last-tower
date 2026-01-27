# Lume Implementation Plan

## Overview

Lume is a utility mage with a unique persistent **Light Orb** mechanic. The orb orbits Lume when idle, can be sent to locations, and serves as the anchor point for his abilities.

---

## Phase 1: Light Orb Entity System

### 1.1 Define Light Orb Types (`packages/shared/src/types/lightOrb.ts`)

```typescript
export type LightOrbState = 'orbiting' | 'traveling' | 'stationed' | 'destroyed';

export interface LightOrbSnapshot {
  entityId: string;
  entityType: EntityType;
  side: Side;
  ownerId: string;
  x: number;
  y: number;
  state: LightOrbState;
  orbitAngle: number;           // Current angle in radians (for orbiting)
  stationedTimeRemaining: number; // Time left when stationed
  respawnTimeRemaining: number;   // Time until respawn when destroyed
}

export interface LightOrbConfig {
  orbitRadius: number;          // Distance from Lume when orbiting (100 units)
  orbitSpeed: number;           // Radians per second (2.0 = ~115 degrees/sec)
  travelSpeed: number;          // Units per second when traveling (1200)
  stationedDuration: number;    // How long orb stays at location (4 seconds)
  passiveAuraRadius: number;    // Radius for passive effects (300 units)
  allySpeedBonus: number;       // Movement speed bonus for allies (15%)
  enemyDamageAmp: number;       // Damage amplification on enemies (8%)
  respawnTime: number;          // Time to respawn after R (60 seconds)
}
```

**Tests:**
- [ ] LightOrbSnapshot serializes/deserializes correctly
- [ ] LightOrbConfig has valid default values

### 1.2 Create ServerLightOrb Class (`packages/server/src/simulation/ServerLightOrb.ts`)

```typescript
export class ServerLightOrb extends ServerEntity {
  readonly ownerId: string;
  readonly config: LightOrbConfig;

  private state: LightOrbState = 'orbiting';
  private orbitAngle: number = 0;
  private targetPosition: Vector | null = null;
  private stationedTimeRemaining: number = 0;
  private respawnTimeRemaining: number = 0;

  constructor(params: LightOrbParams) { ... }

  // State transitions
  sendTo(position: Vector): void;        // orbiting/stationed -> traveling
  recall(): void;                        // stationed/traveling -> traveling (to owner)
  destroy(): void;                       // any -> destroyed

  // Update loop
  update(dt: number, context: ServerGameContext): void {
    switch (this.state) {
      case 'orbiting': this.updateOrbiting(dt, context); break;
      case 'traveling': this.updateTraveling(dt, context); break;
      case 'stationed': this.updateStationed(dt, context); break;
      case 'destroyed': this.updateDestroyed(dt, context); break;
    }
    this.updatePassiveEffects(context);
  }

  // Network sync
  toSnapshot(): LightOrbSnapshot;
  isCollidable(): boolean { return false; }  // Can't be targeted directly
}
```

**Tests:**
- [ ] Orb orbits owner at correct radius and speed
- [ ] Orb transitions from orbiting to traveling when sendTo() called
- [ ] Orb transitions from traveling to stationed when reaching destination
- [ ] Orb transitions from stationed back to orbiting after duration expires
- [ ] Orb respawns after respawnTime when destroyed
- [ ] Orb position updates correctly each tick

### 1.3 Light Orb State Machine

```
                    ┌──────────────────────────────────────┐
                    │                                      │
                    ▼                                      │
              ┌──────────┐                                 │
    ┌────────▶│ ORBITING │◀──────────┐                     │
    │         └────┬─────┘           │                     │
    │              │                 │                     │
    │         Q cast (sendTo)   Auto-return           Respawn
    │              │           (station timeout)      (after 60s)
    │              ▼                 │                     │
    │         ┌──────────┐          │                     │
    │         │TRAVELING │──────────┤                     │
    │         └────┬─────┘          │                     │
    │              │                │                     │
    │         Reaches target   Q recast (recall)          │
    │              │                │                     │
    │              ▼                │                     │
    │         ┌──────────┐          │                     │
    │         │STATIONED │──────────┘                     │
    │         └────┬─────┘                                │
    │              │                                      │
    │         R cast (destroy)                            │
    │              │                                      │
    │              ▼                                      │
    │         ┌──────────┐                                │
    └─────────│DESTROYED │────────────────────────────────┘
              └──────────┘
```

**Tests:**
- [ ] State machine handles all valid transitions
- [ ] Invalid transitions are rejected/logged
- [ ] State persists correctly across network updates

---

## Phase 2: Passive Ability - Guiding Glow

### 2.1 Define Passive (`packages/shared/src/champions/definitions/lume.ts`)

```typescript
export const LumePassive: PassiveAbilityDefinition = {
  id: 'lume_passive',
  name: 'Guiding Glow',
  description: 'Allies near the Light Orb gain 15% bonus movement speed. Enemies near the orb take 8% increased magic damage from Lume.',
  trigger: 'persistent',
  auraRadius: 300,
};
```

### 2.2 Implement Passive Effects (`ServerLightOrb.updatePassiveEffects`)

```typescript
private updatePassiveEffects(context: ServerGameContext): void {
  if (this.state === 'destroyed') return;

  const owner = context.getEntity(this.ownerId) as ServerChampion;
  const nearbyEntities = context.getEntitiesInRadius(this.position, this.config.passiveAuraRadius);

  for (const entity of nearbyEntities) {
    if (entity instanceof ServerChampion) {
      if (entity.side === owner.side) {
        // Ally: Apply/refresh movement speed buff
        entity.applyEffect('lume_guiding_glow_speed', 0.5, this.ownerId);
      } else {
        // Enemy: Apply/refresh damage amplification debuff
        entity.applyEffect('lume_guiding_glow_amp', 0.5, this.ownerId);
      }
    }
  }
}
```

### 2.3 Define Effects (`packages/server/src/data/effects.ts`)

```typescript
export const LumeGuidingGlowSpeed: EffectDefinition = {
  id: 'lume_guiding_glow_speed',
  name: 'Guiding Glow',
  type: 'buff',
  stat: 'movement_speed',
  percentValue: 0.15,
  isStackable: false,
  isRefreshable: true,
};

export const LumeGuidingGlowAmp: EffectDefinition = {
  id: 'lume_guiding_glow_amp',
  name: 'Exposed by Light',
  type: 'debuff',
  damageAmpMagic: 0.08,  // 8% increased magic damage taken
  isStackable: false,
  isRefreshable: true,
};
```

**Tests:**
- [ ] Allies near orb gain movement speed buff
- [ ] Buff refreshes while in radius, expires when leaving
- [ ] Enemies near orb take increased magic damage from Lume
- [ ] Damage amplification doesn't apply to other champions' magic damage
- [ ] Effects stop when orb is destroyed

---

## Phase 3: Q Ability - Send the Light

### 3.1 Define Q Ability

```typescript
export const LumeQ: AbilityDefinition = {
  id: 'lume_q',
  name: 'Send the Light',
  description: 'Send the Light Orb to a target location, dealing {damage} magic damage to enemies in a small area on arrival. The orb remains stationed for 4 seconds. Recast to recall the orb early.',
  type: 'active',
  targetType: 'ground_target',
  maxRank: 5,
  manaCost: [40, 45, 50, 55, 60],
  cooldown: [8, 7.5, 7, 6.5, 6],
  range: 800,
  damage: {
    type: 'magic',
    scaling: scaling([60, 95, 130, 165, 200], { apRatio: 0.6 }),
  },
  impactRadius: 150,
  recast: {
    id: 'lume_q_recall',
    name: 'Recall Light',
    description: 'Recall the Light Orb to orbit around you.',
    type: 'active',
    targetType: 'self',
    maxRank: 5,
    manaCost: [0, 0, 0, 0, 0],
    cooldown: [0, 0, 0, 0, 0],
  },
  recastCondition: 'always',
  recastWindow: 10, // Recastable while orb is stationed or traveling
};
```

### 3.2 Implement Q Execution

```typescript
// In ServerAbilityExecutor or LumeAbilityHandler
executeQ(champion: ServerChampion, targetPosition: Vector, context: ServerGameContext): void {
  const orb = this.getLumeOrb(champion, context);
  if (!orb || orb.state === 'destroyed') {
    // Can't use Q if orb doesn't exist
    return;
  }

  // Send orb to target
  orb.sendTo(targetPosition);

  // Register arrival callback for damage
  orb.onArrival = () => {
    const enemies = context.getEnemiesInRadius(orb.position, 150, champion.side);
    const damage = this.calculateAbilityDamage(champion, ability, rank);
    for (const enemy of enemies) {
      enemy.takeDamage(damage, 'magic', champion);
    }
  };
}

executeQRecast(champion: ServerChampion, context: ServerGameContext): void {
  const orb = this.getLumeOrb(champion, context);
  if (!orb || orb.state === 'orbiting') return;

  orb.recall();
}
```

**Tests:**
- [ ] Q sends orb to target location
- [ ] Q deals damage on arrival in 150 unit radius
- [ ] Q has correct mana cost and cooldown
- [ ] Recast recalls orb early
- [ ] Q cannot be cast if orb is destroyed
- [ ] Q cooldown starts after orb returns or stations

---

## Phase 4: W Ability - Warmth

### 4.1 Define W Ability

```typescript
export const LumeW: AbilityDefinition = {
  id: 'lume_w',
  name: 'Warmth',
  description: 'The Light Orb pulses, healing allied champions for {heal} and dealing {damage} magic damage to enemy champions within 300 units.',
  type: 'active',
  targetType: 'self', // Activates centered on orb
  maxRank: 5,
  manaCost: [60, 65, 70, 75, 80],
  cooldown: [14, 13, 12, 11, 10],
  range: 0, // Centered on orb, not on Lume
  damage: {
    type: 'magic',
    scaling: scaling([50, 80, 110, 140, 170], { apRatio: 0.5 }),
  },
  heal: {
    scaling: scaling([60, 90, 120, 150, 180], { apRatio: 0.45 }),
  },
  aoeRadius: 300,
};
```

### 4.2 Implement W Execution

```typescript
executeW(champion: ServerChampion, context: ServerGameContext): void {
  const orb = this.getLumeOrb(champion, context);
  if (!orb || orb.state === 'destroyed') return;

  const entitiesInRange = context.getEntitiesInRadius(orb.position, 300);
  const damage = this.calculateAbilityDamage(champion, ability, rank);
  const healAmount = this.calculateAbilityHeal(champion, ability, rank);

  for (const entity of entitiesInRange) {
    if (entity instanceof ServerChampion) {
      if (entity.side === champion.side) {
        entity.heal(healAmount, champion);
      } else {
        entity.takeDamage(damage, 'magic', champion);
      }
    }
  }

  // Visual effect trigger
  context.addVisualEffect({ type: 'warmth_pulse', position: orb.position, radius: 300 });
}
```

**Tests:**
- [ ] W heals allies in 300 unit radius around orb
- [ ] W damages enemies in 300 unit radius around orb
- [ ] W cannot be cast if orb is destroyed
- [ ] W uses correct mana cost and cooldown
- [ ] W scales with AP correctly

---

## Phase 5: E Ability - Dazzle Step

### 5.1 Define E Ability

```typescript
export const LumeE: AbilityDefinition = {
  id: 'lume_e',
  name: 'Dazzle Step',
  description: 'Dash toward the Light Orb. If Lume reaches the orb, nearby enemies within 200 units are blinded for {effectDuration} seconds.',
  type: 'active',
  targetType: 'self', // Dashes toward orb, not a target location
  maxRank: 5,
  manaCost: [50, 50, 50, 50, 50],
  cooldown: [18, 16, 14, 12, 10],
  dash: {
    speed: 1200,
    distance: 600, // Max distance, stops at orb
  },
  appliesEffects: ['blind'],
  effectDuration: [1.0, 1.1, 1.2, 1.3, 1.4],
  effectRadius: 200,
};
```

### 5.2 Implement E Execution

```typescript
executeE(champion: ServerChampion, context: ServerGameContext): void {
  const orb = this.getLumeOrb(champion, context);
  if (!orb || orb.state === 'destroyed') return;

  const direction = orb.position.subtract(champion.position).normalized();
  const distance = Math.min(
    champion.position.distanceTo(orb.position),
    600 // Max dash distance
  );

  champion.forcedMovement = {
    type: 'dash',
    direction,
    distance,
    duration: distance / 1200,
    onComplete: () => {
      // Check if reached orb (within 50 units)
      if (champion.position.distanceTo(orb.position) <= 50) {
        const enemies = context.getEnemiesInRadius(orb.position, 200, champion.side);
        const blindDuration = ability.effectDuration[rank - 1];
        for (const enemy of enemies) {
          enemy.applyEffect('blind', blindDuration, champion.id);
        }
        context.addVisualEffect({ type: 'dazzle_flash', position: orb.position });
      }
    }
  };
}
```

### 5.3 Define Blind Effect

```typescript
export const BlindEffect: EffectDefinition = {
  id: 'blind',
  name: 'Blinded',
  type: 'debuff',
  ccType: 'blind', // Causes auto-attacks to miss
  isStackable: false,
};
```

**Tests:**
- [ ] E dashes Lume toward orb position
- [ ] E stops at orb if within max distance
- [ ] E blinds enemies only if Lume reaches the orb
- [ ] Blind effect causes auto-attacks to miss
- [ ] E cannot be cast if orb is destroyed
- [ ] E uses correct mana cost and cooldown

---

## Phase 6: R Ability - Beaconfall

### 6.1 Define R Ability

```typescript
export const LumeR: AbilityDefinition = {
  id: 'lume_r',
  name: 'Beaconfall',
  description: 'The Light Orb explodes, dealing {damage} magic damage in a 400 unit area and slowing enemies by 40% for {effectDuration} seconds. The orb is destroyed and regenerates after 60 seconds.',
  type: 'active',
  targetType: 'self', // Detonates orb at current position
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [120, 100, 80],
  damage: {
    type: 'magic',
    scaling: scaling([200, 300, 400], { apRatio: 0.8 }),
  },
  appliesEffects: ['slow_40'],
  effectDuration: [2.0, 2.0, 2.0],
  aoeRadius: 400,
};
```

### 6.2 Implement R Execution

```typescript
executeR(champion: ServerChampion, context: ServerGameContext): void {
  const orb = this.getLumeOrb(champion, context);
  if (!orb || orb.state === 'destroyed') return;

  const explosionPosition = orb.position.clone();

  // Deal damage and apply slow
  const enemies = context.getEnemiesInRadius(explosionPosition, 400, champion.side);
  const damage = this.calculateAbilityDamage(champion, ability, rank);

  for (const enemy of enemies) {
    enemy.takeDamage(damage, 'magic', champion);
    enemy.applyEffect('slow_40', 2.0, champion.id);
  }

  // Destroy orb
  orb.destroy();

  // Visual effect
  context.addVisualEffect({ type: 'beaconfall_explosion', position: explosionPosition, radius: 400 });
}
```

**Tests:**
- [ ] R deals damage in 400 unit radius
- [ ] R applies 40% slow for 2 seconds
- [ ] R destroys the orb
- [ ] Orb respawns after 60 seconds
- [ ] R cannot be cast if orb is already destroyed
- [ ] All orb-based abilities are disabled while orb is destroyed
- [ ] R cooldown is independent of orb respawn timer

---

## Phase 7: Champion Registration

### 7.1 Create Definition File (`packages/shared/src/champions/definitions/lume.ts`)

Full champion definition with all abilities and stats.

### 7.2 Update Registries

1. `packages/shared/src/champions/definitions/index.ts` - Export LumeDefinition
2. `packages/shared/src/champions/definitions/index.js` - Add JS export
3. `packages/shared/src/champions/ChampionRegistry.ts` - Register Lume
4. `packages/shared/src/champions/index.js` - Update if needed
5. `packages/shared/src/abilities/AbilityRegistry.ts` - Register Lume abilities

### 7.3 Server-Side Handler

Create `packages/server/src/simulation/champions/LumeHandler.ts` if needed for complex ability logic.

**Tests:**
- [ ] Lume appears in champion registry
- [ ] All abilities are registered correctly
- [ ] Champion can be selected in matchmaking

---

## Phase 8: Client-Side Rendering

### 8.1 Light Orb Renderer

```typescript
// In EntityRenderer or dedicated LightOrbRenderer
renderLightOrb(ctx: CanvasRenderingContext2D, orb: LightOrbSnapshot, interpolation: number): void {
  const { x, y, state, orbitAngle } = orb;

  // Interpolate position for smooth rendering
  const renderX = this.interpolatePosition(orb, 'x', interpolation);
  const renderY = this.interpolatePosition(orb, 'y', interpolation);

  // Draw orb glow
  const gradient = ctx.createRadialGradient(renderX, renderY, 5, renderX, renderY, 30);
  gradient.addColorStop(0, 'rgba(255, 250, 200, 1)');
  gradient.addColorStop(0.5, 'rgba(255, 220, 100, 0.6)');
  gradient.addColorStop(1, 'rgba(255, 180, 50, 0)');

  ctx.beginPath();
  ctx.arc(renderX, renderY, 30, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw core
  ctx.beginPath();
  ctx.arc(renderX, renderY, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFDE8';
  ctx.fill();

  // Draw light trail when traveling
  if (state === 'traveling') {
    this.drawLightTrail(ctx, orb);
  }
}
```

### 8.2 Passive Aura Indicator

Show the 300-unit aura radius around the orb when hovering or when ally is in range.

**Tests:**
- [ ] Orb renders with glow effect
- [ ] Orb position interpolates smoothly
- [ ] Light trail appears when orb is traveling
- [ ] Aura radius indicator shows when appropriate

---

## Phase 9: Integration Tests

### 9.1 Full Gameplay Flow Tests

```typescript
describe('Lume Full Gameplay', () => {
  test('orb orbits Lume on spawn', () => { ... });
  test('Q sends orb, deals damage, recast recalls', () => { ... });
  test('W heals allies and damages enemies around orb', () => { ... });
  test('E dashes to orb and blinds if reached', () => { ... });
  test('R explodes orb, orb respawns after 60s', () => { ... });
  test('abilities disabled while orb destroyed', () => { ... });
  test('passive buffs allies and debuffs enemies', () => { ... });
});
```

### 9.2 Edge Case Tests

- [ ] Orb behavior when Lume dies
- [ ] Orb behavior when Lume respawns
- [ ] Multiple Lumes in game (if ever possible)
- [ ] Orb interaction with displacement effects
- [ ] Orb position during Lume's dash
- [ ] Q during E dash

---

## File Checklist

### Shared Package
- [ ] `packages/shared/src/types/lightOrb.ts` - Light orb types
- [ ] `packages/shared/src/champions/definitions/lume.ts` - Champion definition
- [ ] `packages/shared/src/champions/definitions/index.ts` - Add export
- [ ] `packages/shared/src/champions/definitions/index.js` - Add JS export
- [ ] `packages/shared/src/champions/ChampionRegistry.ts` - Register
- [ ] `packages/shared/src/abilities/AbilityRegistry.ts` - Register abilities

### Server Package
- [ ] `packages/server/src/simulation/ServerLightOrb.ts` - Orb entity
- [ ] `packages/server/src/simulation/champions/LumeHandler.ts` - Ability handler (if needed)
- [ ] `packages/server/src/data/effects.ts` - Add Lume effects
- [ ] `packages/server/src/test/champions/Lume.test.ts` - Tests

### Client Package
- [ ] `src/render/LightOrbRenderer.ts` - Orb rendering (or add to EntityRenderer)
- [ ] `src/sprites/champions/lume.ts` - Lume sprites

---

## Implementation Order

1. **Types First** - Define all interfaces and types
2. **Server Entity** - Implement ServerLightOrb with state machine
3. **Basic Tests** - Verify orb orbiting and state transitions
4. **Q Ability** - Send/recall with damage
5. **Q Tests** - Verify Q behavior
6. **W Ability** - Pulse heal/damage
7. **W Tests** - Verify W behavior
8. **E Ability** - Dash with blind
9. **E Tests** - Verify E behavior
10. **R Ability** - Explosion and destruction
11. **R Tests** - Verify R and respawn
12. **Passive** - Aura effects
13. **Passive Tests** - Verify buffs/debuffs
14. **Integration Tests** - Full gameplay scenarios
15. **Client Rendering** - Visual implementation
16. **Polish** - Visual effects, animations, balance

---

## Balance Notes

| Stat | Value | Reasoning |
|------|-------|-----------|
| Health | 540 + 85/lvl | Standard mage durability |
| Mana | 320 + 45/lvl | Moderate, abilities are mid-cost |
| Attack Range | 550 | Standard ranged |
| Move Speed | 335 | Slightly slow, compensated by E dash |
| Q Range | 800 | Long range for zoning |
| W Radius | 300 | Requires orb positioning |
| E Dash | 1200 speed | Fast dash for safety |
| R Radius | 400 | Large teamfight impact |
| Orb Respawn | 60s | Significant punishment for using R |

---

## Risk Areas

1. **Orb State Sync** - Must ensure orb state is always consistent between server and client
2. **Ability Validation** - All abilities must check orb exists and isn't destroyed
3. **Orb During Death** - What happens to orb when Lume dies? (Proposed: orb stays, destroyed on death, respawns with Lume)
4. **Network Bandwidth** - Orb is an additional entity to sync
5. **Dash to Moving Orb** - E targeting a moving orb during Q travel
