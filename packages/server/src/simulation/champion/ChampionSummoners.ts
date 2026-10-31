/**
 * ChampionSummoners - The champion's two summoner spells (D and F): their
 * cooldowns, and casting them (definitions in @siege/shared summoners.ts).
 *
 * A cast is refused, keeping the spell ready, while the champion is dead or
 * stunned, when Blink is cast rooted or grounded, and when an aimed spell
 * has no valid target in range. A cast tells clients (SUMMONER_CAST) so they
 * play its effect.
 */

import {
  EntityType,
  GameEventType,
  SUMMONER_SPELLS,
  Vector,
  type SummonerSpellId,
  type SummonerSpellState,
} from '@siege/shared';
import type { ServerChampion } from '../ServerChampion';
import type { ServerEntity } from '../ServerEntity';
import type { ServerGameContext } from '../../game/ServerGameContext';

/** Where a cast is aimed: the cursor, and the unit under it if any */
export interface SummonerTarget {
  x?: number;
  y?: number;
  entityId?: string;
}

/** How far Blink looks for room past a wall when its landing spot is inside one */
const BLINK_STEP = 8;

export class ChampionSummoners {
  private spells: { id: SummonerSpellId; cooldownRemaining: number }[] = [];

  constructor(private readonly champion: ServerChampion) {}

  /** Give the champion its spells (D, F), ready to cast */
  set(ids: readonly SummonerSpellId[]): void {
    this.spells = ids.map(id => ({ id, cooldownRemaining: 0 }));
  }

  update(dt: number): void {
    for (const spell of this.spells) {
      spell.cooldownRemaining = Math.max(0, spell.cooldownRemaining - dt);
    }
  }

  /** For snapshots */
  getState(): SummonerSpellState[] {
    return this.spells.map(spell => ({
      id: spell.id,
      cooldownRemaining: Math.ceil(spell.cooldownRemaining * 10) / 10,
      cooldown: SUMMONER_SPELLS[spell.id].cooldown,
    }));
  }

  /**
   * Cast the spell in a slot. Returns whether it was cast.
   */
  cast(slot: number, target: SummonerTarget, context: ServerGameContext): boolean {
    const spell = this.spells[slot];
    const champion = this.champion;
    if (!spell || spell.cooldownRemaining > 0 || champion.isDead) return false;
    if (champion.ccStatus.isStunned) return false;

    const definition = SUMMONER_SPELLS[spell.id];
    const from = champion.position.clone();
    let event: Record<string, unknown> | null = null;

    switch (spell.id) {
      case 'blink': {
        if (!champion.ccStatus.canUseMobilityAbilities || target.x === undefined || target.y === undefined) return false;
        const to = this.blinkDestination(new Vector(target.x, target.y), definition.range ?? 0, context);
        champion.position.setFrom(to);
        champion.forcedMovement = null;
        event = { toX: to.x, toY: to.y };
        break;
      }
      case 'haste':
        champion.applyEffect('summoner_haste', 8, champion.id);
        event = {};
        break;
      case 'mend': {
        const amount = 80 + 15 * champion.level;
        champion.heal(amount, context, champion.id);
        champion.applyEffect('summoner_mend_speed', 1, champion.id);
        const ally = this.mostWoundedAlly(definition.range ?? 0, context);
        if (ally) {
          ally.heal(amount, context, champion.id);
          ally.applyEffect('summoner_mend_speed', 1, champion.id);
        }
        event = { targetId: ally?.id };
        break;
      }
      case 'aegis':
        champion.shields.push({
          amount: 100 + 20 * champion.level,
          remainingDuration: 2.5,
          sourceId: champion.id,
          shieldType: 'normal',
        });
        event = {};
        break;
      case 'purge':
        champion.cleanse();
        event = {};
        break;
      case 'scorch':
      case 'hinder': {
        const enemy = this.enemyChampionTarget(target, definition.range ?? 0, context);
        if (!enemy) return false;
        if (spell.id === 'scorch') {
          // 1 true damage per stack every half second, for 5 seconds
          enemy.applyEffect('summoner_scorch', 5, champion.id, Math.round((50 + 20 * champion.level) / 10));
        } else {
          for (const effect of ['summoner_hinder_slow', 'summoner_hinder_attack', 'summoner_hinder_power']) {
            enemy.applyEffect(effect, 2.5, champion.id);
          }
        }
        event = { targetId: enemy.id, toX: enemy.position.x, toY: enemy.position.y };
        break;
      }
      case 'reap': {
        const unit = this.monsterTarget(target, definition.range ?? 0, context);
        if (!unit) return false;
        unit.takeDamage(450 + 25 * champion.level, 'true', champion.id, context);
        event = { targetId: unit.id, toX: unit.position.x, toY: unit.position.y };
        break;
      }
    }

    spell.cooldownRemaining = definition.cooldown;
    champion.cancelRecall();
    context.addEvent(GameEventType.SUMMONER_CAST, { entityId: champion.id, spellId: spell.id, x: from.x, y: from.y, ...event });
    return true;
  }

  /**
   * Where Blink lands: toward the target, at most its range away; inside a
   * wall, the farthest open spot short of it along the way (so it crosses a
   * thin wall when there's room past it).
   */
  private blinkDestination(target: Vector, range: number, context: ServerGameContext): Vector {
    const from = this.champion.position;
    const offset = target.subtracted(from);
    const distance = offset.length();
    if (distance === 0) return from.clone();
    const direction = offset.scaled(1 / distance);
    const radius = this.champion.getRadius();
    for (let along = Math.min(distance, range); along > 0; along -= BLINK_STEP) {
      const spot = from.added(direction.scaled(along));
      if (!context.terrain.isBlocked(spot.x, spot.y) && !this.touchesWall(spot, radius, context)) return spot;
    }
    return from.clone();
  }

  private touchesWall(spot: Vector, radius: number, context: ServerGameContext): boolean {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      if (context.terrain.isBlocked(spot.x + Math.cos(angle) * radius, spot.y + Math.sin(angle) * radius)) return true;
    }
    return false;
  }

  /** The allied champion (not the caster) in range missing the most health */
  private mostWoundedAlly(range: number, context: ServerGameContext): ServerChampion | null {
    const champion = this.champion;
    let best: ServerChampion | null = null;
    for (const ally of context.getChampionsBySide(champion.side)) {
      if (ally === champion || ally.isDead) continue;
      if (ally.position.distanceTo(champion.position) > range) continue;
      if (!best || ally.maxHealth - ally.health > best.maxHealth - best.health) best = ally;
    }
    return best;
  }

  /**
   * The enemy champion a spell is cast on: the one under the cursor if it's
   * in range, else the visible one in range closest to the cursor.
   */
  private enemyChampionTarget(target: SummonerTarget, range: number, context: ServerGameContext): ServerChampion | null {
    const champion = this.champion;
    const candidates = context.getAllChampions().filter(enemy =>
      enemy.side !== champion.side && !enemy.isDead && context.isVisibleTo(enemy, champion.side) &&
      enemy.position.distanceTo(champion.position) <= range + enemy.getRadius());
    return pickTarget(candidates, target) as ServerChampion | null;
  }

  /** The jungle monster or minion (of either side) a strike is cast on, chosen like enemyChampionTarget */
  private monsterTarget(target: SummonerTarget, range: number, context: ServerGameContext): ServerEntity | null {
    const champion = this.champion;
    const candidates = context.getEntitiesInRadius(champion.position, range + 40).filter(unit =>
      (unit.entityType === EntityType.JUNGLE_CAMP || (unit.entityType === EntityType.MINION && unit.side !== champion.side)) &&
      !unit.isDead && context.isVisibleTo(unit, champion.side) &&
      unit.position.distanceTo(champion.position) <= range + unit.getRadius());
    return pickTarget(candidates, target);
  }
}

/** The unit under the cursor if it's a candidate, else the candidate closest to the cursor */
function pickTarget<T extends ServerEntity>(candidates: T[], target: SummonerTarget): T | null {
  const chosen = candidates.find(unit => unit.id === target.entityId);
  if (chosen) return chosen;
  if (target.x === undefined || target.y === undefined) return candidates[0] ?? null;
  const cursor = new Vector(target.x, target.y);
  let best: T | null = null;
  for (const unit of candidates) {
    if (!best || unit.position.distanceTo(cursor) < best.position.distanceTo(cursor)) best = unit;
  }
  return best;
}
