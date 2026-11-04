/**
 * ChampionItemActives - Using items: actives (Stillness, Unchain,
 * Shadowstep...) and consumables (potions, flasks, elixirs).
 *
 * A champion uses the item in a slot (InputType.USE_ITEM, keys 1, 2, 3, 6,
 * 7, 8) with the cursor's world position. Actives with the same id share a
 * cooldown, kept on every item that has it as the game time it's ready
 * (EquippedItemState.readyAt, which clients see). Consumables spend a charge;
 * a stack that runs out is gone, a flask refills at the fountain.
 *
 * Crowd control: a stunned champion can only use Unchain and drink; other
 * actives need it able to act, and dashes need it able to move.
 *
 * Each use is told to clients as an ABILITY_CAST `item_<active id>` (for
 * VFX and sounds) at the target point.
 */

import {
  EntityType,
  GameEventType,
  Vector,
  getItemCatalogEntry,
  type ItemActiveData,
  type ItemCatalogEntry,
} from '@siege/shared';
import type { ServerChampion } from '../ServerChampion';
import type { ServerGameContext } from '../../game/ServerGameContext';
import { bonusHealth } from './ChampionItemPassives';

/** Elixir effects: drinking one ends the others */
const ELIXIR_EFFECTS = ['item_ironbark', 'item_stormfury'];

/** A Sanctuary waiting to land */
interface PendingArea {
  at: Vector;
  landsAt: number;
  data: ItemActiveData['effectData'];
}

export class ChampionItemActives {
  private readonly pending: PendingArea[] = [];

  constructor(private readonly champion: ServerChampion) {}

  /**
   * Land pending areas; refill flasks at the fountain.
   */
  update(_dt: number, context: ServerGameContext): void {
    const now = context.getGameTime();
    for (let i = this.pending.length - 1; i >= 0; i--) {
      if (this.pending[i].landsAt > now) continue;
      const [area] = this.pending.splice(i, 1);
      this.landSanctuary(area, context);
    }

    if (this.champion.isDead || !this.atFountain(context)) return;
    for (const item of this.champion.items) {
      const consumable = item && getItemCatalogEntry(item.definitionId)?.consumable;
      if (item && consumable?.refills && (item.charges ?? 0) < consumable.maxCharges) {
        item.charges = consumable.maxCharges;
      }
    }
  }

  /**
   * Use the item in a slot.
   * @param target The cursor's world position (for point actives)
   * @returns Whether it was used
   */
  use(slot: number, target: { x: number; y: number } | undefined, context: ServerGameContext): boolean {
    const champion = this.champion;
    const item = champion.items[slot];
    const definition = item ? getItemCatalogEntry(item.definitionId) : undefined;
    const active = definition?.active;
    if (!item || !definition || !active || champion.isDead) return false;
    if (item.readyAt !== undefined && item.readyAt > context.getGameTime()) return false;
    if (definition.consumable && (item.charges ?? 0) <= 0) return false;
    if (!this.canUse(active)) return false;

    const point = this.aim(active, target);
    if (!this.apply(active, point, context)) return false;

    this.startCooldown(active, context);
    if (definition.consumable) this.spendCharge(slot, definition);
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: champion.id,
      abilityId: `item_${active.id}`,
      targetX: point.x,
      targetY: point.y,
    });
    return true;
  }

  /** Whether crowd control lets it use this active now */
  private canUse(active: ItemActiveData): boolean {
    const cc = this.champion.ccStatus;
    switch (active.effectType) {
      case 'cleanse':
      case 'potion':
      case 'elixir':
        return true;
      case 'dash':
        return cc.canUseMobilityAbilities;
      default:
        return !cc.isStunned;
    }
  }

  /** Where it lands: the cursor, clamped to the active's range (or the champion) */
  private aim(active: ItemActiveData, target: { x: number; y: number } | undefined): Vector {
    const from = this.champion.position;
    if (active.targeting !== 'point' || !target) return from.clone();
    const to = new Vector(target.x, target.y);
    const range = active.range ?? 0;
    const distance = from.distanceTo(to);
    if (distance <= range || distance === 0) return to;
    return from.clone().add(to.subtracted(from).normalized().scalar(range));
  }

  /** Do what the active does; false if it couldn't */
  private apply(active: ItemActiveData, point: Vector, context: ServerGameContext): boolean {
    const champion = this.champion;
    const data = active.effectData;
    switch (active.effectType) {
      case 'potion':
        for (const effect of String(data.effects).split(',')) {
          champion.applyEffect(effect, Number(data.duration), champion.id);
        }
        return true;

      case 'elixir':
        for (const effect of ELIXIR_EFFECTS) champion.removeEffect(effect);
        champion.applyEffect(String(data.effect), Number(data.duration), champion.id);
        return true;

      case 'cleanse':
        champion.cleanse();
        if (data.speed) champion.applyEffect(String(data.speed), Number(data.duration), champion.id);
        return true;

      case 'stasis':
        champion.stop();
        champion.cancelRecall();
        champion.applyEffect('item_stasis', Number(data.duration), champion.id);
        return true;

      case 'dash': {
        const to = context.terrain.landingSpot(champion.position, point, Number(data.range), champion.getRadius());
        champion.position.setFrom(to);
        champion.forcedMovement = null;
        context.pathFollower.clear(champion.id);
        point.setFrom(to);
        if (data.damage) {
          const damage = Number(data.damage) + Number(data.apRatio ?? 0) * champion.getStats().abilityPower;
          for (const enemy of context.getEnemiesInRadius(to, Number(data.radius), champion.side)) {
            if (!isUnit(enemy) || enemy.isDead) continue;
            champion.withDamageKind('item', () => enemy.takeDamage(damage, 'magic', champion.id, context));
          }
        }
        return true;
      }

      case 'shield_allies': {
        const amount = Number(data.base) + Number(data.bonusHealthRatio) * bonusHealth(champion);
        for (const ally of context.getAllChampions()) {
          if (ally.isDead || ally.side !== champion.side) continue;
          if (ally.position.distanceTo(champion.position) > Number(data.radius)) continue;
          ally.grantShield(amount, Number(data.duration), `item_${active.id}`, context, champion);
        }
        return true;
      }

      case 'frost_nova':
        for (const enemy of context.getEnemiesInRadius(champion.position, Number(data.radius), champion.side)) {
          if (enemy.isDead || (enemy.entityType !== EntityType.CHAMPION && enemy.entityType !== EntityType.MINION)) continue;
          (enemy as ServerChampion).applyEffect(String(data.effect), Number(data.duration), champion.id);
        }
        return true;

      case 'heal_area':
        this.pending.push({ at: point.clone(), landsAt: context.getGameTime() + Number(data.delay), data });
        return true;
    }
  }

  /** Sanctuary lands: heal allied champions there, hurt enemy champions */
  private landSanctuary(area: PendingArea, context: ServerGameContext): void {
    const champion = this.champion;
    const { data } = area;
    const radius = Number(data.radius);
    for (const other of context.getAllChampions()) {
      if (other.isDead || other.position.distanceTo(area.at) > radius) continue;
      if (other.side === champion.side) {
        const missing = other.maxHealth - other.health;
        other.heal(Number(data.heal) + Number(data.missingHealthRatio) * missing, context, champion.id);
      } else {
        champion.withDamageKind('item', () => other.takeDamage(Number(data.damage), 'true', champion.id, context));
      }
    }
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: champion.id,
      abilityId: 'item_sanctuary_land',
      targetX: area.at.x,
      targetY: area.at.y,
    });
  }

  /** Every item's active ready (a practice tool) */
  resetCooldowns(): void {
    for (const item of this.champion.items) {
      if (item && item.readyAt !== undefined) item.readyAt = 0;
    }
  }

  /** Every item with this active waits out its cooldown */
  private startCooldown(active: ItemActiveData, context: ServerGameContext): void {
    const readyAt = context.getGameTime() + active.cooldown;
    for (const item of this.champion.items) {
      if (item && getItemCatalogEntry(item.definitionId)?.active?.id === active.id) item.readyAt = readyAt;
    }
  }

  /** Spend a charge; a used-up stack is gone (a refilling flask stays) */
  private spendCharge(slot: number, definition: ItemCatalogEntry): void {
    const item = this.champion.items[slot];
    if (!item) return;
    item.charges = (item.charges ?? 0) - 1;
    if (item.charges <= 0 && !definition.consumable?.refills) {
      this.champion.items[slot] = null;
      this.champion.invalidateStats();
    }
  }

  private atFountain(context: ServerGameContext): boolean {
    const champion = this.champion;
    const fountain = champion.side === 0 ? context.mapConfig.CHAMPION_SPAWN.BLUE : context.mapConfig.CHAMPION_SPAWN.RED;
    return champion.position.distanceTo(fountain) <= context.mapConfig.FOUNTAIN.RADIUS;
  }
}

/** Units that fight: champions, minions and monsters */
function isUnit(entity: { entityType: EntityType }): boolean {
  return entity.entityType === EntityType.CHAMPION || entity.entityType === EntityType.MINION ||
    entity.entityType === EntityType.JUNGLE_CAMP;
}
