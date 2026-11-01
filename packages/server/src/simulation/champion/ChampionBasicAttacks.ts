/**
 * ChampionBasicAttacks - A champion's basic (auto) attacks.
 *
 * - The attack timer allows one attack every 1 / attackSpeed seconds
 * - An attack starts right away (on_attack trigger, BASIC_ATTACK event) and
 *   deals its damage at the attack animation's damage keyframe
 * - Melee attacks hit at the keyframe; ranged attacks fire a targeted
 *   projectile there that deals the damage when it arrives
 * - On hit: jungle buff effects, champion hooks (melee only) and on_hit passives
 * - Pending damage is cancelled when the champion can no longer attack
 */

import { EntityType, GameEventType, getBasicAttackDamageDelay, getBasicAttackDuration } from '@siege/shared';
import { AnimationScheduler, type ScheduledAction } from '../../systems/AnimationScheduler';
import { passiveTriggerSystem } from '../../systems/PassiveTriggerSystem';
import { championHooksRegistry } from '../../abilities/ChampionHooksRegistry';
import { Logger } from '../../utils/Logger';
import { ServerTargetedProjectile } from '../ServerTargetedProjectile';
import type { ServerEntity } from '../ServerEntity';
import type { ServerChampion } from '../ServerChampion';
import type { ServerGameContext } from '../../game/ServerGameContext';

export class ChampionBasicAttacks {
  /** Time until the next attack can start */
  private attackCooldown = 0;
  /** Attack damage waiting on the animation's damage keyframe */
  private readonly animationScheduler = new AnimationScheduler();

  constructor(private readonly champion: ServerChampion) {}

  /**
   * Count down the attack timer.
   */
  updateCooldown(dt: number): void {
    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }
  }

  /**
   * Seconds until the next attack can start (0 when it's ready).
   */
  get cooldownRemaining(): number {
    return Math.max(0, this.attackCooldown);
  }

  /** Make the next attack ready at once (an attack reset, like Urûk's Spear Charge) */
  resetCooldown(): void {
    this.attackCooldown = 0;
  }

  /**
   * Seconds from starting an attack to its damage: the animation's damage
   * keyframe (ranged attacks then fire a projectile).
   */
  getDamageDelay(): number {
    // The animation's damage keyframe, or halfway through it (clients time the strip's blow with the same)
    return getBasicAttackDamageDelay(this.champion.definition, this.champion.getStats().attackSpeed);
  }

  /**
   * Attack the champion's target if it is in range and an attack is ready.
   */
  attackTargetIfReady(context: ServerGameContext): void {
    const champion = this.champion;
    if (champion.targetEntityId && this.attackCooldown <= 0 && champion.ccStatus.canAttack) {
      const target = context.getEntity(champion.targetEntityId);
      if (target && !target.isDead && champion.isInAttackRange(target, champion.getAttackRange())) {
        this.performBasicAttack(target, context);
      }
    }
  }

  /**
   * Perform a basic attack on a target.
   * Schedules damage to occur at the attack animation's damage keyframe.
   */
  private performBasicAttack(target: ServerEntity, context: ServerGameContext): void {
    const champion = this.champion;

    // Break stealth on attack (Vex's Shadow Shroud)
    champion.breakStealth();

    const stats = champion.getStats();

    // Dispatch on_attack trigger BEFORE attack (immediately when attack starts)
    passiveTriggerSystem.dispatchTrigger('on_attack', champion, context, { target });
    championHooksRegistry.get(champion.definition.id)?.onBasicAttackStart?.(champion, target, context);

    // Set attack cooldown immediately (can't attack again until cooldown expires)
    this.attackCooldown = 1 / stats.attackSpeed;

    // Schedule damage at the animation's damage keyframe
    const damageDelay = this.getDamageDelay();

    // Schedule the damage action
    this.animationScheduler.schedule({
      entityId: champion.id,
      actionType: 'damage',
      triggerTime: damageDelay,
      data: {
        targetId: target.id,
        attackDamage: stats.attackDamage,
        abilityPower: stats.abilityPower,
      },
    });

    // Attack animation duration scales with attack speed
    const animationDuration = getBasicAttackDuration(stats.attackSpeed);

    // Emit attack event for client-side animation
    context.addEvent(GameEventType.BASIC_ATTACK, {
      entityId: champion.id,
      targetId: target.id,
      animationDuration,
    });

    // Enter combat
    champion.enterCombat();
  }

  /**
   * Process scheduled animation actions (attack damage, etc.)
   */
  processScheduledActions(dt: number, context: ServerGameContext): void {
    // Cancel pending attacks if stunned or can't attack
    if (!this.champion.ccStatus.canAttack) {
      this.animationScheduler.cancelForEntity(this.champion.id, 'damage');
      return;
    }

    // Process scheduled actions
    this.animationScheduler.update(dt, (action) => {
      if (action.actionType === 'damage') {
        this.applyScheduledAttackDamage(action, context);
      }
    });
  }

  /**
   * Apply damage from a scheduled attack action.
   * For ranged champions, spawns a projectile that deals damage on hit.
   * For melee champions, deals damage instantly.
   */
  private applyScheduledAttackDamage(action: ScheduledAction, context: ServerGameContext): void {
    const champion = this.champion;
    const targetId = action.data.targetId as string;
    const target = context.getEntity(targetId);

    // Validate target is still valid
    if (!target || target.isDead) {
      return;
    }

    // Check if target is still in range (leeway for movement during animation)
    const leewayRange = champion.getAttackRange() + 50; // Small leeway for target movement
    if (!champion.isInAttackRange(target, leewayRange)) {
      return;
    }

    const attackDamage = action.data.attackDamage as number;
    const abilityPower = action.data.abilityPower as number;

    // Raw damage; the target applies its armor in takeDamage()
    const damage = attackDamage;

    // Check if this champion is ranged
    const isRanged = champion.definition.attackType === 'ranged';

    if (isRanged) {
      // Ranged champions fire a projectile that deals damage on hit
      this.fireBasicAttackProjectile(target, damage, context);
    } else {
      // Melee champions deal damage instantly
      this.applyMeleeAttackDamage(target, damage, attackDamage, abilityPower, context);
    }
  }

  /**
   * Fire a basic attack projectile for ranged champions.
   */
  private fireBasicAttackProjectile(
    target: ServerEntity,
    damage: number,
    context: ServerGameContext
  ): void {
    const champion = this.champion;

    // Projectile speed varies by champion (Lume has light-based fast projectiles)
    const projectileSpeed = champion.definition.basicAttackProjectileSpeed ?? 800;

    // Determine projectile type for rendering
    const hooks = championHooksRegistry.get(champion.definition.id);
    const projectileType = hooks?.basicAttackProjectileType?.(champion, target) ?? `${champion.definition.id}_auto`;
    const abilityPower = champion.getStats().abilityPower;

    // Create callback to handle on-hit effects when projectile lands
    const onHitCallback = (hitTarget: ServerEntity, hitDamage: number, hitContext: ServerGameContext, dealt: number) => {
      this.applyOnHitBuffs(hitTarget);
      hooks?.onRangedAttackHit?.(champion, hitTarget, { attackDamage: hitDamage, abilityPower }, hitContext);
      champion.itemPassives.onBasicAttackHit(hitTarget, dealt, hitContext);

      // Dispatch on_hit trigger for passives
      passiveTriggerSystem.dispatchTrigger('on_hit', champion, hitContext, {
        target: hitTarget,
        damageAmount: hitDamage,
        damageType: 'physical',
      });
    };

    const projectile = new ServerTargetedProjectile({
      id: context.generateEntityId(),
      position: champion.position.clone(),
      side: champion.side,
      targetId: target.id,
      speed: projectileSpeed,
      radius: 5, // Small projectile for ranged basic attacks
      sourceId: champion.id,
      projectileType,
      damage,
      damageType: 'physical',
      onHitCallback,
    });

    context.addEntity(projectile);

    Logger.champion.debug(
      `${champion.playerId} fired basic attack projectile at ${target.id}`
    );
  }

  /**
   * Apply instant melee attack damage.
   */
  private applyMeleeAttackDamage(
    target: ServerEntity,
    damage: number,
    attackDamage: number,
    abilityPower: number,
    context: ServerGameContext
  ): void {
    const champion = this.champion;

    const dealt = target.takeDamage(damage, 'physical', champion.id, context);
    target.onBasicAttackTaken(champion, context);

    // Champion-specific on-attack rules (e.g., Vex's empowered attack)
    championHooksRegistry.get(champion.definition.id)?.onMeleeAttackHit?.(
      champion,
      target,
      { attackDamage, abilityPower, dealt },
      context
    );

    this.applyOnHitBuffs(target);
    champion.itemPassives.onBasicAttackHit(target, dealt, context);

    // Dispatch on_hit trigger AFTER attack lands
    passiveTriggerSystem.dispatchTrigger('on_hit', champion, context, {
      target,
      damageAmount: damage,
      damageType: 'physical',
    });
  }

  /**
   * On-hit effects from jungle buffs: with red buff, basic attacks burn and
   * slow champions and minions.
   */
  private applyOnHitBuffs(target: ServerEntity): void {
    if (!this.champion.getEffect('crest_of_cinders') || target.isDead) return;
    if (target.entityType !== EntityType.CHAMPION && target.entityType !== EntityType.MINION) return;

    const affected = target as ServerEntity & { applyEffect(effectId: string, duration: number, sourceId?: string): void };
    affected.applyEffect('cinders_burn', 3, this.champion.id);
    affected.applyEffect('slow_10', 1.5, this.champion.id);
  }
}
