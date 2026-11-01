/**
 * JungleBot - A practice bot that jungles.
 *
 * It plays like a LaneBot (levels, shopping, retreating and recalling,
 * fights, summoner spells: Reap finishes big monsters) but instead of a lane
 * it walks its side's jungle:
 * 1. Gank: an enemy champion in sight, hurt and out of its towers' reach,
 *    not too far away, once the bot has a few levels and its health
 * 2. Clear the nearest camp of its own jungle that's up (the dragon too,
 *    once strong enough), focusing the weakest monster and using its
 *    abilities on it
 * 3. With nothing up, help in mid like a LaneBot until a camp respawns
 */

import { EntityType, type Side } from '@siege/shared';
import type { BotInput } from './BotController';
import { LaneBot, type LaneBotConfig } from './LaneBot';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';

/** Within this of a camp, the bot fights its monsters (else it walks there) */
const CAMP_REACH = 260;
/** Level from which the bot takes the dragon on */
const DRAGON_LEVEL = 8;
/** Level and health ratio from which the bot ganks */
const GANK_LEVEL = 3;
const GANK_HEALTH = 0.6;
/** An enemy this hurt (health ratio) is worth a gank... */
const GANK_TARGET_HEALTH = 0.55;
/** ...within this far */
const GANK_DISTANCE = 1600;
/** Mana ratio kept for fights: abilities go on monsters only above it */
const MANA_RESERVE = 0.35;
/** A camp this much closer to the enemy's fountain than ours is theirs */
const OWN_JUNGLE_MARGIN = 200;

export class JungleBot extends LaneBot {
  constructor(config: LaneBotConfig) {
    super({ ...config, lane: 'mid' });
  }

  protected override chooseLaneAction(champion: ServerChampion, context: ServerGameContext, enemyChampion: ServerChampion | null): BotInput[] | null {
    const gank = this.findGankTarget(champion, context);
    if (gank) {
      this.lastDecision = 'gank';
      return this.moveTo(gank.position);
    }

    const monsters = this.findCampToClear(champion, context);
    if (monsters) return this.clearCamp(champion, monsters, context);

    return super.chooseLaneAction(champion, context, enemyChampion);
  }

  // ===========================================================================
  // Jungle
  // ===========================================================================

  /**
   * The living monsters of the camp to clear next: the closest one of our
   * jungle that's up (and the dragon once strong enough).
   */
  private findCampToClear(champion: ServerChampion, context: ServerGameContext): ServerEntity[] | null {
    const ownSpawn = this.getSpawn(champion.side, context);
    const enemySpawn = this.getSpawn(1 - champion.side as Side, context);
    const camps = new Map<string, ServerEntity[]>();
    for (const entity of context.getAllEntities()) {
      if (entity.entityType !== EntityType.JUNGLE_CAMP || entity.isDead) continue;
      const creature = entity as ServerEntity & { campId: string; creatureType: string };
      if (creature.creatureType === 'dragon' || creature.creatureType === 'rootwyrm' ? champion.level < DRAGON_LEVEL
        : creature.position.distanceTo(ownSpawn) > creature.position.distanceTo(enemySpawn) + OWN_JUNGLE_MARGIN) continue;
      camps.set(creature.campId, [...(camps.get(creature.campId) ?? []), creature]);
    }

    let best: ServerEntity[] | null = null;
    let bestDistance = Infinity;
    for (const monsters of camps.values()) {
      const distance = monsters[0].position.distanceTo(champion.position);
      if (distance < bestDistance) {
        best = monsters;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Walk to the camp, then focus its weakest monster, abilities first */
  private clearCamp(champion: ServerChampion, monsters: ServerEntity[], context: ServerGameContext): BotInput[] | null {
    const target = monsters.reduce((weakest, monster) => monster.health < weakest.health ? monster : weakest);
    const distance = target.position.distanceTo(champion.position);
    if (distance > CAMP_REACH + champion.getAttackRange()) {
      this.lastDecision = 'walk to camp';
      return this.moveTo(target.position);
    }

    this.lastDecision = 'clear camp';
    if (champion.resource > champion.maxResource * MANA_RESERVE) {
      const cast = this.chooseAbility(champion, target, 'offense', context);
      if (cast) return this.cast(cast);
    }
    return this.attack(target);
  }

  /** A hurt enemy champion worth walking over to, if the bot's up to it */
  private findGankTarget(champion: ServerChampion, context: ServerGameContext): ServerChampion | null {
    if (champion.level < GANK_LEVEL || champion.health / champion.maxHealth < GANK_HEALTH) return null;
    let best: ServerChampion | null = null;
    let bestDistance = GANK_DISTANCE;
    for (const enemy of context.getAllChampions()) {
      if (enemy.side === champion.side || enemy.isDead || !context.isVisibleTo(enemy, champion.side)) continue;
      if (enemy.health / enemy.maxHealth > GANK_TARGET_HEALTH) continue;
      if (this.findTowerCovering(enemy.position, enemy.side, context)) continue;
      const distance = enemy.position.distanceTo(champion.position);
      if (distance < bestDistance) {
        best = enemy;
        bestDistance = distance;
      }
    }
    return best;
  }
}
