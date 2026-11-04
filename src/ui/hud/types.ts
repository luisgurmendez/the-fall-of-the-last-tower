/**
 * Types shared by ChampionHUD and the HUD panels. ChampionHUD re-exports the
 * public ones, so other code keeps importing them from '@/ui/ChampionHUD'.
 */

import type { StatModifier, ChampionStats, ItemSlot, ItemDefinition, AbilitySlot, AbilityScaling, AbilityDefinition, DamageType, SummonerSpellState } from '@siege/shared';
import type Vector from '@/physics/vector';
import type AbilityIconLoader from '@/ui/AbilityIconLoader';

/**
 * Interface for equipped item display.
 */
export interface EquippedItem {
  definition: ItemDefinition;
  slot: ItemSlot;
  passiveCooldowns: Map<string, number>;
  nextIntervalTick: Map<string, number>;
  /** Uses left (a stack of potions, a flask's charges) */
  charges?: number;
  /** Stacks its stacking passive gathered */
  stacks?: number;
  /** Seconds until its active is ready (0 when it is), and its full cooldown */
  cooldownLeft?: number;
  cooldownTotal?: number;
}

/**
 * Interface for inventory display.
 */
export interface ChampionInventory {
  items: Map<ItemSlot, EquippedItem>;
  totalGoldSpent: number;
}

/**
 * Interface for trinket data needed by HUD.
 * Both Trinket and OnlineTrinketAdapter implement this.
 */
export interface HUDTrinket {
  getCharges(): number;
  getMaxCharges(): number;
  getDefinition(): { maxCharges: number };
  getRechargeProgress(): number;
  isOnCooldown(): boolean;
  canPlace(): boolean;
}

/**
 * Ability definition interface for HUD tooltips.
 */
export interface HUDAbilityDefinition {
  id?: string;
  name: string;
  description: string;
  maxRank?: number;
  manaCost?: number[];
  cooldown?: number[];
  damage?: {
    type: DamageType;
    scaling: AbilityScaling;
  };
  heal?: {
    scaling: AbilityScaling;
  };
  shield?: {
    scaling: AbilityScaling;
    duration: number;
  };
  /** How long its effects last (seconds), for {effectDuration} */
  effectDuration?: number;
  /** Stat changes while it lasts, for {attackSpeedBonus} */
  statTransform?: {
    statModifiers?: {
      attackSpeed?: number[];
    };
  };
}

/**
 * Interface for ability data needed by HUD.
 */
export interface HUDAbility {
  readonly definition?: HUDAbilityDefinition | null;
  readonly rank: number;
  readonly isReady: boolean;
  readonly cooldownProgress: number;
  readonly cooldownRemaining: number;
  /** Time remaining in recast window (> 0 means recast is available) */
  readonly recastWindowRemaining?: number;
  /** The ability swapped into the slot for now (Nocthar's colossus's): its icon is shown */
  readonly swappedAbilityId?: string | null;
  getTargetDescription?(): HUDTargetDescription | null;
}

/** What an ability's preview needs (src/ui/hud/abilityPreview.ts) */
export type HUDTargetDescription = Pick<AbilityDefinition,
  'id' | 'range' | 'targetType' | 'shape' | 'aoeRadius' | 'coneAngle' | 'projectileRadius' | 'dash'>;

/**
 * Passive ability definition interface for HUD display.
 */
export interface HUDPassiveDefinition {
  id: string;
  name: string;
  description: string;
  trigger: string;
  internalCooldown?: number;
  maxStacks?: number;
  usesStacks?: boolean;
  /** What the stacks are called in the tooltip ("Heat") */
  stackName?: string;
  /** Its values, for {damage}, {heal} and {shield} in the description */
  damage?: { scaling: AbilityScaling };
  heal?: { scaling: AbilityScaling };
  shield?: { scaling: AbilityScaling; duration: number };
  levelScaling?: { levels: number[]; values: number[] };
}

/**
 * Interface for passive ability data needed by HUD.
 */
export interface HUDPassive {
  readonly definition: HUDPassiveDefinition;
  readonly isActive: boolean;
  readonly cooldownRemaining: number;
  readonly stacks: number;
  readonly maxStacks: number;
  readonly stackTimeRemaining: number;
}

/**
 * Interface for champion data needed by HUD.
 * Both Champion and OnlineChampionAdapter implement this.
 */
export interface HUDChampionData {
  getStats(): ChampionStats;
  getCurrentHealth(): number;
  getCurrentResource(): number;
  getAbility(slot: AbilitySlot): HUDAbility | undefined;
  getPassive(): HUDPassive | null;
  getBuffs(): StatModifier[];
  getActiveEffects(): HUDActiveEffect[];
  getInventory(): ChampionInventory;
  getTrinket(): HUDTrinket | null;
  /** Control wards carried (bought in the shop, placed with 5) */
  getControlWards(): number;
  /** The two summoner spells (D, F) and their cooldowns */
  getSummoners(): SummonerSpellState[];
  getPosition(): Vector;
  getLevel(): number;
  /** The champion's base health: tooltips count bonus health over it, as the server does */
  getBaseHealth(): number;
  /** Where its Light Orb is (Lume), for previews of the abilities that start there */
  getOrbPosition?(): Vector | null;
  getExperience(): number;
  getExperienceToNextLevel(): number;
  getSkillPoints(): number;
  getGold(): number;
}

/**
 * Active effect data for HUD display.
 */
export interface HUDActiveEffect {
  /** Effect definition ID */
  definitionId: string;
  /** Time remaining in seconds */
  timeRemaining: number;
  /** Total duration when effect was applied (for progress bar) */
  totalDuration?: number;
  /** Current stack count */
  stacks: number;
  /** For shields: remaining shield amount */
  shieldRemaining?: number;
}

/** Hover state for HUD elements */
export interface HUDHoverState {
  /** Currently hovered ability slot, or null if none */
  ability: AbilitySlot | null;
  /** Currently hovered item slot, or null if none */
  item: ItemSlot | null;
  /** Currently hovered buff index, or null if none */
  buff: number | null;
  /** Currently hovered effect index, or null if none */
  effect: number | null;
  /** Currently hovered passive, or null if none */
  passive: boolean;
  /** Currently hovered summoner spell slot (0 = D, 1 = F), or null if none */
  summoner: number | null;
}

/** HUD configuration options */
export interface HUDConfig {
  /** Primary color for the champion (used for accents) */
  accentColor: string;
  /** Champion name to display */
  championName: string;
  /** Champion ID for loading ability icons (e.g., 'vex', 'gorath') */
  championId?: string;
  /** Whether to show mana bar (false for energy/rage champions) */
  showManaBar?: boolean;
  /** Resource bar color (blue for mana, yellow for energy, red for rage) */
  resourceColor?: string;
  /** Resource name (Mana, Energy, Rage, etc.) */
  resourceName?: string;
  /** Callback when ability hover state changes */
  onAbilityHover?: (slot: AbilitySlot | null) => void;
  /** Callback when item hover state changes */
  onItemHover?: (slot: ItemSlot | null) => void;
}

/** Cached position of a square HUD element, for hit testing */
export interface HitBox {
  x: number;
  y: number;
  size: number;
}

/** Cached position of a rectangular HUD element, for hit testing */
export interface HitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Charge progress of the ability being charged */
export interface HUDChargeState {
  slot: AbilitySlot;
  progress: number;
}

/**
 * State ChampionHUD keeps between frames and shares with the HUD panels.
 * ChampionHUD owns it: step() advances the pulse clock and updates the hover
 * state and the hovered level-up button, and the panels refresh the hit-test
 * boxes as they draw.
 */
export interface HUDContext {
  /** HUD configuration, with defaults filled in */
  readonly config: Required<HUDConfig>;
  /** Ability icon loader */
  readonly iconLoader: AbilityIconLoader;

  /** Current hover state */
  readonly hoverState: HUDHoverState;

  /** Cached passive box position for hit testing */
  passiveBox: HitBox | null;

  /** Cached ability box positions for hit testing (updated each frame) */
  readonly abilityBoxes: Map<AbilitySlot, HitBox>;

  /** Cached summoner spell box positions by slot, for hit testing */
  readonly summonerBoxes: Map<number, HitBox>;

  /** Cached item box positions for hit testing */
  readonly itemBoxes: Map<ItemSlot, HitBox>;

  /** Cached buff box positions for hit testing */
  readonly buffBoxes: Map<number, HitBox>;

  /** Cached effect box positions for hit testing */
  readonly effectBoxes: Map<number, HitBox>;

  /** Cached level-up button positions for hit testing */
  readonly levelUpButtons: Map<AbilitySlot, HitRect>;

  /** Hovered level-up button */
  hoveredLevelUpButton: AbilitySlot | null;

  /** Animation state for level-up button pulse */
  levelUpPulseTime: number;

  /** Current charge state (for charge abilities) */
  chargeState: HUDChargeState | null;

  /** The ability aimed before its cast (normal cast, quick cast with indicator) */
  armedAbility: AbilitySlot | null;

  /** When (performance.now) each ability was last pressed while it couldn't be cast */
  readonly deniedAt: Map<AbilitySlot, number>;
}
