/**
 * LaneBot - A simple practice opponent.
 *
 * Plays one lane with a handful of rules, in priority order:
 * 1. Spend skill points (R when allowed, then Q/W/E, learning each once first)
 * 2. Retreat and recall when low on health (using defensive abilities if
 *    the enemy is close); shop at base
 * 3. Fight the enemy champion when it is close and the trade looks even or better
 * 4. Last-hit minions; harass the enemy champion in range when no minion is
 *    about to die; otherwise push the lowest-health minion
 * 5. Walk to just behind the allied wave front, staying out of enemy tower
 *    range unless allied minions are already tanking it
 *
 * Champion abilities are bespoke, so ABILITY_ROLES says how a bot should use
 * the ones the generic rules would misuse (stealth, invulnerability, dashes).
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
import { getServerItemById } from '../data/items';

export interface LaneBotConfig {
  playerId: string;
  lane?: LaneId;
  /** Seconds between decisions (default 0.2) */
  decisionInterval?: number;
}

const ABILITY_SLOTS: AbilitySlot[] = ['Q', 'W', 'E', 'R'];

/**
 * How bots use abilities the generic targeting rules can't judge:
 * - offense: in a fight (self buffs/transforms, areas centered on something else)
 * - defense: while retreating with the enemy close (stealth, invulnerability)
 * - engage: to close the gap on a weakened enemy (dashes to a point)
 */
const ABILITY_ROLES: Partial<Record<string, 'offense' | 'defense' | 'engage'>> = {
  vex_shroud: 'defense',
  vex_dash: 'engage',
  vex_ninja_mode: 'offense',
  vile_veil_of_darkness: 'defense',
  vile_restoration_of_vilix: 'offense',
  lume_w: 'offense',
  lume_e: 'defense',
  lume_r: 'offense',
};

/** What bots buy, in order, by build */
const BUILDS = {
  attack: ['long_sword', 'boots_of_speed', 'bf_sword', 'rubys_crystal', 'bloodthirster', 'giants_belt'],
  ability: ['amplifying_tome', 'boots_of_speed', 'needlessly_large_rod', 'rubys_crystal', 'rabadons_deathcap', 'giants_belt'],
};
const R_REQUIRED_LEVELS = [6, 11, 16];

/** Health ratio below which the bot goes home */
const RETREAT_HEALTH = 0.3;
/** Health ratio at which the bot leaves base again */
const RETURN_HEALTH = 0.8;
/** How far behind the wave front the bot stands */
const FRONT_OFFSET = 120;
/** Extra margin kept outside enemy tower range */
const TOWER_MARGIN = 80;
/** Attack a minion when its health is under this many of our hits (minions hit it during our windup) */
const LAST_HIT_LEAD = 1.3;
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
  private farmTargetId: string | null = null;
  /** What the bot decided last (for debugging and the simulation sandbox) */
  lastDecision = 'idle';

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

    // At base: shop first
    if (champion.position.distanceTo(spawn) < 300) {
      const purchase = this.chooseItemToBuy(champion);
      if (purchase) return [purchase];
    }

    if (this.retreating) {
      const threatened = enemyChampion !== null && enemyChampion.position.distanceTo(champion.position) < 900;
      if (champion.position.distanceTo(spawn) < 250) {
        this.lastDecision = 'heal at base';
        return null; // Home - wait for health to come back
      }
      if (!threatened) {
        this.lastDecision = 'recall';
        if (champion.isRecalling) return null;
        return this.command(`recall`, [{ type: InputType.RECALL }]);
      }
      this.lastDecision = 'retreat';
      const escape = enemyChampion && enemyChampion.position.distanceTo(champion.position) < 500
        ? this.chooseAbility(champion, enemyChampion, 'defense')
        : null;
      if (escape) return this.cast(escape);
      return this.moveTo(spawn);
    }

    if (champion.isRecalling) return null;

    if (enemyChampion && this.shouldFight(champion, enemyChampion, context)) {
      this.lastDecision = 'fight';
      const cast = this.chooseAbility(champion, enemyChampion, 'offense');
      if (cast) return this.cast(cast);
      return this.attack(enemyChampion);
    }

    const lastHit = this.findLastHit(champion, context);
    if (lastHit) {
      this.lastDecision = 'last hit';
      return this.attack(lastHit);
    }

    // Nothing about to die: poke the enemy champion if it's already in range
    if (enemyChampion && this.canHarass(champion, enemyChampion, context)) {
      this.lastDecision = 'harass';
      return this.attack(enemyChampion);
    }

    const minion = this.findFarmTarget(champion, context);
    if (minion) {
      this.lastDecision = 'farm';
      return this.attack(minion);
    }

    this.lastDecision = 'walk to lane';
    return this.moveTo(this.findLanePosition(champion, context));
  }

  private shouldFight(champion: ServerChampion, enemy: ServerChampion, context: ServerGameContext): boolean {
    const myRatio = champion.health / champion.maxHealth;
    const enemyRatio = enemy.health / enemy.maxHealth;
    const beingHit = context.getRecentChampionVictim(enemy.id, 2)?.id === champion.id;

    // Close enough to fight: our reach, or theirs when they're hitting us from range
    const distance = champion.position.distanceTo(enemy.position);
    const reach = beingHit
      ? Math.max(champion.getAttackRange(), enemy.getAttackRange()) + 200
      : champion.getAttackRange() + 250;
    if (distance > reach) return false;

    // Don't chase into the enemy's tower unless it's a kill
    const enemyTower = this.findTowerCovering(enemy.position, enemy.side, context);
    if (enemyTower && enemyRatio > 0.25) return false;

    // Farm first: commit only to a weak enemy, a clear lead, or to hit back
    const enemyWeak = enemyRatio < 0.4 && myRatio > enemyRatio;
    const clearLead = myRatio > enemyRatio + 0.25;
    const hitBack = beingHit && myRatio >= enemyRatio - 0.1;
    return enemyWeak || clearLead || hitBack;
  }

  /**
   * An ability to use now: in a fight ('offense', which includes engages on a
   * weakened target) or while escaping ('defense').
   */
  private chooseAbility(champion: ServerChampion, target: ServerChampion, mode: 'offense' | 'defense'): BotInput | null {
    if (champion.ccStatus.isSilenced || champion.ccStatus.isStunned) return null;

    const distance = champion.position.distanceTo(target.position);
    const targetLow = target.health / target.maxHealth < 0.4;

    for (const slot of ABILITY_SLOTS) {
      const rank = champion.abilityRanks[slot];
      if (rank <= 0 || champion.abilityStates[slot].cooldownRemaining > 0) continue;

      const definition = getAbilityDefinition(champion.definition.abilities[slot]);
      if (!definition) continue;

      const cost = definition.manaCost?.[rank - 1] ?? 0;
      if (champion.resource < cost) continue;

      const role = ABILITY_ROLES[definition.id];
      if (mode === 'defense') {
        if (role !== 'defense') continue;
        const escapeTo = definition.targetType === 'ground_target'
          ? champion.position.added(Vector.direction(target.position, champion.position).scaled(definition.range ?? 300))
          : null;
        return escapeTo
          ? { type: InputType.ABILITY, slot, targetType: 'position', targetX: escapeTo.x, targetY: escapeTo.y }
          : { type: InputType.ABILITY, slot, targetType: 'none' };
      }

      if (role === 'defense') continue;
      if (role === 'engage') {
        if (!targetLow || distance <= champion.getAttackRange() || distance > (definition.range ?? 400) + 100) continue;
        return { type: InputType.ABILITY, slot, targetType: 'position', targetX: target.position.x, targetY: target.position.y };
      }
      if (role === 'offense') {
        if (distance > champion.getAttackRange() + 150) continue;
        return { type: InputType.ABILITY, slot, targetType: 'none' };
      }

      const input = this.buildCast(slot, definition, champion, target, distance);
      if (input) return input;
    }
    return null;
  }

  /**
   * Buy the next item of the build that the bot can afford.
   */
  private chooseItemToBuy(champion: ServerChampion): BotInput | null {
    if (champion.items.every(item => item !== null)) return null;
    const build = champion.definition.class === 'mage' ? BUILDS.ability : BUILDS.attack;
    const owned = new Set(champion.items.filter(item => item !== null).map(item => item!.definitionId));
    const itemId = build.find(id => !owned.has(id) && (getServerItemById(id)?.cost ?? Infinity) <= champion.gold);
    if (!itemId) return null;
    this.lastDecision = `buy ${itemId}`;
    return { type: InputType.BUY_ITEM, itemId };
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

  /**
   * An enemy minion one basic attack would kill (the lowest such), if any.
   */
  private findLastHit(champion: ServerChampion, context: ServerGameContext): ServerEntity | null {
    const damage = champion.getStats().attackDamage;
    let best: ServerEntity | null = null;
    for (const entity of this.reachableMinions(champion, context)) {
      const armor = (entity as ServerEntity & { stats?: { armor?: number } }).stats?.armor ?? 0;
      const hitDamage = damage * 100 / (100 + armor);
      // Start a little early: minions keep hitting it during the attack windup
      if (entity.health <= hitDamage * LAST_HIT_LEAD && (!best || entity.health < best.health)) best = entity;
    }
    return best;
  }

  /**
   * Whether to auto-attack the enemy champion without committing to a fight:
   * it's in range and outside its tower.
   */
  private canHarass(champion: ServerChampion, enemy: ServerChampion, context: ServerGameContext): boolean {
    if (champion.position.distanceTo(enemy.position) > champion.getAttackRange() + 30) return false;
    // Only poke from ahead: an even poke war just sends both bots home
    if (champion.health / champion.maxHealth < enemy.health / enemy.maxHealth + 0.1) return false;
    return !this.findTowerCovering(champion.position, enemy.side, context);
  }

  private findFarmTarget(champion: ServerChampion, context: ServerGameContext): ServerEntity | null {
    const reachable = this.reachableMinions(champion, context);

    // Keep hitting the same minion: switching restarts the attack windup
    const current = reachable.find(entity => entity.id === this.farmTargetId);
    if (current) return current;

    let best: ServerEntity | null = null;
    for (const entity of reachable) {
      if (!best || entity.health < best.health) best = entity;
    }
    this.farmTargetId = best?.id ?? null;
    return best;
  }

  /**
   * Visible enemy minions near enough to attack and not under an enemy tower
   * (unless allied minions are already tanking it).
   */
  private reachableMinions(champion: ServerChampion, context: ServerGameContext): ServerEntity[] {
    const reach = champion.getAttackRange() + 250;
    return context.getEnemiesInRadius(champion.position, reach, champion.side).filter(entity =>
      entity.entityType === EntityType.MINION &&
      !entity.isDead &&
      context.isVisibleTo(entity, champion.side) &&
      (!this.findTowerCovering(entity.position, entity.side, context) || this.alliesTankingTowerAt(entity.position, champion.side, context))
    );
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
   * Cast right away. Casts are never deduplicated: cooldowns stop repeats.
   */
  private cast(input: BotInput): BotInput[] {
    this.lastCommandKey = '';
    return [input];
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
