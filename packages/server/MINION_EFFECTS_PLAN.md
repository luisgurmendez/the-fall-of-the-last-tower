# Minion Effects System Implementation Plan

## Overview

Add a simplified effects system to minions so they can be affected by CC (stun, slow, root, knockup) and DoT (damage over time) effects from abilities.

---

## Current State

**Champions have:**
- `activeEffects: ActiveEffectState[]` - tracks all active effects
- `ccStatus: CrowdControlStatus` - computed flags for CC types
- `applyEffect()` - applies/stacks/refreshes effects
- `updateEffects()` - processes timers and DoT ticks
- `calculateCCStatus()` - computes CC from effects
- `getStats()` - applies stat modifiers from effects

**Minions have:**
- None of the above
- Simple `stats` object with fixed values
- Movement speed from `stats.movementSpeed`

---

## Design Decisions

### What minions NEED:
1. **CC Effects**: stun, slow, root, knockup, taunt
2. **DoT Effects**: burn, poison, etc.
3. **Movement speed modification** from slows

### What minions DON'T NEED:
1. Shields (champions only)
2. Stat modifiers (armor/MR changes) - keep minions simple
3. Mana effects (minions don't have mana)
4. Complex stacking behaviors - use simple refresh

### Simplified CC Status for Minions:
```typescript
interface MinionCCStatus {
  isStunned: boolean;    // Can't move or attack
  isRooted: boolean;     // Can't move but can attack
  slowPercent: number;   // 0-1, movement speed reduction
  canMove: boolean;      // Computed
  canAttack: boolean;    // Computed
}
```

---

## Implementation Steps

### Step 1: Add Effect Types to ServerMinion

**File: `packages/server/src/simulation/ServerMinion.ts`**

Add imports:
```typescript
import { ActiveEffectState } from '@siege/shared';
import {
  getServerEffectById,
  isCCEffect,
  isOverTimeEffect,
  ServerCCEffectDef,
  ServerOverTimeEffectDef
} from '../data/effects';
```

Add properties:
```typescript
// Effects
activeEffects: ActiveEffectState[] = [];
ccStatus: MinionCCStatus = {
  isStunned: false,
  isRooted: false,
  slowPercent: 0,
  canMove: true,
  canAttack: true
};
```

### Step 2: Add applyEffect() Method

```typescript
applyEffect(effectId: string, duration: number, sourceId?: string, stacks = 1): void {
  const def = getServerEffectById(effectId);
  if (!def) return;

  // Check for existing effect
  const existing = this.activeEffects.find(e => e.definitionId === effectId);

  if (existing) {
    // Simple refresh behavior for minions
    existing.timeRemaining = Math.max(existing.timeRemaining, duration);
    existing.stacks = Math.min((existing.stacks || 1) + stacks, def.maxStacks || 5);
  } else {
    // Add new effect
    this.activeEffects.push({
      definitionId: effectId,
      sourceId,
      timeRemaining: duration,
      totalDuration: duration,
      stacks,
    });
  }
}
```

### Step 3: Add updateEffects() Method

```typescript
private updateEffects(dt: number, context: ServerGameContext): void {
  // Process effects and update timers
  this.activeEffects = this.activeEffects.filter(effect => {
    const def = getServerEffectById(effect.definitionId);

    // Handle DoT effects
    if (def && isOverTimeEffect(def)) {
      this.processOverTimeEffect(effect, def as ServerOverTimeEffectDef, dt, context);
    }

    // Update timer
    effect.timeRemaining -= dt;
    return effect.timeRemaining > 0;
  });

  // Recalculate CC status
  this.ccStatus = this.calculateCCStatus();
}

private processOverTimeEffect(
  effect: ActiveEffectState,
  def: ServerOverTimeEffectDef,
  dt: number,
  context: ServerGameContext
): void {
  if (effect.nextTickIn === undefined) {
    effect.nextTickIn = def.tickInterval;
  }

  effect.nextTickIn -= dt;

  while (effect.nextTickIn <= 0) {
    const tickValue = def.valuePerTick * (effect.stacks || 1);

    if (def.otType === 'damage') {
      this.takeDamage(tickValue, def.damageType || 'magic', effect.sourceId || '', context);
    } else if (def.otType === 'heal') {
      this.heal(tickValue);
    }

    effect.nextTickIn += def.tickInterval;
  }
}

private calculateCCStatus(): MinionCCStatus {
  const status: MinionCCStatus = {
    isStunned: false,
    isRooted: false,
    slowPercent: 0,
    canMove: true,
    canAttack: true,
  };

  for (const effect of this.activeEffects) {
    const def = getServerEffectById(effect.definitionId);
    if (!def || !isCCEffect(def)) continue;

    const ccDef = def as ServerCCEffectDef;
    switch (ccDef.ccType) {
      case 'stun':
      case 'knockup':
      case 'knockback':
      case 'suppress':
        status.isStunned = true;
        break;
      case 'root':
        status.isRooted = true;
        break;
      case 'slow':
        // Extract slow percentage from effect ID (e.g., 'slow_30' -> 0.3)
        const match = effect.definitionId.match(/slow_(\d+)/);
        if (match) {
          const slowAmount = parseInt(match[1]) / 100;
          status.slowPercent = Math.max(status.slowPercent, slowAmount);
        }
        break;
      case 'taunt':
        // Taunt makes minion attack the taunter
        // Will be handled separately
        break;
    }
  }

  status.canMove = !status.isStunned && !status.isRooted;
  status.canAttack = !status.isStunned;

  return status;
}
```

### Step 4: Add getEffectiveMovementSpeed() Method

```typescript
getEffectiveMovementSpeed(): number {
  const baseSpeed = this.stats.movementSpeed;
  const slowReduction = 1 - this.ccStatus.slowPercent;
  return baseSpeed * slowReduction;
}
```

### Step 5: Modify update() Method

```typescript
update(dt: number, context: ServerGameContext): void {
  if (this.isDead) return;

  // Update effects first
  this.updateEffects(dt, context);

  // Update cooldowns
  if (this.attackCooldown > 0) {
    this.attackCooldown -= dt;
  }

  // Update attack animation timer
  if (this.attackAnimationTimer > 0) {
    this.attackAnimationTimer -= dt;
  }

  // Only do combat/movement if not stunned
  if (this.ccStatus.canAttack) {
    this.updateCombat(dt, context);
  }

  if (this.ccStatus.canMove) {
    this.updateMovement(dt, context);
  }
}
```

### Step 6: Modify moveToward() to Use Effective Speed

In `updateMovement()`, change:
```typescript
// Old:
const speed = this.stats.movementSpeed;

// New:
const speed = this.getEffectiveMovementSpeed();
```

### Step 7: Update MinionSnapshot

**File: `packages/shared/src/types/network.ts`**

Add to MinionSnapshot:
```typescript
export interface MinionSnapshot {
  // ... existing fields ...

  // CC status for visual feedback
  isStunned?: boolean;
  isRooted?: boolean;
  slowPercent?: number;
}
```

### Step 8: Update toSnapshot() in ServerMinion

```typescript
toSnapshot(): MinionSnapshot {
  return {
    // ... existing fields ...

    // CC status
    isStunned: this.ccStatus.isStunned,
    isRooted: this.ccStatus.isRooted,
    slowPercent: this.ccStatus.slowPercent > 0 ? this.ccStatus.slowPercent : undefined,
  };
}
```

---

## Files to Modify

1. **`packages/server/src/simulation/ServerMinion.ts`**
   - Add imports for effect types
   - Add `activeEffects` and `ccStatus` properties
   - Add `applyEffect()` method
   - Add `updateEffects()` method
   - Add `processOverTimeEffect()` method
   - Add `calculateCCStatus()` method
   - Add `getEffectiveMovementSpeed()` method
   - Modify `update()` to call `updateEffects()` and respect CC
   - Modify movement to use effective speed
   - Update `toSnapshot()` to include CC status

2. **`packages/shared/src/types/network.ts`**
   - Add CC fields to `MinionSnapshot`

---

## Testing Checklist

- [ ] Magnus Quagmire (E) slows minions
- [ ] Magnus Inferno Zone (R) damages minions over time
- [ ] Gorath Earthquake (R) knockup stops minions
- [ ] Gorath Ground Slam (Q) slow affects minion movement
- [ ] Warrior Charge (E) slow affects minions
- [ ] Stun effects stop minion movement and attacks
- [ ] Root effects stop minion movement but allow attacks
- [ ] Effects expire after duration
- [ ] Multiple slows don't stack (use highest)
- [ ] Client receives CC status for visual feedback

---

## Future Enhancements (Not in Scope)

- Taunt effect makes minion change target to taunter
- Tenacity (CC duration reduction) - minions don't have this
- Shield effects on minions
- Stat modifier effects on minions
