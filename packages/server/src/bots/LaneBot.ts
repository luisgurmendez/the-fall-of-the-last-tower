/**
 * LaneBot - A simple practice opponent.
 *
 * Plays one lane with a handful of rules, in priority order:
 * 1. Spend skill points (R when allowed, then Q/W/E, learning each once first)
 * 2. Retreat and recall when low on health (using defensive abilities if
 *    the enemy is close; walking off until out of combat and out of enemy
 *    tower range, since damage cancels a recall); shop at base. Also recall
 *    to shop when it has enough gold for its next item and no enemy
 *    champion is near
 * 3. Leave enemy tower range unless allied minions are tanking the tower
 *    (enough of them, for long enough to walk back out)
 * 4. Fight the enemy champion when it is close and the trade looks even or better
 * 5. Last-hit minions: predict each minion's health when our hit would land
 *    (allied minions and towers keep hitting it), hit when that kills it,
 *    and hold the attack when one is about to be ready
 * 6. Harass the enemy champion in range, only from ahead
 * 7. Siege: hit an enemy tower its minions are tanking (or the nexus) once
 *    the structure order lets it take damage
 * 8. Push: a minion nothing else is hitting, else the healthiest one
 *    (hitting a weak one hands it to allied minions)
 * 9. Walk to just behind the allied wave front, staying out of enemy tower
 *    range unless allied minions are tanking it
 *
 * Champion abilities are bespoke, so ABILITY_ROLES says how a bot should use
 * the ones the generic rules would misuse (stealth, invulnerability, dashes).
 * Summoner spells come first when their moment arrives (summonerTactics.ts:
 * Mend when hurt in a fight, Blink to escape or to finish, ...).
 *
 * It reads game state directly (no fog-of-war cheating for targeting: it only
 * fights units its side can see).
 */

import {
  Vector,
  EntityType,
  InputType,
  getAbilityDefinition,
  calculateAbilityValue,
  planItemPurchase,
  isItemPartOf,
  type AbilitySlot,
  type AbilityDefinition,
  type ChampionClass,
  type LaneId,
  type Side,
} from '@siege/shared';
import type { BotController, BotInput } from './BotController';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerTower } from '../simulation/ServerTower';
import type { ServerGameContext } from '../game/ServerGameContext';
import { LanePath } from '../navigation/LanePath';
import { isStructureVulnerable } from '../systems/StructureRules';
import { chooseSummonerSpell } from './summonerTactics';
import { getScalingStats } from '../abilities/generic/AbilityHelpers';

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
 * - execute: to finish an enemy under half health (Urûk's Fatal Strike)
 * - kill: only when the hit would kill (Hop-To-Eat's kick, which otherwise
 *   sends the enemy out of reach)
 */
const ABILITY_ROLES: Partial<Record<string, 'offense' | 'defense' | 'engage' | 'execute' | 'kill'>> = {
  vex_shroud: 'defense',
  vex_dash: 'engage',
  vex_ninja_mode: 'offense',
  vile_veil_of_darkness: 'defense',
  vile_restoration_of_vilix: 'offense',
  lume_w: 'offense',
  lume_e: 'offense',
  warrior_shield: 'defense',
  warrior_charge: 'engage',
  magnus_shield: 'defense',
  elara_barrier: 'defense',
  gorath_fortify: 'defense',
  uruk_w: 'offense',
  uruk_e: 'offense',
  uruk_r: 'execute',
  oitboil_w: 'defense',
  oitboil_e: 'engage',
  elora_q: 'offense',
  elora_e: 'defense',
  fenris_e: 'engage',
  fenris_r: 'offense',
  calamitus_e: 'defense',
  protobot_w: 'defense',
  hop_w: 'offense',
  hop_e: 'engage',
  hop_r: 'kill',
};

/** Health ratio under which a target is worth an execute */
const EXECUTE_HEALTH = 0.5;

/** What bots buy, in order */
const ATTACK_BUILD = ['notched_blade', 'wanderers_boots', 'siege_cleaver', 'heartstone', 'crimson_fang', 'bulwark_belt', 'ironheart_talisman'];
const ABILITY_BUILD = ['ember_shard', 'wanderers_boots', 'cinder_rod', 'heartstone', 'starfall_diadem', 'bulwark_belt', 'spiked_bastion'];
/** By champion class: supports add health, tanks go for defenses */
const BUILDS: Record<ChampionClass, string[]> = {
  mage: ABILITY_BUILD,
  support: ['ember_shard', 'wanderers_boots', 'heartstone', 'cinder_rod', 'ironheart_talisman', 'starfall_diadem', 'bulwark_belt'],
  tank: ['heartstone', 'wanderers_boots', 'iron_plate', 'bulwark_belt', 'spiked_bastion', 'spellward_cloak', 'ironheart_talisman'],
  warrior: ATTACK_BUILD,
  assassin: ATTACK_BUILD,
  marksman: ATTACK_BUILD,
};
/** Champions their class doesn't describe: Zhak'rul fights up close on ability power */
const CHAMPION_BUILDS: Partial<Record<string, string[]>> = {
  zhakrul: ['ember_shard', 'wanderers_boots', 'cinder_rod', 'heartstone', 'bulwark_belt', 'starfall_diadem', 'spiked_bastion'],
};
const R_REQUIRED_LEVELS = [6, 11, 16];

/** Health ratio under which an ally gets the bot's heals and shields */
const WOUNDED = 0.6;
/** Health ratio below which the bot goes home */
const RETREAT_HEALTH = 0.3;
/** Health ratio at which the bot leaves base again */
const RETURN_HEALTH = 0.8;
/** Gold worth a trip home to shop (when its next item is affordable) */
const SHOPPING_GOLD = 1100;
/** An enemy champion this close keeps the bot from recalling */
const RECALL_SAFE_DISTANCE = 600;
/** How far behind the wave front the bot stands */
const FRONT_OFFSET = 80;
/** Extra margin kept outside enemy tower range */
const TOWER_MARGIN = 60;
/** Collision radius assumed for the unit at a position (the largest champion's) */
const UNIT_RADIUS = 25;
/** How far past its attack range the bot looks for a structure to hit */
const SIEGE_REACH = 200;
/** Allied minions under an enemy tower before the bot follows them in */
const MIN_TOWER_TANKS = 2;
/** Seconds of tower shots on minions to spare after walking back out of its range */
const TOWER_EXIT_MARGIN = 1.5;
/** How much of the enemy minions' damage on our minions under a tower to count (they spread it, and die too) */
const ENEMY_MINION_DPS_WEIGHT = 0.5;
/** How far the bot looks for allied units hitting a minion */
const MINION_DAMAGE_RADIUS = 400;
/** Same command is re-sent after this long in case it was dropped */
const RESEND_INTERVAL = 1.0;

/** A minion's outlook if we attack it (see LaneBot.predictMinions) */
interface MinionForecast {
  minion: ServerEntity;
  /** Our basic attack's damage to it, after armor */
  hitDamage: number;
  /** Damage per second allied units are dealing it, after armor */
  incomingDps: number;
  /** Its health when our attack would land */
  healthAtHit: number;
}

function armorOf(entity: ServerEntity): number {
  return (entity as ServerEntity & { stats?: { armor?: number } }).stats?.armor ?? 0;
}

/** Higher is a better minion to push with (see LaneBot.findFarmTarget) */
function farmPriority(forecast: MinionForecast): number {
  return forecast.incomingDps === 0 ? 1e6 - forecast.minion.health : forecast.minion.health;
}

export class LaneBot implements BotController {
  readonly playerId: string;
  private readonly lane: LaneId;
  private readonly decisionInterval: number;

  private lanePath: LanePath | null = null;
  private timeUntilDecision = 0;
  private time = 0;
  private retreating = false;
  /** Heading home to spend gold (see SHOPPING_GOLD) */
  private shopping = false;
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
    const threatened = enemyChampion !== null &&
      enemyChampion.position.distanceTo(champion.position) < RECALL_SAFE_DISTANCE;
    const enemySide = 1 - champion.side as Side;
    const underEnemyTower = this.findTowerCovering(champion.position, enemySide, context, TOWER_MARGIN) !== null;

    // A summoner spell whose moment has come (a heal when hurt, a blink to escape...)
    const fighting = enemyChampion !== null && !this.retreating && this.shouldFight(champion, enemyChampion, context);
    const summoner = chooseSummonerSpell(champion, { retreating: this.retreating, fighting, enemy: enemyChampion, spawn }, context);
    if (summoner) {
      this.lastDecision = 'summoner spell';
      return this.cast(summoner);
    }

    // At base: shop first, until there's nothing left to buy
    if (champion.position.distanceTo(spawn) < 300) {
      const purchase = this.chooseItemToBuy(champion);
      if (purchase) return [purchase];
      this.shopping = false;
    }

    // Enough gold for the next item: go home to spend it
    if (!this.shopping && champion.gold >= SHOPPING_GOLD && this.chooseItemToBuy(champion)) {
      this.shopping = true;
    }

    if (this.retreating) {
      if (champion.position.distanceTo(spawn) < 250) {
        this.lastDecision = 'heal at base';
        return null; // Home - wait for health to come back
      }
      // Damage cancels a recall: walk off until out of combat and tower range first
      if (!threatened && !champion.inCombat && !underEnemyTower) {
        this.lastDecision = 'recall';
        if (champion.isRecalling) return null;
        return this.command(`recall`, [{ type: InputType.RECALL }]);
      }
      this.lastDecision = 'retreat';
      const escape = enemyChampion && enemyChampion.position.distanceTo(champion.position) < 500
        ? this.chooseAbility(champion, enemyChampion, 'defense', context)
        : null;
      if (escape) return this.cast(escape);
      return this.moveTo(spawn);
    }

    if (champion.isRecalling) return null;

    // Shopping trip: recall when it's safe; with an enemy near, keep playing
    if (this.shopping && !threatened && !champion.inCombat && !underEnemyTower) {
      this.lastDecision = 'recall to shop';
      return this.command(`recall`, [{ type: InputType.RECALL }]);
    }

    // Under an enemy tower with no allied minions for it to shoot: get out
    if (this.findTowerCovering(champion.position, enemySide, context) &&
        !this.alliesTankingTowerAt(champion.position, champion, context)) {
      this.lastDecision = 'leave tower range';
      return this.moveTo(this.findLanePosition(champion, context));
    }

    if (enemyChampion && this.shouldFight(champion, enemyChampion, context)) {
      this.lastDecision = 'fight';
      const cast = this.chooseAbility(champion, enemyChampion, 'offense', context);
      if (cast) return this.cast(cast);
      return this.attack(enemyChampion);
    }

    return this.chooseLaneAction(champion, context, enemyChampion);
  }

  /**
   * What to do in lane when there's no fight to take: last-hit, harass,
   * siege, push, or walk up behind the wave. A bot with another job (the
   * jungle) overrides it.
   */
  protected chooseLaneAction(champion: ServerChampion, context: ServerGameContext, enemyChampion: ServerChampion | null): BotInput[] | null {
    const minions = this.predictMinions(champion, context);
    const lastHit = this.findLastHit(minions);
    if (lastHit) {
      this.lastDecision = 'last hit';
      return this.attack(lastHit.minion);
    }

    // A last hit is coming up: keep the attack ready for it
    const upcoming = this.findUpcomingLastHit(champion, minions);
    if (upcoming) {
      this.lastDecision = 'wait for last hit';
      return this.holdFor(champion, upcoming.minion);
    }

    // Nothing about to die: poke the enemy champion if it's already in range
    if (enemyChampion && this.canHarass(champion, enemyChampion, context)) {
      this.lastDecision = 'harass';
      return this.attack(enemyChampion);
    }

    // Nothing to last-hit: hit the structure the wave is tanking
    const structure = this.findSiegeTarget(champion, context);
    if (structure) {
      this.lastDecision = 'siege';
      return this.attack(structure);
    }

    const minion = this.findFarmTarget(minions);
    if (minion) {
      this.lastDecision = 'farm';
      return this.attack(minion);
    }

    this.lastDecision = 'walk to lane';
    return this.moveTo(this.findLanePosition(champion, context));
  }

  protected shouldFight(champion: ServerChampion, enemy: ServerChampion, context: ServerGameContext): boolean {
    const myRatio = champion.health / champion.maxHealth;
    const enemyRatio = enemy.health / enemy.maxHealth;
    const beingHit = context.getRecentChampionVictim(enemy.id, 2)?.id === champion.id;

    // Close enough to fight: our reach, or theirs when they're hitting us from range
    const distance = champion.position.distanceTo(enemy.position);
    const reach = beingHit
      ? Math.max(champion.getAttackRange(), enemy.getAttackRange()) + 120
      : champion.getAttackRange() + 150;
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
  protected chooseAbility(champion: ServerChampion, target: ServerEntity, mode: 'offense' | 'defense', context: ServerGameContext): BotInput | null {
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
        if (escapeTo) return { type: InputType.ABILITY, slot, targetType: 'position', targetX: escapeTo.x, targetY: escapeTo.y };
        // A shield cast on an ally goes on the bot itself
        return definition.targetType === 'target_ally'
          ? { type: InputType.ABILITY, slot, targetType: 'unit', targetEntityId: champion.id }
          : { type: InputType.ABILITY, slot, targetType: 'none' };
      }

      if (role === 'defense') continue;
      if (role === 'engage') {
        if (!targetLow || distance <= champion.getAttackRange() || distance > (definition.range ?? 400) + 100) continue;
        return { type: InputType.ABILITY, slot, targetType: 'position', targetX: target.position.x, targetY: target.position.y };
      }
      if (role === 'offense') {
        if (distance > champion.getAttackRange() + 100) continue;
        return { type: InputType.ABILITY, slot, targetType: 'none' };
      }
      if (role === 'execute') {
        if (target.health / target.maxHealth > EXECUTE_HEALTH || distance > (definition.range ?? 300)) continue;
        return { type: InputType.ABILITY, slot, targetType: 'unit', targetEntityId: target.id };
      }
      if (role === 'kill') {
        const reach = (definition.range ?? 300) + champion.getRadius() + target.getRadius();
        if (distance > reach || !this.wouldKill(champion, definition, rank, target)) continue;
        return { type: InputType.ABILITY, slot, targetType: 'unit', targetEntityId: target.id };
      }

      const input = this.buildCast(slot, definition, champion, target, distance, context);
      if (input) return input;
    }
    return null;
  }

  /** Whether the ability's damage, after the target's armor or magic resist, would kill it */
  private wouldKill(champion: ServerChampion, definition: AbilityDefinition, rank: number, target: ServerEntity): boolean {
    if (!definition.damage || target.entityType !== EntityType.CHAMPION) return false;
    const damage = calculateAbilityValue(definition.damage.scaling, rank, getScalingStats(champion, champion.getStats()));
    const stats = (target as ServerChampion).getStats();
    const resist = definition.damage.type === 'physical' ? stats.armor : definition.damage.type === 'magic' ? stats.magicResist : 0;
    return damage * (100 / (100 + Math.max(0, resist))) >= target.health;
  }

  /**
   * Buy the next item of the build that the bot can afford. An item it owns,
   * or already built into one it owns, is done.
   */
  private chooseItemToBuy(champion: ServerChampion): BotInput | null {
    const inventory = champion.items.map(item => item?.definitionId);
    const build = CHAMPION_BUILDS[champion.definition.id] ?? BUILDS[champion.definition.class] ?? ATTACK_BUILD;
    const done = (id: string) => inventory.some(owned => owned && (owned === id || isItemPartOf(id, owned)));
    const itemId = build.find(id => {
      if (done(id)) return false;
      const plan = planItemPurchase(id, inventory);
      // Needs a free slot, unless it uses up a part
      const fits = inventory.some(owned => !owned) || (plan?.consumedSlots.length ?? 0) > 0;
      return plan !== null && fits && plan.price <= champion.gold;
    });
    if (!itemId) return null;
    this.lastDecision = `buy ${itemId}`;
    return { type: InputType.BUY_ITEM, itemId };
  }

  protected buildCast(
    slot: AbilitySlot,
    definition: AbilityDefinition,
    champion: ServerChampion,
    target: ServerEntity,
    distance: number,
    context: ServerGameContext,
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
      case 'target_ally': {
        // A heal or shield: on the most hurt ally in reach (the bot too)
        const ally = this.mostWoundedAlly(champion, range, context, definition.excludesSelf);
        return ally ? { type: InputType.ABILITY, slot, targetType: 'unit', targetEntityId: ally.id } : null;
      }
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

  /** The allied champion (the bot included) under WOUNDED health within `range`, the most hurt first */
  protected mostWoundedAlly(champion: ServerChampion, range: number, context: ServerGameContext, excludeSelf = false): ServerChampion | null {
    let best: ServerChampion | null = null;
    for (const ally of context.getChampionsBySide(champion.side)) {
      if (ally.isDead || ally.position.distanceTo(champion.position) > range + ally.getRadius()) continue;
      if (excludeSelf && ally.id === champion.id) continue;
      const ratio = ally.health / ally.maxHealth;
      if (ratio < WOUNDED && (!best || ratio < best.health / best.maxHealth)) best = ally;
    }
    return best;
  }

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
   * For each reachable minion: our hit's damage, the damage per second
   * allied minions and towers are dealing it, and its health when a basic
   * attack started now (or as soon as one is ready) would land.
   */
  private predictMinions(champion: ServerChampion, context: ServerGameContext): MinionForecast[] {
    const stats = champion.getStats();
    const ranged = champion.definition.attackType === 'ranged';
    const projectileSpeed = champion.definition.basicAttackProjectileSpeed ?? 800;
    const attackRange = champion.getAttackRange();
    const damageDelay = champion.basicAttacks.getDamageDelay();
    const cooldown = champion.basicAttacks.cooldownRemaining;

    return this.reachableMinions(champion, context).map(minion => {
      const armorFactor = 100 / (100 + armorOf(minion));
      const incomingDps = this.incomingDamagePerSecond(minion, context) * armorFactor;

      const gap = Math.max(0, champion.position.distanceTo(minion.position) - champion.getRadius() - minion.getRadius());
      const walkTime = Math.max(0, gap - attackRange) / Math.max(1, stats.movementSpeed);
      const travelTime = ranged ? Math.min(gap, attackRange) / projectileSpeed : 0;
      const timeToHit = Math.max(cooldown, walkTime) + damageDelay + travelTime;

      return {
        minion,
        hitDamage: stats.attackDamage * armorFactor,
        incomingDps,
        healthAtHit: minion.health - incomingDps * timeToHit,
      };
    });
  }

  /**
   * Damage per second (before armor) the minions and towers attacking a unit
   * are dealing it (for an enemy minion: ours).
   */
  private incomingDamagePerSecond(target: ServerEntity, context: ServerGameContext): number {
    let dps = 0;
    for (const ally of context.getEnemiesInRadius(target.position, MINION_DAMAGE_RADIUS, target.side)) {
      if (ally.isDead) continue;
      if (ally.entityType !== EntityType.MINION && ally.entityType !== EntityType.TOWER) continue;
      const attacker = ally as ServerEntity & {
        getAttackTargetId(): string | null;
        stats: { attackDamage: number; attackCooldown: number };
      };
      if (attacker.getAttackTargetId() !== target.id) continue;
      dps += attacker.stats.attackDamage / Math.max(0.1, attacker.stats.attackCooldown);
    }
    return dps;
  }

  /**
   * A minion our hit would kill when it lands (and allies wouldn't first):
   * the one closest to dying.
   */
  private findLastHit(minions: MinionForecast[]): MinionForecast | null {
    let best: MinionForecast | null = null;
    for (const forecast of minions) {
      if (forecast.healthAtHit <= 0 || forecast.healthAtHit > forecast.hitDamage) continue;
      if (!best || forecast.healthAtHit < best.healthAtHit) best = forecast;
    }
    return best;
  }

  /**
   * A minion that will be last-hittable before another attack of ours
   * would be ready again: attacking something else now would miss it.
   */
  private findUpcomingLastHit(champion: ServerChampion, minions: MinionForecast[]): MinionForecast | null {
    const attackCycle = 1 / champion.getStats().attackSpeed;
    let best: MinionForecast | null = null;
    let soonest = Infinity;
    for (const forecast of minions) {
      if (forecast.incomingDps <= 0 || forecast.healthAtHit <= forecast.hitDamage) continue;
      const timeUntilReady = (forecast.healthAtHit - forecast.hitDamage) / forecast.incomingDps;
      if (timeUntilReady < attackCycle && timeUntilReady < soonest) {
        best = forecast;
        soonest = timeUntilReady;
      }
    }
    return best;
  }

  /**
   * Stop attacking and stand in range of a minion until it's time to hit it.
   */
  private holdFor(champion: ServerChampion, minion: ServerEntity): BotInput[] | null {
    if (champion.isInAttackRange(minion, champion.getAttackRange())) {
      return champion.targetEntityId ? this.command('stop', [{ type: InputType.STOP }]) : null;
    }
    const away = champion.position.subtracted(minion.position).normalized();
    const standOff = champion.getAttackRange() * 0.8 + champion.getRadius() + minion.getRadius();
    return this.moveTo(minion.position.added(away.scaled(standOff)));
  }

  /**
   * Whether to auto-attack the enemy champion without committing to a fight:
   * it's in range and outside its tower.
   */
  protected canHarass(champion: ServerChampion, enemy: ServerChampion, context: ServerGameContext): boolean {
    if (!champion.isInAttackRange(enemy, champion.getAttackRange() + 30)) return false;
    // Only poke from ahead: an even poke war just sends both bots home
    if (champion.health / champion.maxHealth < enemy.health / enemy.maxHealth + 0.1) return false;
    return !this.findTowerCovering(champion.position, enemy.side, context);
  }

  /**
   * A minion to push with: one nothing allied is hitting (the weakest, so
   * its last hit comes soon), else the healthiest (a weak one being hit
   * would die to allied minions).
   */
  private findFarmTarget(minions: MinionForecast[]): ServerEntity | null {
    // Keep hitting the same minion: switching restarts the attack windup
    const current = minions.find(forecast => forecast.minion.id === this.farmTargetId);
    if (current) return current.minion;

    let best: MinionForecast | null = null;
    for (const forecast of minions) {
      if (!best || farmPriority(forecast) > farmPriority(best)) best = forecast;
    }
    this.farmTargetId = best?.minion.id ?? null;
    return best?.minion ?? null;
  }

  /**
   * An enemy tower, inhibitor or nexus near enough to attack that can take
   * damage (StructureRules), with allied minions tanking it if it's a tower.
   */
  private findSiegeTarget(champion: ServerChampion, context: ServerGameContext): ServerEntity | null {
    const reach = champion.getAttackRange() + SIEGE_REACH;
    for (const entity of context.getEnemiesInRadius(champion.position, reach, champion.side)) {
      if (entity.isDead) continue;
      if (entity.entityType !== EntityType.TOWER && entity.entityType !== EntityType.INHIBITOR &&
          entity.entityType !== EntityType.NEXUS) continue;
      if (!isStructureVulnerable(entity, context)) continue;
      // Towers shoot back once they run out of minions; inhibitors and the nexus don't
      if (entity.entityType === EntityType.TOWER && !this.alliesTankingTowerAt(this.attackSpot(champion, entity), champion, context)) continue;
      return entity;
    }
    return null;
  }

  /**
   * Visible enemy minions near enough to attack, and that can be hit from
   * outside their tower's range (or allied minions are already tanking it).
   */
  private reachableMinions(champion: ServerChampion, context: ServerGameContext): ServerEntity[] {
    const reach = champion.getAttackRange() + 300;
    return context.getEnemiesInRadius(champion.position, reach, champion.side).filter(entity =>
      entity.entityType === EntityType.MINION &&
      !entity.isDead &&
      context.isVisibleTo(entity, champion.side) &&
      this.safeToHit(champion, entity, context)
    );
  }

  /**
   * Whether hitting a minion keeps the champion out of its tower's range:
   * the spot it would hit from is outside it, or allied minions are tanking it.
   */
  private safeToHit(champion: ServerChampion, minion: ServerEntity, context: ServerGameContext): boolean {
    const spot = this.attackSpot(champion, minion);
    return !this.findTowerCovering(spot, minion.side, context) || this.alliesTankingTowerAt(spot, champion, context);
  }

  /**
   * Where the champion would hit a unit from: where it stands if it's in
   * range, else the edge of its range on the way there.
   */
  private attackSpot(champion: ServerChampion, target: ServerEntity): Vector {
    const reach = champion.getAttackRange() + champion.getRadius() + target.getRadius();
    const offset = champion.position.subtracted(target.position);
    const distance = offset.length();
    if (distance <= reach) return champion.position;
    return target.position.added(offset.scaled(reach / distance));
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
           !this.alliesTankingTowerAt(position, champion, context)) {
      distance -= 25;
      position = path.pointAt(distance);
    }
    return position;
  }

  /**
   * A living tower of `towerSide` whose range (plus margin) covers `position`.
   */
  protected findTowerCovering(
    position: Vector,
    towerSide: Side,
    context: ServerGameContext,
    margin = 0
  ): ServerEntity | null {
    for (const entity of context.getAllEntities()) {
      if (entity.entityType !== EntityType.TOWER || entity.isDead || entity.side !== towerSide) continue;
      if (entity.position.distanceTo(position) <= this.towerReach(entity) + margin) return entity;
    }
    return null;
  }

  /**
   * Whether the champion can stand at `position`, under an enemy tower: at
   * least MIN_TOWER_TANKS allied minions are in its range, and at the rate
   * they're taking damage (tower and enemy minions) they'll last long enough
   * for the champion to walk back out of range from there before the tower
   * turns on it. True if no tower covers it.
   */
  private alliesTankingTowerAt(position: Vector, champion: ServerChampion, context: ServerGameContext): boolean {
    const tower = this.findTowerCovering(position, 1 - champion.side as Side, context, TOWER_MARGIN) as ServerTower | null;
    if (!tower) return true;
    const tanks = context.getAllEntities().filter(entity =>
      entity.entityType === EntityType.MINION &&
      !entity.isDead &&
      entity.side === champion.side &&
      tower.isInAttackRange(entity, tower.attackRange)
    );
    if (tanks.length < MIN_TOWER_TANKS) return false;

    const tankHealth = tanks.reduce((total, minion) => total + minion.health, 0);
    const towerDps = tower.stats.attackDamage / tower.stats.attackCooldown;
    // The tower's damage counts once even if it's shooting one of them
    const minionDps = tanks.reduce((total, minion) => total + this.incomingDamagePerSecond(minion, context), 0) -
      (tanks.some(minion => tower.getAttackTargetId() === minion.id) ? towerDps : 0);
    const busyFor = tankHealth / (towerDps + ENEMY_MINION_DPS_WEIGHT * Math.max(0, minionDps));
    const walkOut = Math.max(0, this.towerReach(tower) - tower.position.distanceTo(position));
    const exitTime = walkOut / Math.max(1, champion.getStats().movementSpeed);
    return busyFor > exitTime + TOWER_EXIT_MARGIN;
  }

  /**
   * How far from its center a tower hits a champion (attack range is edge to edge).
   */
  private towerReach(tower: ServerEntity): number {
    return (tower as ServerTower).attackRange + tower.getRadius() + UNIT_RADIUS;
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

  protected getSpawn(side: Side, context: ServerGameContext): Vector {
    return side === 0 ? context.mapConfig.CHAMPION_SPAWN.BLUE : context.mapConfig.CHAMPION_SPAWN.RED;
  }

  // ===========================================================================
  // Commands
  // ===========================================================================

  protected moveTo(position: Vector): BotInput[] | null {
    // Round so tiny shifts of the target don't count as a new command
    const x = Math.round(position.x / 20) * 20;
    const y = Math.round(position.y / 20) * 20;
    return this.command(`move:${x},${y}`, [{ type: InputType.MOVE, targetX: x, targetY: y }]);
  }

  protected attack(target: ServerEntity): BotInput[] | null {
    return this.command(`attack:${target.id}`, [{ type: InputType.TARGET_UNIT, targetEntityId: target.id }]);
  }

  /**
   * Cast right away. Casts are never deduplicated: cooldowns stop repeats.
   */
  protected cast(input: BotInput): BotInput[] {
    this.lastCommandKey = '';
    return [input];
  }

  /**
   * Send a command unless it's the same as the last one sent recently.
   */
  protected command(key: string, inputs: BotInput[]): BotInput[] | null {
    if (key === this.lastCommandKey && this.time - this.lastCommandTime < RESEND_INTERVAL) {
      return null;
    }
    this.lastCommandKey = key;
    this.lastCommandTime = this.time;
    return inputs;
  }
}
