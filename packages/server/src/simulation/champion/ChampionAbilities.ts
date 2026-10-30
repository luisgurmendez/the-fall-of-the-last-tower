/**
 * ChampionAbilities - Per-slot ability state on a champion.
 *
 * - Leveling: skill points, max ranks, R unlocks at levels 6/11/16
 * - Ticking cooldowns, cast times and recast windows
 * - Recasts: abilities whose projectile hit opens a recast at the hit position
 * - Ability projectiles scheduled at an animation keyframe; they are
 *   cancelled when the champion can no longer cast
 *
 * The per-slot state (abilityRanks, abilityStates) stays on the champion
 * because the ability executor, handlers and snapshots use it directly.
 * Casting itself lives in ServerAbilityExecutor.
 */

import {
  Vector,
  getAbilityDefinition,
  type AbilitySlot,
  type AbilityState,
  type DamageType,
} from '@siege/shared';
import { AnimationScheduler, type ScheduledAction } from '../../systems/AnimationScheduler';
import { Logger } from '../../utils/Logger';
import { ServerProjectile } from '../ServerProjectile';
import type { ServerChampion } from '../ServerChampion';
import type { ServerGameContext } from '../../game/ServerGameContext';

const ABILITY_SLOTS: readonly AbilitySlot[] = ['Q', 'W', 'E', 'R'];

/** Champion levels at which R can be ranked up (one rank each) */
const R_REQUIRED_LEVELS: readonly number[] = [6, 11, 16];

export interface ScheduledAbilityProjectile {
  direction: Vector;
  speed: number;
  radius: number;
  maxDistance: number;
  damage: number;
  damageType: DamageType;
  piercing: boolean;
  appliesEffects?: string[];
  effectDuration?: number;
}

export function createDefaultAbilityState(): AbilityState {
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

export class ChampionAbilities {
  /** Recast tracking - stores hit position for abilities with recast behavior */
  private recastHitPositions: Partial<Record<AbilitySlot, Vector>> = {};
  /** Ability actions waiting on an animation keyframe (separate from basic attacks) */
  private readonly animationScheduler = new AnimationScheduler();

  constructor(private readonly champion: ServerChampion) {}

  // =====================
  // Tick
  // =====================

  /**
   * Update abilities (cooldowns and recast windows).
   */
  update(dt: number): void {
    for (const slot of ABILITY_SLOTS) {
      const state = this.champion.abilityStates[slot];
      if (state.cooldownRemaining > 0) {
        // Cooldowns tick at normal rate - CDR is applied upfront when ability is cast
        state.cooldownRemaining = Math.max(0, state.cooldownRemaining - dt);
      }
      if (state.castTimeRemaining > 0) {
        state.castTimeRemaining = Math.max(0, state.castTimeRemaining - dt);
        if (state.castTimeRemaining <= 0) {
          state.isCasting = false;
        }
      }
      // Update recast window
      if (state.recastWindowRemaining !== undefined && state.recastWindowRemaining > 0) {
        state.recastWindowRemaining = Math.max(0, state.recastWindowRemaining - dt);
        // Clear recast state when window expires
        if (state.recastWindowRemaining <= 0) {
          state.recastCount = undefined;
          state.recastWindowRemaining = undefined;
          delete this.recastHitPositions[slot];
        }
      }
    }
  }

  // =====================
  // Leveling
  // =====================

  /**
   * Level up an ability.
   */
  levelUp(slot: AbilitySlot): boolean {
    const champion = this.champion;
    if (champion.skillPoints <= 0) {
      return false;
    }

    const currentRank = champion.abilityRanks[slot];
    const maxRank = getAbilityDefinition(champion.definition.abilities[slot])?.maxRank ?? (slot === 'R' ? 3 : 5);

    // R ability has special level requirements (and stops at the last one)
    if (slot === 'R') {
      if (currentRank >= R_REQUIRED_LEVELS.length || champion.level < R_REQUIRED_LEVELS[currentRank]) {
        return false;
      }
    }

    if (currentRank >= maxRank) {
      return false;
    }

    champion.abilityRanks[slot]++;
    champion.abilityStates[slot].rank = champion.abilityRanks[slot];
    champion.skillPoints--;

    return true;
  }

  // =====================
  // Recasts
  // =====================

  /**
   * Enable recast for an ability (called when projectile hits).
   */
  enableRecast(slot: AbilitySlot, hitPosition: Vector, maxRecasts: number, recastWindow: number): void {
    const state = this.champion.abilityStates[slot];
    state.recastCount = maxRecasts;
    state.recastWindowRemaining = recastWindow;
    this.recastHitPositions[slot] = hitPosition.clone();
    Logger.champion.debug(`${this.champion.playerId} ${slot} recast enabled at (${hitPosition.x.toFixed(0)}, ${hitPosition.y.toFixed(0)}) for ${recastWindow}s`);
  }

  /**
   * Check if an ability has recast available.
   */
  hasRecastAvailable(slot: AbilitySlot): boolean {
    const state = this.champion.abilityStates[slot];
    return (state.recastCount ?? 0) > 0 && (state.recastWindowRemaining ?? 0) > 0;
  }

  /**
   * Get the recast hit position for an ability.
   */
  getRecastHitPosition(slot: AbilitySlot): Vector | undefined {
    return this.recastHitPositions[slot];
  }

  /**
   * Consume a recast (called when recast is used).
   */
  consumeRecast(slot: AbilitySlot): void {
    const state = this.champion.abilityStates[slot];
    if (state.recastCount !== undefined && state.recastCount > 0) {
      state.recastCount--;
      if (state.recastCount <= 0) {
        state.recastCount = undefined;
        state.recastWindowRemaining = undefined;
        delete this.recastHitPositions[slot];
      }
    }
  }

  // =====================
  // Scheduled ability actions
  // =====================

  /**
   * Schedule an ability projectile to spawn at the animation keyframe time.
   */
  scheduleProjectile(
    abilityId: string,
    triggerTime: number,
    projectileConfig: ScheduledAbilityProjectile
  ): void {
    const champion = this.champion;
    this.animationScheduler.schedule({
      entityId: champion.id,
      actionType: 'projectile',
      triggerTime,
      data: {
        abilityId,
        direction: { x: projectileConfig.direction.x, y: projectileConfig.direction.y },
        speed: projectileConfig.speed,
        radius: projectileConfig.radius,
        maxDistance: projectileConfig.maxDistance,
        damage: projectileConfig.damage,
        damageType: projectileConfig.damageType,
        piercing: projectileConfig.piercing,
        appliesEffects: projectileConfig.appliesEffects,
        effectDuration: projectileConfig.effectDuration,
        // Store caster position at time of scheduling for projectile spawn position
        spawnPosition: { x: champion.position.x, y: champion.position.y },
      },
    });
  }

  /**
   * Process scheduled ability actions (projectile spawns, etc.)
   */
  processScheduledActions(dt: number, context: ServerGameContext): void {
    // Cancel pending ability actions if silenced or stunned
    if (!this.champion.ccStatus.canCast) {
      this.animationScheduler.cancelForEntity(this.champion.id, 'projectile');
      return;
    }

    // Process scheduled ability actions
    this.animationScheduler.update(dt, (action) => {
      if (action.actionType === 'projectile') {
        this.spawnScheduledProjectile(action, context);
      }
    });
  }

  /**
   * Spawn a projectile from a scheduled ability action.
   */
  private spawnScheduledProjectile(action: ScheduledAction, context: ServerGameContext): void {
    const champion = this.champion;
    const data = action.data;

    // Create projectile at the caster's current position (not where they were when cast started)
    // This allows "leading" shots if the caster moves during cast
    const projectile = new ServerProjectile({
      id: context.generateEntityId(),
      position: champion.position.clone(),
      side: champion.side,
      direction: new Vector(
        (data.direction as { x: number; y: number }).x,
        (data.direction as { x: number; y: number }).y,
      ).normalized(),
      speed: data.speed as number,
      radius: data.radius as number,
      maxDistance: data.maxDistance as number,
      sourceId: champion.id,
      abilityId: data.abilityId as string,
      damage: data.damage as number,
      damageType: data.damageType as DamageType,
      piercing: data.piercing as boolean,
      appliesEffects: data.appliesEffects as string[] | undefined,
      effectDuration: data.effectDuration as number | undefined,
    });

    context.addEntity(projectile);
  }
}
