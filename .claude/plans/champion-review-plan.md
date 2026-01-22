# Champion Review & Completion Plan

## Overview

This plan reviews each of the 5 champions systematically, ensuring:
- ✅ Passives work correctly (server + client visualization)
- ✅ All abilities function as designed
- ✅ Mark-based mechanics work (stack tracking, visual indicators)
- ✅ Visual UI shows marks, stacks, and effects on champions

---

## Visual Mark/Stack System (Shared Implementation)

Before diving into individual champions, we need a **Mark Indicator System** that can show:
- Stack counts on champions (both self and enemies)
- Mark icons above enemy health bars
- Timer indicators for expiring marks

### Required Components

1. **Server**: Marks already exist in `ActiveEffectState` - need to ensure proper sync
2. **Client Rendering**: New `renderMarkIndicators()` method in EntityRenderer
3. **Mark Definitions**: Visual config per mark type (icon, color, position)

```
Mark Indicator Types:
┌─────────────────────────────────────────────────────────────┐
│  STACKS (below health bar)     MARKS (above health bar)    │
│  ┌───┐                         ┌───┐                       │
│  │ 3 │  ← Stack count          │ 💀│  ← Mark icon          │
│  └───┘                         └───┘                       │
│  [████████████]                [████████████]              │
│  Health Bar                    Health Bar                   │
└─────────────────────────────────────────────────────────────┘
```

---

# Phase 1: Warrior (Kael) - The Iron Vanguard

## 1.1 Passive Review: "Undying Resolve"

### Current Implementation
- **Trigger**: `on_low_health` (below 30% HP)
- **Effect**: Shield + 20% armor buff for 5s
- **Cooldown**: 60s internal cooldown

### What to Verify
- [ ] Server: Passive triggers when health drops below 30%
- [ ] Server: Shield amount scales correctly (80/120/160/200 + 10% bonus HP)
- [ ] Server: Armor buff (+20%) applies for 5 seconds
- [ ] Server: 60s cooldown prevents re-triggering
- [ ] Client: Passive panel shows cooldown timer when triggered
- [ ] Client: Shield appears on health bar (striped pattern)
- [ ] Client: "Active" glow on passive box when triggered

### Missing Visuals
- [ ] **Flash effect** when passive triggers (gold border flash on champion)
- [ ] **Buff icon** showing armor boost duration

### Test Commands
```bash
cd packages/server && bun test Warrior
```

---

## 1.2 Abilities Review

### Q - Cleaving Strike (Cone AoE)
| Aspect | Status | Notes |
|--------|--------|-------|
| Damage calculation | ✅ | 60-200 + 0.8 AD |
| Cone targeting | ⚠️ | Test skipped - verify cone logic |
| Animation | ❌ | No visual for cone swing |
| Sound | ❌ | No audio |

**TODO**:
- [ ] Verify cone targeting hits enemies in 90° arc
- [ ] Add cone slash visual effect on client
- [ ] Add impact particles on hit enemies

### W - Iron Will (Self Shield)
| Aspect | Status | Notes |
|--------|--------|-------|
| Shield amount | ✅ | 80-240 + 8% bonus HP |
| Duration | ✅ | 3 seconds |
| Visual | ✅ | Shield shows on health bar |
| Activation visual | ❌ | No visual "popping" effect |

**TODO**:
- [ ] Add shield activation particle effect (golden ripple)

### E - Valiant Charge (Dash + Slow)
| Aspect | Status | Notes |
|--------|--------|-------|
| Dash distance | ✅ | 500 units |
| Damage | ✅ | 50-190 + 0.6 AD |
| Slow application | ✅ | slow_30 effect |
| Trail visual | ❌ | No dash trail |

**TODO**:
- [ ] Add dash trail visual (dust particles or motion blur)
- [ ] Add impact effect when hitting enemy

### R - Heroic Strike (Targeted Stun)
| Aspect | Status | Notes |
|--------|--------|-------|
| Damage | ✅ | 150-350 + 1.0 AD |
| Stun duration | ✅ | 1 second |
| Target validation | ✅ | Enemy champions only |
| Animation | ❌ | No strike animation |

**TODO**:
- [ ] Add overhead strike animation
- [ ] Add stun indicator on enemy (stars/dizzy effect)

---

## 1.3 Warrior Visual Checklist

| Visual Element | Location | Status | Priority |
|----------------|----------|--------|----------|
| Passive cooldown display | HUD PassiveBox | ✅ | - |
| Passive activation glow | HUD PassiveBox | ⚠️ Verify | High |
| Shield on health bar | EntityRenderer | ✅ | - |
| Armor buff icon | HUD BuffsDisplay | ⚠️ Verify | Medium |
| Q cone indicator | AbilityRangeIndicator | ⚠️ Verify | High |
| E dash trail | EntityRenderer | ❌ | Low |
| R stun indicator | EntityRenderer | ❌ | Medium |

---

# Phase 2: Magnus - The Battlemage

## 2.1 Passive Review: "Arcane Surge"

### Current Implementation
- **Trigger**: `on_ability_cast`
- **Stacks**: 4 max, 1 per ability cast
- **Duration**: 10s per stack
- **Effect**: At 4 stacks, next ability deals +30% damage, consumes all stacks

### What to Verify
- [ ] Server: Stacks increment on each ability cast
- [ ] Server: Stacks cap at 4
- [ ] Server: Stack timer refreshes on new cast
- [ ] Server: At 4 stacks, next ability deals 30% more damage
- [ ] Server: Stacks consumed after empowered ability
- [ ] Client: Stack counter shows on passive box (0-4)
- [ ] Client: Visual glow at 4 stacks (ready to empower)

### Missing Visuals
- [ ] **Stack indicator** on Magnus showing current stacks (small pips or number)
- [ ] **Empowered glow** when at 4 stacks (pulsing arcane energy)
- [ ] **Empowered ability trail** (different color projectile when empowered)

---

## 2.2 Abilities Review

### Q - Fireball (Skillshot Projectile)
| Aspect | Status | Notes |
|--------|--------|-------|
| Damage | ✅ | 80-240 + 0.75 AP |
| Projectile speed | ✅ | 1200 units/s |
| Range | ✅ | 900 units |
| Projectile visual | ⚠️ | Generic, needs fire effect |

**TODO**:
- [ ] Add fireball sprite/animation
- [ ] Add impact explosion effect
- [ ] Different visual when empowered (blue flames?)

### W - Arcane Barrier (Self Shield)
| Aspect | Status | Notes |
|--------|--------|-------|
| Shield amount | ✅ | 60-220 + 0.4 AP |
| Duration | ✅ | 4 seconds |
| Visual | ✅ | Shield on health bar |

**TODO**:
- [ ] Add barrier activation visual (arcane hexagon pattern)

### E - Blink (Teleport)
| Aspect | Status | Notes |
|--------|--------|-------|
| Range | ✅ | 450 units |
| Instant | ✅ | No travel time |
| Origin effect | ❌ | No visual at start position |
| Destination effect | ❌ | No visual at end position |

**TODO**:
- [ ] Add disappear puff at origin
- [ ] Add appear puff at destination

### R - Meteor Strike (Delayed AoE)
| Aspect | Status | Notes |
|--------|--------|-------|
| Damage | ✅ | 200-500 + 0.9 AP |
| Delay | ✅ | 1 second |
| Radius | ✅ | 250 units |
| Warning indicator | ❌ | No ground target warning |
| Impact visual | ❌ | No meteor animation |

**TODO**:
- [ ] Add red circle warning during 1s delay
- [ ] Add meteor falling animation
- [ ] Add impact crater/explosion effect

---

## 2.3 Magnus Stack Display

```
  ┌─────────────────────────────────┐
  │  MAGNUS - Stack Indicator       │
  │                                 │
  │  Normal:    ○ ○ ○ ○  (0 stacks) │
  │  1 stack:   ● ○ ○ ○             │
  │  2 stacks:  ● ● ○ ○             │
  │  3 stacks:  ● ● ● ○             │
  │  4 stacks:  ● ● ● ●  (READY!)   │
  │             ↑ Pulsing glow      │
  └─────────────────────────────────┘
```

**Location**: Below champion health bar or on HUD passive box

---

# Phase 3: Elara - The Radiant Healer

## 3.1 Passive Review: "Blessed Presence"

### Current Implementation
- **Trigger**: `always` (aura)
- **Range**: 600 units
- **Effect**: Allies heal 1% max HP per second
- **Interval**: 1 second ticks

### What to Verify
- [ ] Server: Aura ticks every 1 second
- [ ] Server: Only affects allies (not self, not enemies)
- [ ] Server: Heal amount = 1% of ally's max HP
- [ ] Server: Range check (600 units)
- [ ] Client: Aura visual around Elara
- [ ] Client: Heal numbers floating on affected allies

### Missing Visuals
- [ ] **Aura circle** around Elara showing 600 unit range
- [ ] **Heal particles** on allies being healed
- [ ] **Passive indicator** showing aura is active

---

## 3.2 Abilities Review

### Q - Radiant Blessing (Targeted Heal)
| Aspect | Status | Notes |
|--------|--------|-------|
| Heal amount | ✅ | 70-230 + 0.5 AP |
| Target validation | ✅ | Allies only |
| Range | ✅ | 700 units |
| Heal visual | ⚠️ | Needs floating numbers |

**TODO**:
- [ ] Add healing beam visual from Elara to target
- [ ] Add heal particles on target
- [ ] Show green floating number for heal amount

### W - Sacred Shield (Ally Shield)
| Aspect | Status | Notes |
|--------|--------|-------|
| Shield amount | ✅ | 60-180 + 0.35 AP |
| Target validation | ✅ | Allies only |
| Duration | ✅ | 4 seconds |
| Visual | ✅ | Shield on ally health bar |

**TODO**:
- [ ] Add golden shield bubble visual on ally

### E - Swift Grace (AoE Speed Buff)
| Aspect | Status | Notes |
|--------|--------|-------|
| Speed boost | ✅ | +30% movement speed |
| Duration | ✅ | 2 seconds |
| Radius | ✅ | 400 units |
| Buff visual | ❌ | No speed lines on allies |

**TODO**:
- [ ] Add swirl effect around Elara on cast
- [ ] Add speed lines on buffed allies

### R - Divine Intervention (AoE Heal + Cleanse)
| Aspect | Status | Notes |
|--------|--------|-------|
| Heal amount | ✅ | 150-350 + 0.6 AP |
| Cleanse | ✅ | Removes debuffs |
| Radius | ✅ | 600 units |
| Visual | ❌ | No divine light effect |

**TODO**:
- [ ] Add large holy light burst visual
- [ ] Add cleanse sparkles on cleansed allies
- [ ] Screen flash effect (subtle)

---

# Phase 4: Vex - The Shadow Blade ⭐ (Mark System Focus)

## 4.1 Passive Review: "Assassin's Mark"

### Current Implementation
- **Trigger**: `on_hit` (basic attacks)
- **Stacks**: 3 max, stored on Vex (not target)
- **Duration**: 5 seconds
- **Effect**: 3rd attack deals 4% target max HP as true damage

### What to Verify
- [ ] Server: Stacks increment on each basic attack hit
- [ ] Server: Stacks cap at 3
- [ ] Server: At 3 stacks, proc true damage = 4% target max HP
- [ ] Server: Stacks reset after proc
- [ ] Server: Stack timer (5s) refreshes on hit
- [ ] Client: Stack counter on Vex (or target)
- [ ] Client: Visual "ready to proc" indicator at 3 stacks
- [ ] Client: True damage number in gold color

### Missing Visuals (CRITICAL)
- [ ] **Stack indicator** on Vex or below target's health bar
- [ ] **Proc visual** - slash effect when 3rd hit procs
- [ ] **True damage number** - distinct gold color

---

## 4.2 Mark Mechanics (Q, E, R)

### Q - Shadow Shuriken → Applies `vex_mark`
```
vex_mark Effect:
- Duration: 4 seconds
- Effect: Target takes 10% increased damage from Vex
- Visual: Purple/shadow mark icon above enemy health bar
- Cleansable: Yes
```

| Aspect | Status | Notes |
|--------|--------|-------|
| Mark application | ✅ | Effect system |
| Damage amplification | ⚠️ | Verify 10% calculation |
| Duration tracking | ✅ | 4 seconds |
| **Mark visual** | ❌ | **MISSING - Need icon above enemy** |

**TODO**:
- [ ] Add purple shuriken mark icon above marked enemy
- [ ] Add mark duration indicator (timer or fade)
- [ ] Add mark application particle effect

### E - Shadow Step → Reset on Marked Target
```
E Mechanic:
- If E hits a marked target (has vex_mark), E cooldown resets
- Encourages Q → E combo
```

| Aspect | Status | Notes |
|--------|--------|-------|
| Dash functionality | ✅ | Works |
| Mark detection | ⚠️ | Verify reset logic |
| Reset visual | ❌ | No indicator E is ready again |

**TODO**:
- [ ] Verify E cooldown resets when hitting marked target
- [ ] Add "Reset!" text or flash when E resets
- [ ] Add shadow trail on dash

### R - Death Mark → Applies `vex_death_mark`
```
vex_death_mark Effect:
- Duration: 2 seconds (then detonates)
- Effect: Tracks damage dealt, adds 30% as bonus on detonation
- Visual: Skull/death mark above enemy, countdown timer
- Cleansable: No
```

| Aspect | Status | Notes |
|--------|--------|-------|
| Mark application | ✅ | Effect system |
| Damage tracking | ⚠️ | Verify accumulation |
| Detonation | ⚠️ | Verify 30% bonus |
| **Death mark visual** | ❌ | **MISSING - Need skull icon + timer** |

**TODO**:
- [ ] Add skull death mark icon above enemy
- [ ] Add countdown timer (2...1...BOOM)
- [ ] Add detonation explosion effect
- [ ] Show total damage dealt during mark

---

## 4.3 Vex Mark Visual Design

```
Enemy with vex_mark (Q):
┌───────────────────────────────┐
│         ⬢ (purple shuriken)  │
│         3.2s                  │  ← Timer
│  [████████████████]           │  ← Health bar (red)
│  Enemy Champion               │
└───────────────────────────────┘

Enemy with vex_death_mark (R):
┌───────────────────────────────┐
│         💀 (skull, pulsing)   │
│         1.5s                  │  ← Countdown
│  [████████████████]           │  ← Health bar (red)
│  Enemy Champion               │
│  Damage tracked: 234          │  ← Small text
└───────────────────────────────┘
```

---

## 4.4 W - Shadow Shroud (Stealth)

| Aspect | Status | Notes |
|--------|--------|-------|
| Stealth duration | ✅ | 1.5 seconds |
| Speed boost | ✅ | +20% MS |
| Invisibility | ⚠️ | Verify enemy can't see |
| **Stealth visual** | ❌ | Need transparency effect |

**TODO**:
- [ ] Make Vex semi-transparent during stealth (for allies)
- [ ] Make Vex invisible to enemies during stealth
- [ ] Add shadow particles while stealthed
- [ ] Add "revealed" indicator if stealth breaks

---

# Phase 5: Gorath - The Stone Guardian

## 5.1 Passive Review: "Immovable"

### Current Implementation
- **Trigger**: `on_take_damage`
- **Stacks**: 10 max, 1 per damage instance
- **Duration**: 4 seconds (decays out of combat)
- **Effect**: +5 armor per stack (max +50 armor)
- **Internal CD**: 0.5s between stack gains

### What to Verify
- [ ] Server: Stacks gain on taking damage
- [ ] Server: 0.5s internal cooldown between gains
- [ ] Server: Stacks cap at 10
- [ ] Server: Armor bonus = stacks × 5
- [ ] Server: Decay after 4s out of combat
- [ ] Client: Stack counter visible (0-10)
- [ ] Client: Armor buff reflects in stats

### Missing Visuals
- [ ] **Stack counter** showing 0-10 stacks
- [ ] **Stone skin visual** at high stacks (rocky texture overlay)
- [ ] **Stack gain particle** when taking damage and gaining stack

---

## 5.2 Abilities Review

### Q - Ground Slam (AoE + Slow)
| Aspect | Status | Notes |
|--------|--------|-------|
| Damage | ✅ | 60-220 + 4% bonus HP |
| Slow | ✅ | 40% for 1 second |
| Radius | ✅ | 300 units |
| Visual | ❌ | No ground crack effect |

**TODO**:
- [ ] Add ground slam shockwave visual
- [ ] Add slow indicator on enemies (blue tint or chains)

### W - Stone Skin (Defense Buff)
| Aspect | Status | Notes |
|--------|--------|-------|
| Armor buff | ✅ | +30% |
| MR buff | ✅ | +30% |
| Duration | ✅ | 4 seconds |
| Visual | ❌ | No stone texture on champion |

**TODO**:
- [ ] Add rocky/stone texture overlay on Gorath
- [ ] Add buff icons in HUD

### E - Defiant Roar (AoE Taunt)
| Aspect | Status | Notes |
|--------|--------|-------|
| Taunt duration | ✅ | 1.5 seconds |
| Radius | ✅ | 350 units |
| **Taunt indicator** | ❌ | **MISSING - enemies need "taunted" visual** |

**TODO**:
- [ ] Add roar shockwave visual
- [ ] Add "taunted" indicator on affected enemies (arrow pointing to Gorath)
- [ ] Add rage lines around taunted enemies

### R - Earthquake (AoE Knockup)
| Aspect | Status | Notes |
|--------|--------|-------|
| Damage | ✅ | 150-400 + 6% bonus HP |
| Knockup | ✅ | 1 second |
| Radius | ✅ | 450 units |
| Wind-up | ✅ | 0.5 second delay |
| **Visual** | ❌ | No earthquake effect |

**TODO**:
- [ ] Add Gorath stomp animation during wind-up
- [ ] Add ground cracking/shaking visual
- [ ] Add enemies bouncing up during knockup
- [ ] Add screen shake (subtle)

---

# Implementation Priority

## High Priority (Core Functionality)
1. **Vex mark visuals** - Q mark, R death mark (critical for gameplay)
2. **Stack indicators** - Magnus passive, Vex passive, Gorath passive
3. **Passive activation** - All champions need visual feedback

## Medium Priority (Polish)
4. **CC indicators** - Stun stars, taunt arrows, slow tint
5. **Ability effects** - Projectile trails, impact effects
6. **Buff/debuff icons** - Standardize display

## Low Priority (Nice to Have)
7. **Screen effects** - Shake, flash
8. **Sound effects** - Audio feedback
9. **Champion-specific particles** - Unique visual identity

---

# File Changes Summary

### New Files Needed
```
src/render/MarkIndicatorRenderer.ts     - Mark/stack visual system
src/config/markVisuals.ts               - Mark icon/color definitions
src/effects/AbilityEffectRenderer.ts    - Ability visual effects
```

### Files to Modify
```
src/render/EntityRenderer.ts            - Add mark indicator rendering
src/ui/ChampionHUD.ts                   - Verify passive stack display
packages/server/src/systems/PassiveTriggerSystem.ts - Verify all triggers
packages/server/src/simulation/ServerAbilityExecutor.ts - Verify mark logic
```

---

# Testing Plan

For each champion phase:
1. Run existing server tests: `bun test [ChampionName]`
2. Manual playtest passive trigger conditions
3. Verify mark application and expiration
4. Check client-side visual rendering
5. Verify HUD displays correct information

---

# Timeline Estimate

| Phase | Champion | Core Work | Visual Polish | Total |
|-------|----------|-----------|---------------|-------|
| 1 | Warrior | Verify existing | Minor effects | Small |
| 2 | Magnus | Verify stacks | Stack UI | Medium |
| 3 | Elara | Verify aura | Heal particles | Medium |
| 4 | Vex | Mark system | **Heavy visual work** | Large |
| 5 | Gorath | Verify stacks | CC indicators | Medium |
| Shared | Mark System | Core renderer | Icons, timers | Large |

**Recommendation**: Start with **Shared Mark System** first, then Phase 4 (Vex) since it has the most mark-dependent mechanics.
