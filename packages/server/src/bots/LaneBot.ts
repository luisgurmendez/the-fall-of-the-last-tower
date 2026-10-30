/**
 * LaneBot - A simple practice opponent.
 *
 * Plays one lane with a handful of rules, in priority order:
 * 1. Spend skill points (R when allowed, then Q/W/E, learning each once first)
 * 2. Retreat and recall when low on health
 * 3. Fight the enemy champion when it is close and the trade looks even or better
 * 4. Farm the lowest-health enemy minion in reach
 * 5. Walk to just behind the allied wave front, staying out of enemy tower
 *    range unless allied minions are already tanking it
 *
 * It reads game state directly (no fog-of-war cheating for targeting: it only
 * fights units its side can see).
 */

import {
  Vector,
  EntityType,
  InputType,
  getAbilityDefinition,
  type AbilitySlot,
  type AbilityDefinition,
  type LaneId,
  type Side,
} from '@siege/shared';
import type { BotController, BotInput } from './BotController';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerTower } from '../simulation/ServerTower';
import type { ServerGameContext } from '../game/ServerGameContext';
import { LanePath } from '../navigation/LanePath';

export interface LaneBotConfig {
  playerId: string;
  lane?: LaneId;
  /** Seconds between decisions (default 0.2) */
  decisionInterval?: number;
}

const ABILITY_SLOTS: AbilitySlot[] = ['Q', 'W', 'E', 'R'];
const R_REQUIRED_LEVELS = [6, 11, 16];

/** Health ratio below which the bot goes home */
const RETREAT_HEALTH = 0.3;
/** Health ratio at which the bot leaves base again */
const RETURN_HEALTH = 0.8;
/** How far behind the wave front the bot stands */
const FRONT_OFFSET = 120;
/** Extra margin kept outside enemy tower range */
const TOWER_MARGIN = 80;
/** Same command is re-sent after this long in case it was dropped */
const RESEND_INTERVAL = 1.0;

export class LaneBot implements BotController {
  readonly playerId: string;
  private readonly lane: LaneId;
  private readonly decisionInterval: number;

  private lanePath: LanePath | null = null;
  private timeUntilDecision = 0;
  private time = 0;
  private retreating = false;
  private lastCommandKey = '';
  private lastCommandTime = -Infinity;

  constructor(config: LaneBotConfig) {
    this.playerId = config.playerId;
    this.lane = config.lane ?? 'mid';
    this.decisionInterval = config.decisionInterval ?? 0.2;
  }

  think(champion: ServerChampion, context: ServerGameContext, dt: number): BotInput[] {
    this.time += dt;
    this.timeUntilDecision -= dt;
    if (this.timeUntilDecision > 0 || champion.isDead) return [];
    this.timeUntilDecision = this.decisionInterval;

    const inputs: BotInput[] = [];
    const levelUp = this.chooseLevelUp(champion);
    if (levelUp) inputs.push(levelUp);

    const action = this.chooseAction(champion, context);
    if (action) inputs.push(...action);

    return inputs;
  }

  // ===========================================================================
  // Decisions
  // ===========================================================================

  private chooseAction(champion: ServerChampion, context: ServerGameContext): BotInput[] | null {
    const healthRatio = champion.health / champion.maxHealth;
    const spawn = this.getSpawn(champion.side, context);

    if (healthRatio < RETREAT_HEALTH) this.retreating = true;
    if (this.retreating && healthRatio >= RETURN_HEALTH) this.retreating = false;

    const enemyChampion = this.findEnemyChampion(champion, context);

    if (this.retreating) {
      const threatened = enemyChampion !== null && enemyChampion.position.distanceTo(champion.position) < 900;
      if (champion.position.distanceTo(spawn) < 250) {
        return null; // Home - wait for health to come back
      }
      if (!threatened) {
        if (champion.isRecalling) return null;
        return this.command(`recall`, [{ type: InputType.RECALL }]);
      }
      return this.moveTo(spawn);
    }

    if (champion.isRecalling) return null;

    if (enemyChampion && this.shouldFight(champion, enemyChampion, context)) {
      const cast = this.chooseAbility(champion, enemyChampion);
      if (cast) {
        // Casting is never deduplicated: cooldowns stop repeats
        this.lastCommandKey = '';
        return [cast];
      }
      return this.attack(enemyChampion);
    }

    const minion = this.findFarmTarget(champion, context);
    if (minion) return this.attack(minion);

    return this.moveTo(this.findLanePosition(champion, context));
  }

  private shouldFight(champion: ServerChampion, enemy: ServerChampion, context: ServerGameContext): boolean {
    const distance = champion.position.distanceTo(enemy.position);
    if (distance > champion.getAttackRange() + 250) return false;

    const myRatio = champion.health / champion.maxHealth;
    const enemyRatio = enemy.health / enemy.maxHealth;
    if (myRatio < enemyRatio - 0.15 && enemyRatio > 0.25) return false;

    // Don't chase into the enemy's tower unless it's a kill
    const enemyTower = this.findTowerCovering(enemy.position, enemy.side, context);
    if (enemyTower && enemyRatio > 0.25) return false;

    return true;
  }

  private chooseAbility(champion: ServerChampion, target: ServerChampion): BotInput | null {
    if (champion.ccStatus.isSilenced || champion.ccStatus.isStunned) return null;

    const distance = champion.position.distanceTo(target.position);

    for (const slot of ABILITY_SLOTS) {
      const rank = champion.abilityRanks[slot];
      if (rank <= 0 || champion.abilityCooldowns[slot] > 0) continue;

      const definition = getAbilityDefinition(champion.definition.abilities[slot]);
      if (!definition) continue;

      const cost = definition.manaCost?.[rank - 1] ?? 0;
      if (champion.resource < cost) continue;

      const input = this.buildCast(slot, definition, champion, target, distance);
      if (input) return input;
    }
    return null;
  }

  private buildCast(
    slot: AbilitySlot,
    definition: AbilityDefinition,
    champion: ServerChampion,
    target: ServerChampion,
    distance: number
  ): BotInput | null {
    const range = definition.range ?? 600;

    switch (definition.targetType) {
      case 'skillshot':
      case 'ground_target': {
        if (distance > range) return null;
        // Lead the target a little
        const aim = target.position.added(target.velocity.scaled(0.25));
        return { type: InputType.ABILITY, slot, targetType: 'position', targetX: aim.x, targetY: aim.y };
      }
      case 'target_enemy':
      case 'target_unit':
        if (distance > range) return null;
        return { type: InputType.ABILITY, slot, targetType: 'unit', targetEntityId: target.id };
      case 'target_ally':
        if (champion.health / champion.maxHealth > 0.6) return null;
        return { type: InputType.ABILITY, slot, targetType: 'unit', targetEntityId: champion.id };
      case 'self':
      case 'no_target': {
        const reach = definition.aoeRadius ?? 350;
        if (distance > reach) return null;
        return { type: InputType.ABILITY, slot, targetType: 'none' };
      }
      default:
        // Toggles and auras: leave them alone
        return null;
    }
  }

  private chooseLevelUp(champion: ServerChampion): BotInput | null {
    if (champion.skillPoints <= 0) return null;

    const rRank = champion.abilityRanks.R;
    if (rRank < R_REQUIRED_LEVELS.length && champion.level >= R_REQUIRED_LEVELS[rRank]) {
      return { type: InputType.LEVEL_UP, slot: 'R' };
    }

    const basics: AbilitySlot[] = ['Q', 'W', 'E'];
    const unlearned = basics.find(slot => champion.abilityRanks[slot] === 0);
    if (unlearned) return { type: InputType.LEVEL_UP, slot: unlearned };

    const maxRank = (slot: AbilitySlot) =>
      getAbilityDefinition(champion.definition.abilities[slot])?.maxRank ?? 5;
    const next = basics.find(slot => champion.abilityRanks[slot] < maxRank(slot));
    return next ? { type: InputType.LEVEL_UP, slot: next } : null;
  }

  // ===========================================================================
  // World queries
  // ===========================================================================

  private findEnemyChampion(champion: ServerChampion, context: ServerGameContext): ServerChampion | null {
    let closest: ServerChampion | null = null;
    let closestDistance = Infinity;
    for (const enemy of context.getAllChampions()) {
      if (enemy.side === champion.side || enemy.isDead) continue;
      if (!context.isVisibleTo(enemy, champion.side)) continue;
      const distance = enemy.position.distanceTo(champion.position);
      if (distance < closestDistance) {
        closest = enemy;
        closestDistance = distance;
      }
    }
    return closest;
  }

  private findFarmTarget(champion: ServerChampion, context: ServerGameContext): ServerEntity | null {
    const reach = champion.getAttackRange() + 250;
    let best: ServerEntity | null = null;
    for (const entity of context.getEnemiesInRadius(champion.position, reach, champion.side)) {
      if (entity.entityType !== EntityType.MINION || entity.isDead) continue;
      if (!context.isVisibleTo(entity, champion.side)) continue;
      if (this.findTowerCovering(entity.position, entity.side, context) && !this.alliesTankingTowerAt(entity.position, champion.side, context)) {
        continue;
      }
      if (!best || entity.health < best.health) best = entity;
    }
    return best;
  }

  /**
   * Where to stand: just behind the allied wave front, outside enemy tower
   * range unless allied minions are already under it.
   */
  private findLanePosition(champion: ServerChampion, context: ServerGameContext): Vector {
    const path = this.getLanePath(champion.side, context);

    let front = -Infinity;
    for (const entity of context.getAllEntities()) {
      if (entity.entityType !== EntityType.MINION || entity.isDead || entity.side !== champion.side) continue;
      const projection = path.project(entity.position);
      if (projection.offset < 300) front = Math.max(front, projection.distance);
    }

    if (front === -Infinity) {
      // No wave: wait just in front of the outermost allied tower
      front = 0;
      for (const entity of context.getAllEntities()) {
        if (entity.entityType !== EntityType.TOWER || entity.isDead || entity.side !== champion.side) continue;
        const projection = path.project(entity.position);
        if (projection.offset < 300) front = Math.max(front, projection.distance + 100);
      }
    }

    let distance = front - FRONT_OFFSET;
    let position = path.pointAt(distance);
    while (distance > 0 && this.findTowerCovering(position, 1 - champion.side as Side, context, TOWER_MARGIN) &&
           !this.alliesTankingTowerAt(position, champion.side, context)) {
      distance -= 25;
      position = path.pointAt(distance);
    }
    return position;
  }

  /**
   * A living tower of `towerSide` whose range (plus margin) covers `position`.
   */
  private findTowerCovering(
    position: Vector,
    towerSide: Side,
    context: ServerGameContext,
    margin = 0
  ): ServerEntity | null {
    for (const entity of context.getAllEntities()) {
      if (entity.entityType !== EntityType.TOWER || entity.isDead || entity.side !== towerSide) continue;
      if (entity.position.distanceTo(position) <= (entity as ServerTower).attackRange + margin) return entity;
    }
    return null;
  }

  /**
   * Whether allied minions are inside the range of the enemy tower covering `position`.
   */
  private alliesTankingTowerAt(position: Vector, side: Side, context: ServerGameContext): boolean {
    const tower = this.findTowerCovering(position, 1 - side as Side, context, TOWER_MARGIN);
    if (!tower) return true;
    const range = (tower as ServerTower).attackRange;
    return context.getAllEntities().some(entity =>
      entity.entityType === EntityType.MINION &&
      !entity.isDead &&
      entity.side === side &&
      entity.position.distanceTo(tower.position) <= range
    );
  }

  private getLanePath(side: Side, context: ServerGameContext): LanePath {
    if (!this.lanePath) {
      const laneKey = this.lane.toUpperCase() as 'TOP' | 'MID' | 'BOT';
      const waypoints = context.mapConfig.LANES[laneKey].waypoints.map(w => w.clone());
      // Lanes are defined blue -> red
      this.lanePath = new LanePath(side === 0 ? waypoints : waypoints.reverse());
    }
    return this.lanePath;
  }

  private getSpawn(side: Side, context: ServerGameContext): Vector {
    return side === 0 ? context.mapConfig.CHAMPION_SPAWN.BLUE : context.mapConfig.CHAMPION_SPAWN.RED;
  }

  // ===========================================================================
  // Commands
  // ===========================================================================

  private moveTo(position: Vector): BotInput[] | null {
    // Round so tiny shifts of the target don't count as a new command
    const x = Math.round(position.x / 20) * 20;
    const y = Math.round(position.y / 20) * 20;
    return this.command(`move:${x},${y}`, [{ type: InputType.MOVE, targetX: x, targetY: y }]);
  }

  private attack(target: ServerEntity): BotInput[] | null {
    return this.command(`attack:${target.id}`, [{ type: InputType.TARGET_UNIT, targetEntityId: target.id }]);
  }

  /**
   * Send a command unless it's the same as the last one sent recently.
   */
  private command(key: string, inputs: BotInput[]): BotInput[] | null {
    if (key === this.lastCommandKey && this.time - this.lastCommandTime < RESEND_INTERVAL) {
      return null;
    }
    this.lastCommandKey = key;
    this.lastCommandTime = this.time;
    return inputs;
  }
}
