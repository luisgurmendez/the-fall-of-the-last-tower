/**
 * ChampionEffects - Buffs, debuffs, crowd control and shields on a champion.
 *
 * The state stays on the champion (activeEffects, ccStatus, shields) because
 * abilities, passives and the network layer read and write it directly.
 * This class holds the rules that act on it:
 * - Applying effects (stack behavior), removing and cleansing them
 * - Ticking durations and over-time effects (DoT/HoT, mana drain/restore)
 * - Deriving the crowd control status from active effects
 * - Taunts: who taunts the champion (the taunt's source), ending the taunt
 *   when its taunter is dead, gone or out of reach
 * - Shield decay and damage absorption
 */

import { GameConfig, type ActiveEffectState, type CrowdControlStatus } from '@siege/shared';
import {
  getServerEffectById,
  isCCEffect,
  isOverTimeEffect,
  isStatEffect,
  isInvulnerabilityEffect,
  type AnyServerEffectDef,
  type ServerOverTimeEffectDef,
} from '../../data/effects';

/** A taunter farther than this (a champion's sight) is out of reach: the taunt ends */
const TAUNT_REACH = GameConfig.VISION.CHAMPION_SIGHT_RANGE;

/** Crowd control tenacity doesn't shorten (LoL's rule: displacements and suppression) */
const UNSHORTENED_CC = new Set(['knockup', 'knockback', 'suppress', 'stasis']);

/**
 * Whether tenacity shortens an effect: crowd control (but displacements and
 * suppression) and slows, when an enemy puts them on.
 */
function isShortenedByTenacity(def: AnyServerEffectDef): boolean {
  if (def.category !== 'debuff') return false;
  if (isCCEffect(def)) return !UNSHORTENED_CC.has(def.ccType);
  if (isStatEffect(def) && def.stat === 'movement_speed') {
    return (def.percentValue ?? 0) < 0 || (def.flatValue ?? 0) < 0;
  }
  return false;
}
import { Logger } from '../../utils/Logger';
import type { ServerChampion } from '../ServerChampion';
import type { ServerEntity } from '../ServerEntity';
import type { ServerGameContext } from '../../game/ServerGameContext';

export interface ActiveShield {
  amount: number;
  remainingDuration: number;
  sourceId: string;
  /** Shield type for visual styling - defaults to 'normal' if not specified */
  shieldType?: 'normal' | 'magic' | 'physical' | 'passive';
}

/**
 * Calculate CC status from active effects.
 */
export function calculateCCStatus(activeEffects: readonly ActiveEffectState[]): CrowdControlStatus {
  const status: CrowdControlStatus = {
    isStunned: false,
    isSilenced: false,
    isGrounded: false,
    isRooted: false,
    isDisarmed: false,
    isTaunted: false,
    canMove: true,
    canAttack: true,
    canCast: true,
    canUseMobilityAbilities: true,
  };

  for (const effect of activeEffects) {
    const def = getServerEffectById(effect.definitionId);
    if (!def || !isCCEffect(def)) continue;

    switch (def.ccType) {
      case 'stun':
      case 'knockup':
      case 'knockback':
      case 'suppress':
      case 'stasis':
        status.isStunned = true;
        break;
      case 'silence':
        status.isSilenced = true;
        break;
      case 'grounded':
        status.isGrounded = true;
        break;
      case 'root':
        status.isRooted = true;
        break;
      case 'disarm':
      case 'blind':
        status.isDisarmed = true;
        break;
      case 'taunt':
        // It walks (to its taunter) and attacks (its taunter), but casts nothing
        status.isTaunted = true;
        break;
      case 'slow':
        // Slow doesn't set a flag, it modifies movement speed via stat effect
        break;
    }
  }

  // Compute ability to act
  status.canMove = !status.isStunned && !status.isRooted;
  status.canAttack = !status.isStunned && !status.isDisarmed;
  status.canCast = !status.isStunned && !status.isSilenced && !status.isTaunted;
  status.canUseMobilityAbilities = status.canMove && status.canCast && !status.isGrounded;

  return status;
}

/**
 * The taunt among a unit's effects, if one holds it (its sourceId is the
 * taunter). Champions and jungle monsters read it.
 */
export function findTaunt(activeEffects: readonly ActiveEffectState[]): ActiveEffectState | undefined {
  return activeEffects.find(effect => {
    const def = getServerEffectById(effect.definitionId);
    return def !== undefined && isCCEffect(def) && def.ccType === 'taunt';
  });
}

export class ChampionEffects {
  constructor(private readonly champion: ServerChampion) {}

  // =====================
  // Tick
  // =====================

  /**
   * Update effects.
   */
  update(dt: number, context: ServerGameContext): void {
    const champion = this.champion;

    // Process over-time effects and update timers
    champion.activeEffects = champion.activeEffects.filter(effect => {
      const def = getServerEffectById(effect.definitionId);

      // Handle over-time effects (DoT/HoT)
      if (def && isOverTimeEffect(def)) {
        this.processOverTimeEffect(effect, def, dt, context);
      }

      // Update timer
      effect.timeRemaining -= dt;
      return effect.timeRemaining > 0;
    });

    // Recalculate CC status from active effects
    this.refreshCrowdControl();

    // Invalidate cached stats (effects may modify stats)
    champion.invalidateStats();
  }

  /**
   * Process an over-time effect tick.
   */
  private processOverTimeEffect(
    effect: ActiveEffectState,
    def: ServerOverTimeEffectDef,
    dt: number,
    context: ServerGameContext
  ): void {
    const champion = this.champion;

    // Initialize nextTickIn if not set
    if (effect.nextTickIn === undefined) {
      effect.nextTickIn = def.tickInterval;
    }

    // Countdown to next tick
    effect.nextTickIn -= dt;

    // Process tick when timer reaches 0
    while (effect.nextTickIn <= 0) {
      const tickValue = def.valuePerTick * effect.stacks;

      switch (def.otType) {
        case 'damage':
          // Apply damage (DoT)
          champion.takeDamage(tickValue, def.damageType || 'magic', effect.sourceId, context);
          break;
        case 'heal':
          // Apply healing (HoT)
          champion.heal(tickValue, context, effect.sourceId);
          break;
        case 'mana_drain':
          // Drain mana
          champion.resource = Math.max(0, champion.resource - tickValue);
          break;
        case 'mana_restore':
          // Restore mana
          const stats = champion.getStats();
          champion.resource = Math.min(stats.maxResource, champion.resource + tickValue);
          break;
      }

      // Reset tick timer
      effect.nextTickIn += def.tickInterval;
    }
  }

  /**
   * Recalculate the champion's CC status from its active effects.
   */
  private refreshCrowdControl(): void {
    this.champion.ccStatus = calculateCCStatus(this.champion.activeEffects);
  }

  /**
   * After effects were removed outside the normal flow (stealth broken, a
   * cleanse): recompute crowd control and stats right away instead of next tick.
   */
  refreshAfterRemoval(): void {
    this.refreshCrowdControl();
    this.champion.invalidateStats();
  }

  // =====================
  // Applying and removing
  // =====================

  /**
   * Apply an effect to the champion.
   */
  apply(effectId: string, duration: number, sourceId?: string, stacks = 1): void {
    const champion = this.champion;
    const def = getServerEffectById(effectId);
    if (!def) {
      Logger.champion.warn(`Unknown effect: ${effectId}`);
      return;
    }

    // Tenacity shortens crowd control and slows from others
    if (sourceId !== champion.id && isShortenedByTenacity(def)) {
      duration *= 1 - champion.getStats().tenacity;
    }

    // Check for existing effect
    const existing = champion.activeEffects.find(e => e.definitionId === effectId);

    if (existing) {
      // Handle stack behavior
      switch (def.stackBehavior) {
        case 'refresh':
          existing.timeRemaining = duration;
          existing.totalDuration = duration; // Update total for timer display
          break;
        case 'extend':
          existing.timeRemaining += duration;
          existing.totalDuration = existing.timeRemaining; // Total becomes extended duration
          break;
        case 'stack':
          if (!def.maxStacks || existing.stacks < def.maxStacks) {
            existing.stacks += stacks;
          }
          existing.timeRemaining = duration; // Usually refresh on stack
          existing.totalDuration = duration;
          break;
        case 'replace':
          existing.timeRemaining = duration;
          existing.totalDuration = duration;
          existing.stacks = stacks;
          break;
        case 'ignore':
          // Do nothing
          break;
      }
    } else {
      // Add new effect
      const newEffect: ActiveEffectState = {
        definitionId: effectId,
        sourceId,
        timeRemaining: duration,
        totalDuration: duration, // Track initial duration for timer display
        stacks,
        instanceId: `${effectId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      // Initialize over-time effect tick timer
      if (isOverTimeEffect(def)) {
        newEffect.nextTickIn = def.tickInterval;
      }

      champion.activeEffects.push(newEffect);
    }

    // Invalidate cached stats and recalculate CC status
    champion.invalidateStats();
    this.refreshCrowdControl();
  }

  /**
   * Remove an effect from the champion.
   */
  remove(effectId: string): boolean {
    const champion = this.champion;
    const index = champion.activeEffects.findIndex(e => e.definitionId === effectId);
    if (index === -1) return false;

    champion.activeEffects.splice(index, 1);
    champion.invalidateStats();
    this.refreshCrowdControl();
    return true;
  }

  /**
   * Remove all effects matching a category.
   */
  removeByCategory(category: 'buff' | 'debuff' | 'neutral'): number {
    const champion = this.champion;
    const before = champion.activeEffects.length;
    champion.activeEffects = champion.activeEffects.filter(e => {
      const def = getServerEffectById(e.definitionId);
      return def?.category !== category;
    });
    champion.invalidateStats();
    this.refreshCrowdControl();
    return before - champion.activeEffects.length;
  }

  /**
   * Cleanse all cleansable debuffs.
   */
  cleanse(): number {
    const champion = this.champion;
    const before = champion.activeEffects.length;
    champion.activeEffects = champion.activeEffects.filter(e => {
      const def = getServerEffectById(e.definitionId);
      // Keep if not a debuff, or if not cleansable
      return def?.category !== 'debuff' || !def.cleansable;
    });
    champion.invalidateStats();
    this.refreshCrowdControl();
    return before - champion.activeEffects.length;
  }

  /**
   * Remove stealth effects (called when attacking or using abilities).
   */
  breakStealth(): void {
    const before = this.champion.activeEffects.length;
    this.champion.activeEffects = this.champion.activeEffects.filter(
      e => !e.definitionId.includes('stealth') &&
           !e.definitionId.includes('invisible')
    );
    if (this.champion.activeEffects.length !== before) {
      this.refreshAfterRemoval();
    }
  }

  /**
   * Extend an effect's duration by the specified amount, with optional max cap.
   * Also extends the matching Ninja Mode stat modifier, if any.
   * @returns The actual amount extended (0 if effect not found or at cap)
   */
  extendDuration(effectId: string, amount: number, maxDuration?: number): number {
    const champion = this.champion;
    const effect = champion.getEffect(effectId);
    if (!effect) return 0;

    // Calculate actual extension (respecting max cap)
    let actualExtension = amount;
    const currentTotal = effect.totalDuration ?? effect.timeRemaining;
    if (maxDuration !== undefined) {
      const newTotal = Math.min(currentTotal + amount, maxDuration);
      actualExtension = newTotal - currentTotal;

      if (actualExtension <= 0) {
        Logger.champion.debug(
          `${champion.playerId} effect ${effectId} at max duration (${maxDuration}s)`
        );
        return 0;
      }

      effect.totalDuration = newTotal;
    } else {
      effect.totalDuration = currentTotal + amount;
    }

    effect.timeRemaining += actualExtension;

    // Also extend any associated stat modifier
    const modifierSource = `ninja_mode_${effectId}`;
    const modifier = champion.getModifier(modifierSource);
    if (modifier && modifier.timeRemaining !== undefined) {
      modifier.timeRemaining += actualExtension;
      if (modifier.duration !== undefined) {
        modifier.duration += actualExtension;
      }
    }

    Logger.champion.info(
      `${champion.playerId} ${effectId} extended by ${actualExtension}s (total: ${effect.totalDuration}s)`
    );

    return actualExtension;
  }

  /**
   * Who taunts the champion, if a taunt holds it: the taunt's source, which
   * it must walk to and attack, seen or not (a roar from a bush still pulls).
   * A taunt whose taunter is dead, gone or out of reach (farther than a
   * champion sees: it blinked or was carried away) ends here, as if it ran out.
   */
  taunter(context: ServerGameContext): ServerEntity | null {
    const champion = this.champion;
    const taunt = findTaunt(champion.activeEffects);
    if (!taunt) return null;
    const taunter = taunt.sourceId ? context.getEntity(taunt.sourceId) : undefined;
    if (taunter && !taunter.isDead && taunter.position.distanceTo(champion.position) <= TAUNT_REACH) return taunter;
    champion.activeEffects = champion.activeEffects.filter(effect => effect !== taunt);
    this.refreshAfterRemoval();
    return null;
  }

  // =====================
  // Queries
  // =====================

  /**
   * Get an active effect by ID.
   */
  get(effectId: string): ActiveEffectState | undefined {
    return this.champion.activeEffects.find(e => e.definitionId === effectId);
  }

  /**
   * Check if the champion has a specific effect.
   */
  has(effectId: string): boolean {
    return this.champion.activeEffects.some(e => e.definitionId === effectId);
  }

  /**
   * How much less healing the champion receives: the strongest of its
   * effects' healing reductions (Wounds, Scorch).
   */
  healingReduction(): number {
    let reduction = 0;
    for (const effect of this.champion.activeEffects) {
      reduction = Math.max(reduction, getServerEffectById(effect.definitionId)?.healingReduction ?? 0);
    }
    return reduction;
  }

  /**
   * Check if any active effect grants invulnerability.
   */
  isInvulnerable(): boolean {
    for (const effect of this.champion.activeEffects) {
      const def = getServerEffectById(effect.definitionId);
      if (def && isInvulnerabilityEffect(def)) {
        return true;
      }
    }
    return false;
  }

  // =====================
  // Shields
  // =====================

  /**
   * Tick shield durations and drop expired or depleted shields.
   */
  updateShields(dt: number): void {
    this.champion.shields = this.champion.shields.filter(shield => {
      shield.remainingDuration -= dt;
      return shield.remainingDuration > 0 && shield.amount > 0;
    });
  }

  /**
   * Absorb damage with shields, in list order.
   * @returns The damage left for health and the amount the shields absorbed
   */
  absorbDamage(damage: number): { damage: number; absorbed: number } {
    let absorbed = 0;

    for (const shield of this.champion.shields) {
      if (shield.amount >= damage) {
        absorbed += damage;
        shield.amount -= damage;
        damage = 0;
        break;
      } else {
        absorbed += shield.amount;
        damage -= shield.amount;
        shield.amount = 0;
      }
    }

    return { damage, absorbed };
  }
}
