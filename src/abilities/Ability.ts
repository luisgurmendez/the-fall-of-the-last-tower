/**
 * Abstract base class for all abilities.
 *
 * Abilities can be passive (auto-triggered) or active (manually cast).
 * Each ability has a rank (1-5), cooldown, and potentially mana cost.
 */

import type { Champion } from '@/champions/Champion';
import type GameContext from '@/core/gameContext';
import {
  AbilityDefinition,
  AbilityState,
  AbilityCastContext,
  AbilityCastResult,
  AbilityScaling,
  AbilitySlot,
} from './types';
import {
  IAbilityTargetDescription,
  NoTargetAbilityTargetDescription,
  SelfTargetAbilityTargetDescription,
  SingleTargetInRangeAbilityTargetDescription,
  SingleAllyInRangeAbilityTargetDescription,
  SkillshotAbilityTargetDescription,
  GroundTargetAbilityTargetDescription,
  AoEAroundSelfAbilityTargetDescription,
} from './AbilityTargetDescription';

/**
 * Abstract base class for all abilities.
 */
abstract class Ability {
  /** The ability definition (static configuration) */
  readonly definition: AbilityDefinition;

  /** Which slot this ability is bound to */
  readonly slot: AbilitySlot;

  /** Runtime state */
  protected state: AbilityState;

  /** Reference to the owning champion */
  protected owner: Champion | null = null;

  constructor(definition: AbilityDefinition, slot: AbilitySlot) {
    this.definition = definition;
    this.slot = slot;
    this.state = this.createInitialState();
  }

  /**
   * Create initial state for the ability.
   */
  protected createInitialState(): AbilityState {
    return {
      rank: 0,
      cooldownRemaining: 0,
      cooldownTotal: 0,
      isCasting: false,
      castTimeRemaining: 0,
      isToggled: false,
      passiveCooldownRemaining: 0,
    };
  }

  /**
   * Set the owner champion for this ability.
   */
  setOwner(owner: Champion): void {
    this.owner = owner;
  }

  /**
   * Get the owner champion.
   */
  getOwner(): Champion | null {
    return this.owner;
  }

  // ===================
  // State Getters
  // ===================

  /** Current rank (0 = not learned) */
  get rank(): number {
    return this.state.rank;
  }

  /** Whether the ability has been learned */
  get isLearned(): boolean {
    return this.state.rank > 0;
  }

  /** Whether the ability can be ranked up */
  get canRankUp(): boolean {
    return this.state.rank < this.definition.maxRank;
  }

  /** Whether the ability is on cooldown */
  get isOnCooldown(): boolean {
    return this.state.cooldownRemaining > 0;
  }

  /** Cooldown remaining in seconds */
  get cooldownRemaining(): number {
    return this.state.cooldownRemaining;
  }

  /** Cooldown progress (0 = just started, 1 = ready) */
  get cooldownProgress(): number {
    if (this.state.cooldownTotal === 0) return 1;
    return 1 - this.state.cooldownRemaining / this.state.cooldownTotal;
  }

  /** Whether the ability is ready to cast (not on cooldown and not casting) */
  get isReady(): boolean {
    return !this.isOnCooldown && !this.isCasting;
  }

  /** Whether the ability is currently being cast */
  get isCasting(): boolean {
    return this.state.isCasting;
  }

  /** For toggle abilities: whether currently active */
  get isToggled(): boolean {
    return this.state.isToggled;
  }

  // ===================
  // Value Calculations
  // ===================

  /**
   * Get mana cost at current rank.
   */
  getManaCost(): number {
    if (!this.definition.manaCost || !this.isLearned) return 0;
    return this.definition.manaCost[this.state.rank - 1] ?? 0;
  }

  /**
   * Get cooldown at current rank.
   */
  getCooldown(): number {
    if (!this.definition.cooldown || !this.isLearned) return 0;
    return this.definition.cooldown[this.state.rank - 1] ?? 0;
  }

  /**
   * Calculate a scaled value based on the ability's scaling configuration.
   */
  protected calculateScaledValue(scaling: AbilityScaling): number {
    if (!this.owner || !this.isLearned) return 0;

    const stats = this.owner.getStats();
    const rank = this.state.rank;

    // Base value for current rank
    let value = scaling.base[rank - 1] ?? 0;

    // Add ratios
    if (scaling.adRatio) {
      value += stats.attackDamage * scaling.adRatio;
    }
    if (scaling.apRatio) {
      value += stats.abilityPower * scaling.apRatio;
    }
    if (scaling.bonusHealthRatio) {
      const bonusHealth = stats.maxHealth - this.owner.getDefinitionBaseStats().health;
      value += bonusHealth * scaling.bonusHealthRatio;
    }
    if (scaling.maxHealthRatio) {
      value += stats.maxHealth * scaling.maxHealthRatio;
    }
    if (scaling.missingHealthRatio) {
      const missingHealth = stats.maxHealth - stats.health;
      value += missingHealth * scaling.missingHealthRatio;
    }
    if (scaling.armorRatio) {
      value += stats.armor * scaling.armorRatio;
    }
    if (scaling.magicResistRatio) {
      value += stats.magicResist * scaling.magicResistRatio;
    }

    return value;
  }

  /**
   * Get the damage this ability would deal.
   */
  getDamage(): number {
    if (!this.definition.damage) return 0;
    return this.calculateScaledValue(this.definition.damage.scaling);
  }

  /**
   * Get the heal amount for this ability.
   */
  getHealAmount(): number {
    if (!this.definition.heal) return 0;
    return this.calculateScaledValue(this.definition.heal.scaling);
  }

  /**
   * Get the shield amount for this ability.
   */
  getShieldAmount(): number {
    if (!this.definition.shield) return 0;
    return this.calculateScaledValue(this.definition.shield.scaling);
  }

  // ===================
  // State Mutations
  // ===================

  /**
   * Rank up the ability.
   */
  rankUp(): boolean {
    if (!this.canRankUp) return false;
    this.state.rank++;
    this.onRankUp();
    return true;
  }

  /**
   * Start the cooldown.
   */
  protected startCooldown(): void {
    const cooldown = this.getCooldown();
    this.state.cooldownRemaining = cooldown;
    this.state.cooldownTotal = cooldown;
  }

  /**
   * Start casting (for abilities with cast time).
   */
  protected startCasting(): void {
    this.state.isCasting = true;
    this.state.castTimeRemaining = this.definition.castTime ?? 0;
  }

  /**
   * Finish casting.
   */
  protected finishCasting(): void {
    this.state.isCasting = false;
    this.state.castTimeRemaining = 0;
  }

  /**
   * Toggle the ability on/off.
   */
  protected toggle(): void {
    this.state.isToggled = !this.state.isToggled;
  }

  /**
   * Reset the ability state (e.g., on champion death).
   */
  reset(): void {
    this.state = this.createInitialState();
  }

  // ===================
  // Update Loop
  // ===================

  /**
   * Update the ability state each frame.
   */
  update(gctx: GameContext): void {
    const dt = gctx.dt;

    // Update cooldown
    if (this.state.cooldownRemaining > 0) {
      this.state.cooldownRemaining = Math.max(0, this.state.cooldownRemaining - dt);
    }

    // Update passive cooldown
    if (this.state.passiveCooldownRemaining > 0) {
      this.state.passiveCooldownRemaining = Math.max(0, this.state.passiveCooldownRemaining - dt);
    }

    // Update cast time
    if (this.state.isCasting) {
      this.state.castTimeRemaining -= dt;
      if (this.state.castTimeRemaining <= 0) {
        this.finishCasting();
        this.onCastComplete();
      }
    }

    // Call subclass update
    this.onUpdate(gctx);
  }

  // ===================
  // Casting
  // ===================

  /**
   * Check if the ability can be cast.
   */
  canCast(context: AbilityCastContext): AbilityCastResult {
    // Must be learned
    if (!this.isLearned) {
      return { success: false, failReason: 'invalid_target' };
    }

    // Check cooldown
    if (this.isOnCooldown) {
      return { success: false, failReason: 'on_cooldown' };
    }

    // Check mana
    const manaCost = this.getManaCost();
    if (this.owner && this.owner.getCurrentResource() < manaCost) {
      return { success: false, failReason: 'not_enough_mana' };
    }

    // Check crowd control
    if (this.owner) {
      const ccStatus = this.owner.getCrowdControlStatus();
      if (!ccStatus.canCast) {
        return { success: false, failReason: 'silenced' };
      }
      if (!ccStatus.canMove && !ccStatus.canAttack) {
        return { success: false, failReason: 'stunned' };
      }
    }

    // Check range for targeted abilities
    if (this.definition.range && context.targetUnit) {
      const distance = this.owner?.getPosition().distanceTo(context.targetUnit.getPosition()) ?? Infinity;
      if (distance > this.definition.range) {
        return { success: false, failReason: 'out_of_range' };
      }
    }

    // Let subclass perform additional checks
    return this.onCanCast(context);
  }

  /**
   * Attempt to cast the ability.
   */
  cast(context: AbilityCastContext): AbilityCastResult {
    const canCastResult = this.canCast(context);
    if (!canCastResult.success) {
      return canCastResult;
    }

    // Consume mana
    const manaCost = this.getManaCost();
    if (this.owner && manaCost > 0) {
      this.owner.consumeResource(manaCost);
    }

    // Start cooldown
    this.startCooldown();

    // Handle cast time
    if (this.definition.castTime && this.definition.castTime > 0) {
      this.startCasting();
      // Store context for when cast completes
      this.pendingCastContext = context;
    } else {
      // Instant cast - execute immediately
      this.execute(context);
    }

    return {
      success: true,
      manaCost,
      cooldownStarted: this.getCooldown(),
    };
  }

  /** Context for a pending cast (when ability has cast time) */
  private pendingCastContext: AbilityCastContext | null = null;

  /**
   * Called when cast time completes.
   */
  protected onCastComplete(): void {
    if (this.pendingCastContext) {
      this.execute(this.pendingCastContext);
      this.pendingCastContext = null;
    }
  }

  // ===================
  // Abstract Methods (Subclass Implementation)
  // ===================

  /**
   * Execute the ability's effect.
   * Subclasses must implement this.
   */
  protected abstract execute(context: AbilityCastContext): void;

  /**
   * Called each frame for ability-specific updates.
   * Subclasses can override this.
   */
  protected onUpdate(gctx: GameContext): void {
    // Default: do nothing
  }

  /**
   * Subclass can add additional cast checks.
   */
  protected onCanCast(context: AbilityCastContext): AbilityCastResult {
    return { success: true };
  }

  /**
   * Called when the ability is ranked up.
   */
  protected onRankUp(): void {
    // Default: do nothing
  }

  // ===================
  // Description
  // ===================

  /**
   * Get the ability description with current values filled in.
   */
  getDescription(): string {
    let desc = this.definition.description;

    // Replace placeholders with actual values
    desc = desc.replace('{damage}', this.getDamage().toFixed(0));
    desc = desc.replace('{heal}', this.getHealAmount().toFixed(0));
    desc = desc.replace('{shield}', this.getShieldAmount().toFixed(0));
    desc = desc.replace('{manaCost}', this.getManaCost().toFixed(0));
    desc = desc.replace('{cooldown}', this.getCooldown().toFixed(1));

    return desc;
  }

  /**
   * Get the target description based on the ability definition.
   * Used for targeting UI and validation.
   */
  getTargetDescription(): IAbilityTargetDescription {
    const def = this.definition;
    const range = def.range ?? 500;
    const aoeRadius = def.aoeRadius ?? 0;

    switch (def.targetType) {
      case 'self':
        return new SelfTargetAbilityTargetDescription();

      case 'target_enemy':
        return new SingleTargetInRangeAbilityTargetDescription(range);

      case 'target_ally':
        return new SingleAllyInRangeAbilityTargetDescription(range);

      case 'skillshot':
        // Default skillshot width of 60
        return new SkillshotAbilityTargetDescription(range, 60);

      case 'ground_target':
        return new GroundTargetAbilityTargetDescription(range, aoeRadius);

      case 'aura':
      case 'no_target':
        if (aoeRadius > 0) {
          return new AoEAroundSelfAbilityTargetDescription(aoeRadius);
        }
        return new NoTargetAbilityTargetDescription();

      case 'toggle':
      case 'target_unit':
      default:
        return new NoTargetAbilityTargetDescription();
    }
  }
}

export default Ability;
