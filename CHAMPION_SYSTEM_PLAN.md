# Champion System Design Plan

## Overview

Transform the game from a wave-based tower defense into a League of Legends-style 5v5 champion battle arena. Each champion has 4 unique abilities (passive or active) and fights autonomously or with player control.

---

## Core Concepts

### Champion
A powerful unit with:
- **Health** - Hit points, champion dies at 0
- **Mana** - Resource for casting active abilities
- **4 Abilities** - Bound to Q, W, E, R (can be passive or active)
- **Base Stats** - Attack damage, ability power, armor, magic resist, movement speed
- **Level** - Champions can level up (1-18), improving stats and abilities

### Ability Types

#### Passive Ability
- No mana cost
- No manual activation
- Triggers automatically based on conditions
- Examples: "Gain 10% attack speed after hitting an enemy", "Heal 2% max HP per second when out of combat"

#### Active Ability
- Costs mana to cast
- Has a cooldown
- Requires manual activation (or AI decision)
- Can be: Targeted, Skillshot, Area of Effect (AoE), Self-cast

---

## Ability Targeting Types

| Type | Description | Example |
|------|-------------|---------|
| `self` | Affects only the caster | Shield, heal self |
| `target_enemy` | Requires enemy target | Point-and-click damage |
| `target_ally` | Requires ally target | Heal ally |
| `target_unit` | Any unit | Teleport to unit |
| `skillshot` | Fires in a direction | Linear projectile |
| `ground_target` | Targets a location | AoE at position |
| `aura` | Passive area around champion | Buff nearby allies |
| `toggle` | On/off state | Mana drain for effect |

---

## Damage & Effect System

### Damage Types
- **Physical** - Reduced by Armor
- **Magic** - Reduced by Magic Resist
- **True** - Ignores all resistances
- **Pure** - Cannot be modified by any effect

### Damage Calculation
```
Physical: finalDamage = rawDamage * (100 / (100 + armor))
Magic:    finalDamage = rawDamage * (100 / (100 + magicResist))
True:     finalDamage = rawDamage
```

### Status Effects (Simplified for MVP)

| Effect | Type | Description |
|--------|------|-------------|
| **Stun** | Debuff | Cannot move, attack, or cast (hard CC) |
| **Silence** | Debuff | Cannot cast abilities (can still move/attack) |
| **Grounded** | Debuff | Cannot use movement abilities (can still walk) |
| Shield | Buff | Temporary extra health |

### Effect Duration & Stacking
- Effects have duration in seconds
- Effects can: refresh, extend, stack, or replace based on configuration
- Each effect tracked with source, duration, and stacks

---

## Champion Stats

### Base Stats (Level 1)
```typescript
interface ChampionStats {
  // Resources
  health: number;           // 500-700 typical
  maxHealth: number;
  healthRegen: number;      // HP per second
  mana: number;             // 250-400 typical (some champions manaless)
  maxMana: number;
  manaRegen: number;        // MP per second

  // Offense
  attackDamage: number;     // Base AD
  abilityPower: number;     // AP (usually 0 base)
  attackSpeed: number;      // Attacks per second
  attackRange: number;      // Melee ~125, Ranged ~500-650

  // Defense
  armor: number;            // Physical damage reduction
  magicResist: number;      // Magic damage reduction

  // Mobility
  movementSpeed: number;    // Units per second (325-355 typical)
}
```

### Stat Growth Per Level
Each stat grows per level:
```typescript
interface ChampionGrowth {
  healthPerLevel: number;
  manaPerLevel: number;
  attackDamagePerLevel: number;
  armorPerLevel: number;
  magicResistPerLevel: number;
}
```

---

## Ability Structure

```typescript
interface AbilityDefinition {
  id: string;
  name: string;
  description: string;
  type: 'passive' | 'active';

  // For active abilities
  manaCost?: number | number[];      // Cost per rank (1-5)
  cooldown?: number | number[];      // Seconds per rank
  castTime?: number;                 // Channel time (0 = instant)
  range?: number;                    // Max cast range

  // Targeting
  targetType: AbilityTargetType;

  // Scaling
  baseDamage?: number[];             // Per rank
  adRatio?: number;                  // % of AD added
  apRatio?: number;                  // % of AP added

  // Ranks
  maxRank: number;                   // Usually 5 for basic, 3 for ultimate
}
```

---

## Champion Class Hierarchy

```
BaseObject
    └── Champion (abstract)
            ├── MeleeChampion (abstract)
            │       ├── Warrior
            │       ├── Assassin
            │       └── Tank
            └── RangedChampion (abstract)
                    ├── Mage
                    ├── Marksman
                    └── Support
```

---

## AI Decision Making

Champions controlled by AI will:
1. **Target Selection** - Prioritize low health enemies, high-value targets
2. **Ability Usage** - Cast abilities when conditions are met
3. **Positioning** - Maintain optimal range, kite, dodge skillshots
4. **Retreat** - Fall back when low health

### AI Ability Casting Rules
```typescript
interface AbilityCastCondition {
  // When to consider casting
  minManaPercent?: number;      // Don't cast if mana below this %
  minHealthPercent?: number;    // Only cast if health above this %

  // Target requirements
  enemiesInRange?: number;      // Min enemies needed in range
  alliesInRange?: number;       // Min allies needed

  // Situational
  targetHealthPercent?: number; // Target must be below this HP%
  selfHealthPercent?: number;   // Self must be below this HP%
}
```

---

## Interaction Plan: Champions vs Existing Systems

### 1. Champions Replace Army Units
- Remove or repurpose `Swordsman` and `Archer` classes
- Champions become the main combat units
- Existing `ArmyUnit` base class concepts merged into `Champion`

### 2. Combat System Updates
- **Collision System** - Keep spatial hashing, add ability hitboxes
- **Damage System** - Add damage types, armor/MR calculations
- **Target System** - Priority targeting, ability targeting

### 3. Effects System (New)
- `EffectManager` - Tracks all active effects on units
- `Effect` class - Base for all status effects
- Effects applied/removed each frame, modify stats temporarily

### 4. Ability System (New)
- `Ability` abstract class - Base for all abilities
- `PassiveAbility` - Auto-triggered abilities
- `ActiveAbility` - Manually cast abilities
- Ability factory for creating specific abilities

### 5. Projectile System (Enhance)
- Extend `Arrow` concept to `Projectile` base class
- Add homing, AoE explosion, piercing projectiles
- Skillshot projectiles with collision detection

### 6. UI Updates Needed
- Health/Mana bars above champions
- Ability icons with cooldown indicators
- Cast range indicators
- Buff/debuff icons

### 7. Camera & Controls
- Click to select champion
- Right-click to move/attack
- Q/W/E/R to cast abilities
- Space to center on selected champion

---

## File Structure (New)

```
src/
├── champions/
│   ├── Champion.ts              # Abstract base class
│   ├── ChampionStats.ts         # Stats interface and calculations
│   ├── types.ts                 # Champion-related types
│   └── implementations/
│       ├── Warrior.ts           # Tank/bruiser melee
│       ├── Assassin.ts          # Burst damage melee
│       ├── Mage.ts              # Magic damage ranged
│       ├── Marksman.ts          # Physical damage ranged
│       └── Support.ts           # Utility/healing
├── abilities/
│   ├── Ability.ts               # Abstract ability class
│   ├── PassiveAbility.ts        # Passive ability base
│   ├── ActiveAbility.ts         # Active ability base
│   ├── types.ts                 # Ability types and enums
│   └── implementations/         # Specific abilities
├── effects/
│   ├── Effect.ts                # Base effect class
│   ├── EffectManager.ts         # Manages effects on units
│   ├── types.ts                 # Effect types
│   └── implementations/         # Stun, Slow, etc.
├── projectiles/
│   ├── Projectile.ts            # Base projectile class
│   └── implementations/         # Specific projectile types
└── combat/
    ├── DamageCalculator.ts      # Damage formulas
    ├── TargetSelector.ts        # AI target priority
    └── types.ts                 # Combat types
```

---

## Implementation Order

### Phase 1: Core Champion System
1. Create ability types and interfaces
2. Create abstract `Ability` class
3. Create abstract `Champion` class
4. Create `EffectManager` and base `Effect` class

### Phase 2: First Champion
5. Implement one concrete champion (e.g., Warrior)
6. Implement 4 abilities for that champion
7. Test basic combat with AI

### Phase 3: Combat & Effects
8. Implement damage calculation system
9. Implement common status effects
10. Add projectile system for skillshots

### Phase 4: More Champions
11. Implement remaining 4 champion types
12. Balance stats and abilities

### Phase 5: Polish
13. Add UI elements (health bars, ability icons)
14. Add visual effects for abilities
15. Sound effects
