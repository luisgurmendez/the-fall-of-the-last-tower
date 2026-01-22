# Siege MOBA - Naming Convention Improvements

This document lists naming inconsistencies found in the codebase and suggested renames for clarity and consistency.

---

## High Priority (Confusing Names)

### 1. HUD Panel Naming Inconsistency

**Issue:** Some panels use `Panel` suffix, others use `Box` suffix inconsistently.

| Current Name | Suggested Name | Location | Reason |
|--------------|----------------|----------|--------|
| `drawPassivePanel()` | `drawPassiveBox()` | ChampionHUD.ts | Passive is a single box (52×52), not a panel. Match `abilityBoxes`, `itemBoxes` naming. |
| `wardBoxSize` | Keep as is | ChampionHUD.ts | Correct - it's a single box |
| `passiveBox` (cache) | Keep as is | ChampionHUD.ts | Correct - matches the visual |

**Alternative:** Rename all to use `Panel` consistently:
- `abilityBoxes` → `abilityPanels`
- `itemBoxes` → `itemPanels`

**Recommendation:** Keep `Box` for small single elements (passive, ward, ability, item), use `Panel` for larger containers (stats panel, abilities panel, items panel).

---

### 2. Tooltip Method Naming

**Issue:** Tooltip drawing methods have inconsistent verb prefixes.

| Current Name | Suggested Name | Reason |
|--------------|----------------|--------|
| `drawAbilityTooltip()` | Keep as is | Standard |
| `drawPassiveTooltip()` | Keep as is | Standard |
| `drawItemTooltip()` | Keep as is | Standard |
| `drawBuffTooltip()` | Keep as is | Standard |
| `drawEffectTooltip()` | Keep as is | Standard |

**Status:** ✅ These are already consistent. No changes needed.

---

### 3. Bar vs Fill Naming

**Issue:** Some methods reference "bar" (container + fill), unclear which part.

| Current Name | Suggested Name | Location | Reason |
|--------------|----------------|----------|--------|
| `renderHealthBar()` | `renderHealthBarWithShield()` | EntityRenderer.ts | Now includes shield rendering |
| `renderResourceBar()` | Keep as is | EntityRenderer.ts | Clear enough |
| `PANEL.barHeight` | `PANEL.resourceBarHeight` | ChampionHUD.ts | Clarify it's for health/mana bars |
| `PANEL.barSpacing` | `PANEL.resourceBarSpacing` | ChampionHUD.ts | Match above |

---

### 4. "Active" Naming Conflict

**Issue:** "Active" is used for both UI state and game effects, causing confusion.

| Current Name | Suggested Name | Location | Reason |
|--------------|----------------|----------|--------|
| `activeEffects` | Keep as is | Multiple | Game mechanic term (active status effects) |
| `.active` (CSS) | `.is-visible` or `.is-current` | CSS | Distinguish UI state from game state |
| `isActive` (passive) | Keep as is | PassiveState | Game mechanic term |

**Recommendation:** In CSS, prefer `.is-visible`, `.is-selected`, `.is-current` over `.active` to avoid confusion with game mechanics.

---

### 5. Snapshot vs State Naming

**Issue:** Network types mix "Snapshot" and "State" suffixes.

| Current Name | Suggested Name | Reason |
|--------------|----------------|--------|
| `PassiveStateSnapshot` | Keep as is | Network serialization of PassiveState |
| `ActiveEffectState` | Keep as is | Runtime state, not network-specific |
| `ShieldSnapshot` | Keep as is | Network-only type |
| `ChampionSnapshot` | Keep as is | Network type |

**Status:** ✅ Consistent pattern: `*Snapshot` for network types, `*State` for runtime types.

---

## Medium Priority (Could Be Clearer)

### 6. Entity Renderer Method Prefixes

**Issue:** Most methods use `render*`, but some could be clearer.

| Current Name | Suggested Name | Reason |
|--------------|----------------|--------|
| `renderChampion()` | Keep as is | Clear |
| `renderMinion()` | Keep as is | Clear |
| `renderHealthBar()` | `drawEntityHealthBar()` | Differentiate from HUD health bar |
| `renderShieldSegment()` | Keep as is | New, already clear |
| `renderDamageNumbers()` | `drawFloatingDamageNumbers()` | Clarify it's the floating text |
| `renderGoldNumbers()` | `drawFloatingGoldNumbers()` | Match above |
| `lightenColor()` | `adjustColorBrightness()` | Handles both lighten and darken |

---

### 7. HUD Interface Prefixes

**Issue:** HUD-specific interfaces use `HUD` prefix, but not always.

| Current Name | Suggested Name | Reason |
|--------------|----------------|--------|
| `HUDChampionData` | Keep as is | Clear HUD-specific interface |
| `HUDAbility` | Keep as is | Clear |
| `HUDPassive` | Keep as is | Clear |
| `HUDTrinket` | Keep as is | Clear |
| `HUDActiveEffect` | Keep as is | Clear |
| `HUDConfig` | Keep as is | Clear |
| `HUDHoverState` | Keep as is | Clear |
| `EquippedItem` | `HUDEquippedItem` | Add prefix for consistency |
| `ChampionInventory` | `HUDChampionInventory` | Add prefix for consistency |

---

### 8. CSS Class Naming Patterns

**Issue:** Some CSS classes use different naming conventions.

| Current Name | Suggested Name | Reason |
|--------------|----------------|--------|
| `.pixel-button` | Keep as is | Design system prefix |
| `.pixel-panel` | Keep as is | Design system prefix |
| `.champion-card` | `.mm-champion-card` | Add matchmaking prefix for scoping |
| `.play-button` | `.mm-play-button` | Add prefix |
| `.queue-timer` | `.mm-queue-timer` | Add prefix |
| `.shop-item` | Keep as is | Shop-scoped anyway |
| `.inventory-slot` | `.shop-inventory-slot` | Clarify it's shop inventory |

**Recommendation:** Use prefixes for scoping: `pixel-*` for design system, `mm-*` for matchmaking, `shop-*` for shop, `hud-*` for HUD (if DOM-based).

---

### 9. Shield Type String Literals

**Issue:** Shield types use strings but could benefit from a TypeScript enum.

| Current | Suggested Change |
|---------|------------------|
| `'normal'` | Keep as string literal type |
| `'magic'` | Keep as string literal type |
| `'physical'` | Keep as string literal type |
| `'passive'` | Keep as string literal type |

**Status:** ✅ String literal union type `ShieldType` is sufficient and readable.

---

## Low Priority (Nice to Have)

### 10. Config Object Naming

| Current Name | Suggested Name | Location | Reason |
|--------------|----------------|----------|--------|
| `PANEL` | `HUD_DIMENSIONS` | ChampionHUD.ts | More descriptive |
| `HUD_COLORS` | Keep as is | ChampionHUD.ts | Clear |
| `TEAM_COLORS` | Keep as is | EntityRenderer.ts | Clear |
| `SHIELD_STYLES` | Keep as is | EntityRenderer.ts | Clear |
| `DAMAGE_COLORS` | `DAMAGE_TYPE_COLORS` | EntityRenderer.ts | Slightly clearer |
| `DAMAGE_NUMBER_CONFIG` | `FLOATING_DAMAGE_CONFIG` | EntityRenderer.ts | Match display behavior |
| `GOLD_NUMBER_CONFIG` | `FLOATING_GOLD_CONFIG` | EntityRenderer.ts | Match above |

---

### 11. HTML ID Naming

| Current ID | Suggested ID | Reason |
|------------|--------------|--------|
| `#c` | `#game-canvas` | More descriptive |
| `#btn-play` | Keep as is | Clear enough |
| `#screen-menu` | `#mm-screen-menu` | Add matchmaking prefix |
| `#screen-queue` | `#mm-screen-queue` | Add prefix |
| `#shop-overlay` | Keep as is | Clear |

---

## Summary of Recommended Changes

### ✅ Completed
1. **Health bar colors by relationship** - Implemented in `EntityRenderer.ts`
   - Added `HEALTH_BAR_COLORS` constant with SELF (green), ALLY (blue), ENEMY (red), NEUTRAL (gray)
   - Updated `renderChampion()`, `renderMinion()`, `renderTower()`, `renderNexus()`, `renderJungleCamp()`
   - Local player champion shows green health bar
   - Allied units show blue health bars
   - Enemy units show red health bars
   - Jungle camps show gray health bars

### Should Do (High Impact)
1. Rename `PANEL` → `HUD_DIMENSIONS` for clarity
2. Add `HUD` prefix to `EquippedItem` and `ChampionInventory` interfaces

### Could Do (Medium Impact)
3. Consider renaming floating number methods for clarity
4. Add `mm-` prefix to matchmaking CSS classes for better scoping

### Low Priority
5. Rename `#c` canvas ID to `#game-canvas`

---

## Files Affected by Recommended Changes

| File | Changes |
|------|---------|
| `src/ui/ChampionHUD.ts` | Rename `PANEL` → `HUD_DIMENSIONS`, add `HUD` prefix to interfaces |
| `src/render/EntityRenderer.ts` | Consider method renames for floating numbers |
| `src/styles/matchmaking.css` | Add `mm-` prefixes |
| `index.html` | Rename canvas ID |

---

## Notes

- Most naming is already consistent and clear
- The codebase follows good conventions overall
- These suggestions are improvements, not critical fixes
- Any renames should include a codebase-wide search/replace to catch all usages
