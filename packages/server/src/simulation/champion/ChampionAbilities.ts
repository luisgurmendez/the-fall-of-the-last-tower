/**
 * ChampionAbilities - Per-slot ability state on a champion.
 *
 * - Leveling: skill points, max ranks, R unlocks at levels 6/11/16
 * - Ticking cooldowns, cast times and recast windows
 * - Ammo: an ability with charges (its definition's ammo, Vile's traps)
 *   starts with its startingCharges when learned, spends one per cast and
 *   gets one back every rechargeTime[rank], one at a time, up to maxCharges
 *   (state.charges, state.chargeRegenRemaining)
 * - Recasts: abilities whose projectile hit opens a recast at the hit position
 * - Swaps: a slot can hold another ability for a while (swapSlot; Nocthar's
 *   colossus). The slot's rank is its rank; each ability keeps its own
 *   cooldown, which keeps running while it's out of the slot
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
  getAmmoBehavior,
  type AbilitySlot,
  type AbilityState,
  type AmmoBehavior,
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

/** Seconds for a charge to come back at a rank */
function rechargeTime(ammo: AmmoBehavior, rank: number): number {
  const times = ammo.rechargeTime;
  return times[Math.min(Math.max(rank, 1), times.length) - 1] ?? 0;
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
  /** Cooldowns of abilities out of their slot, and when they were put away (game time) */
  private putAway = new Map<string, { cooldownRemaining: number; cooldownTotal: number; at: number }>();
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
      // Charges come back
      if (state.charges !== undefined) this.rechargeAmmo(slot, dt);
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

    // Learned: an ability with charges starts with its starting charges
    const ammo = this.ammoOf(slot);
    if (ammo && champion.abilityStates[slot].rank === 1) this.fillAmmo(slot, ammo);

    return true;
  }

  // =====================
  // Ammo (charges)
  // =====================

  /**
   * Whether the slot's ability has a charge to cast with (always true for
   * one without ammo).
   */
  hasCharge(slot: AbilitySlot): boolean {
    const ammo = this.ammoOf(slot);
    if (!ammo) return true;
    const state = this.champion.abilityStates[slot];
    // (Learned some other way than levelUp)
    if (state.charges === undefined) this.fillAmmo(slot, ammo);
    return (state.charges ?? 0) > 0;
  }

  /**
   * Spend a charge of the slot's ability (nothing without ammo); the next
   * one starts coming back if it was full.
   */
  spendCharge(slot: AbilitySlot): void {
    const ammo = this.ammoOf(slot);
    if (!ammo) return;
    const state = this.champion.abilityStates[slot];
    if (state.charges === undefined) this.fillAmmo(slot, ammo);
    state.charges = Math.max(0, (state.charges ?? 0) - 1);
    if (!((state.chargeRegenRemaining ?? 0) > 0)) state.chargeRegenRemaining = rechargeTime(ammo, state.rank);
  }

  /** The slot's ability's ammo, if it has charges */
  private ammoOf(slot: AbilitySlot): AmmoBehavior | undefined {
    const definition = getAbilityDefinition(this.abilityInSlot(slot));
    return definition ? getAmmoBehavior(definition) : undefined;
  }

  /** Its starting charges (recharging toward the maximum if fewer) */
  private fillAmmo(slot: AbilitySlot, ammo: AmmoBehavior): void {
    const state = this.champion.abilityStates[slot];
    state.charges = Math.min(ammo.maxCharges, ammo.startingCharges ?? ammo.maxCharges);
    state.chargeRegenRemaining = state.charges < ammo.maxCharges ? rechargeTime(ammo, state.rank) : 0;
  }

  /** A charge comes back every rechargeTime, one at a time, up to the maximum */
  private rechargeAmmo(slot: AbilitySlot, dt: number): void {
    const ammo = this.ammoOf(slot);
    const state = this.champion.abilityStates[slot];
    if (!ammo || state.charges === undefined) return;
    if (state.charges >= ammo.maxCharges) {
      state.chargeRegenRemaining = 0;
      return;
    }
    state.chargeRegenRemaining = (state.chargeRegenRemaining ?? 0) - dt;
    if (state.chargeRegenRemaining <= 0) {
      state.charges++;
      state.chargeRegenRemaining = state.charges < ammo.maxCharges
        ? state.chargeRegenRemaining + rechargeTime(ammo, state.rank)
        : 0;
    }
  }

  // =====================
  // Swaps
  // =====================

  /** The ability a slot holds now: its own, or the one swapped in */
  abilityInSlot(slot: AbilitySlot): string {
    return this.champion.abilityStates[slot].abilityId ?? this.champion.definition.abilities[slot];
  }

  /**
   * Put `abilityId` in the slot instead of what it holds (null: its own
   * ability). The ability put away keeps its cooldown, running; the one put
   * in gets back what's left of its own (ready if it was never cast).
   */
  swapSlot(slot: AbilitySlot, abilityId: string | null, gameTime: number): void {
    const state = this.champion.abilityStates[slot];
    const own = this.champion.definition.abilities[slot];
    const incoming = abilityId ?? own;
    const outgoing = this.abilityInSlot(slot);
    if (incoming === outgoing) return;

    this.putAway.set(outgoing, { cooldownRemaining: state.cooldownRemaining, cooldownTotal: state.cooldownTotal, at: gameTime });
    const stored = this.putAway.get(incoming);
    this.putAway.delete(incoming);
    state.cooldownRemaining = stored ? Math.max(0, stored.cooldownRemaining - (gameTime - stored.at)) : 0;
    state.cooldownTotal = stored?.cooldownTotal ?? 0;
    state.abilityId = incoming === own ? null : incoming;
    state.recastCount = undefined;
    state.recastWindowRemaining = undefined;
    delete this.recastHitPositions[slot];
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
