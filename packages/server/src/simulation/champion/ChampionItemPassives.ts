/**
 * ChampionItemPassives - What a champion's items do besides their stats.
 *
 * Each passive in the item catalog (@siege/shared config/items.ts) has an
 * effectType, applied here:
 * - on_hit_damage: basic attacks deal bonus damage
 * - lifesteal: basic attacks heal for a share of the damage they deal
 * - spellblade: casting an ability charges the next basic attack (within a
 *   window) with bonus damage; the cooldown starts when that attack hits
 * - thorns: enemies that land a basic attack on the champion take damage
 * - shield: taking damage below a health threshold grants a shield
 *
 * A passive applies once however many items carry it, and its cooldown is
 * kept by passive id. A charged spellblade and a raised shield also put a
 * marker effect on the champion (item_<passive id>) for the HUD and auras.
 */

import { EntityType, getItemCatalogEntry, type DamageType, type ItemPassiveData } from '@siege/shared';
import type { ServerEntity } from '../ServerEntity';
import type { ServerChampion } from '../ServerChampion';
import type { ServerGameContext } from '../../game/ServerGameContext';

export class ChampionItemPassives {
  /** Remaining cooldown, by passive id */
  private readonly cooldowns = new Map<string, number>();
  /** Spellblade passives charged by an ability cast: game time the charge ends */
  private readonly chargedUntil = new Map<string, number>();

  constructor(private readonly champion: ServerChampion) {}

  /**
   * Count down cooldowns.
   */
  update(dt: number): void {
    for (const [passiveId, remaining] of this.cooldowns) {
      if (remaining - dt <= 0) this.cooldowns.delete(passiveId);
      else this.cooldowns.set(passiveId, remaining - dt);
    }
  }

  /**
   * The champion cast an ability: charge spellblade passives that are ready.
   */
  onAbilityCast(context: ServerGameContext): void {
    for (const passive of this.passivesOfType('spellblade')) {
      if (!this.isReady(passive)) continue;
      const window = Number(passive.effectData.window ?? 10);
      this.chargedUntil.set(passive.id, context.getGameTime() + window);
      this.champion.applyEffect(markerEffectId(passive), window, this.champion.id);
    }
  }

  /**
   * One of the champion's basic attacks hit `target`, dealing `dealt` damage
   * (after the target's resistances).
   */
  onBasicAttackHit(target: ServerEntity, dealt: number, context: ServerGameContext): void {
    const champion = this.champion;

    for (const passive of this.passivesOfType('on_hit_damage')) {
      if (target.isDead) break;
      target.takeDamage(Number(passive.effectData.damage), damageTypeOf(passive), champion.id, context);
    }

    for (const passive of this.passivesOfType('spellblade')) {
      const charged = (this.chargedUntil.get(passive.id) ?? -Infinity) >= context.getGameTime();
      if (!charged || target.isDead) continue;
      this.chargedUntil.delete(passive.id);
      champion.removeEffect(markerEffectId(passive));
      this.startCooldown(passive);
      const stats = champion.getStats();
      const bonus = Number(passive.effectData.apRatio ?? 0) * stats.abilityPower
        + Number(passive.effectData.adRatio ?? 0) * stats.attackDamage;
      target.takeDamage(bonus, damageTypeOf(passive), champion.id, context);
    }

    for (const passive of this.passivesOfType('lifesteal')) {
      champion.heal(dealt * Number(passive.effectData.percent), context, champion.id);
    }
  }

  /**
   * An enemy's basic attack hit the champion: thorns hit back. Structures
   * aren't hit back.
   */
  onHitByBasicAttack(attacker: ServerEntity, context: ServerGameContext): void {
    const champion = this.champion;
    if (attacker.isDead || attacker.side === champion.side || isStructure(attacker)) return;
    for (const passive of this.passivesOfType('thorns')) {
      attacker.takeDamage(Number(passive.effectData.damage), damageTypeOf(passive), champion.id, context);
      if (attacker.isDead) break;
    }
  }

  /**
   * The champion took damage and is still alive: shields for low health.
   */
  onDamaged(): void {
    const champion = this.champion;
    const healthRatio = champion.health / champion.maxHealth;
    for (const passive of this.passivesOfType('shield')) {
      if (!this.isReady(passive) || healthRatio > (passive.healthThreshold ?? 0.3)) continue;
      this.startCooldown(passive);
      const duration = Number(passive.effectData.duration);
      champion.shields.push({
        amount: champion.maxHealth * Number(passive.effectData.percentMaxHealth),
        remainingDuration: duration,
        sourceId: markerEffectId(passive),
        shieldType: 'normal',
      });
      champion.applyEffect(markerEffectId(passive), duration, champion.id);
    }
  }

  /**
   * Whether a spellblade passive is charged (for tests and the HUD).
   */
  isCharged(passiveId: string, context: ServerGameContext): boolean {
    return (this.chargedUntil.get(passiveId) ?? -Infinity) >= context.getGameTime();
  }

  /**
   * The passives of the champion's items with this effect type, each once.
   */
  private passivesOfType(effectType: ItemPassiveData['effectType']): ItemPassiveData[] {
    const found = new Map<string, ItemPassiveData>();
    for (const item of this.champion.items) {
      if (!item) continue;
      for (const passive of getItemCatalogEntry(item.definitionId)?.passives ?? []) {
        if (passive.effectType === effectType) found.set(passive.id, passive);
      }
    }
    return [...found.values()];
  }

  private isReady(passive: ItemPassiveData): boolean {
    return !this.cooldowns.has(passive.id);
  }

  private startCooldown(passive: ItemPassiveData): void {
    if (passive.cooldown > 0) this.cooldowns.set(passive.id, passive.cooldown);
  }
}

/** The marker effect showing a passive's state (data/effects.ts) */
function markerEffectId(passive: ItemPassiveData): string {
  return `item_${passive.id}`;
}

function damageTypeOf(passive: ItemPassiveData): DamageType {
  return (passive.effectData.damageType as DamageType | undefined) ?? 'physical';
}

function isStructure(entity: ServerEntity): boolean {
  return entity.entityType === EntityType.TOWER || entity.entityType === EntityType.INHIBITOR ||
    entity.entityType === EntityType.NEXUS;
}
