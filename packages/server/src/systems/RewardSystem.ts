/**
 * RewardSystem - Handles XP and gold distribution on entity kills.
 *
 * XP Distribution Rules:
 * - XP is shared among all allied champions within XP range (1400 units)
 * - XP is split evenly among nearby allies
 * - Gold goes only to the last-hitter
 *
 * XP Values:
 * - Minions: Melee 60, Caster 29, Siege 93, Super 97
 * - Jungle: Varies by creature type
 * - Champions: 140 base + 20 per level difference
 * - Towers: 100 XP
 */

import { GameConfig, EntityType, GameEventType } from '@siege/shared';
import type { ServerGameContext } from '../game/ServerGameContext';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerChampion } from '../simulation/ServerChampion';
import { passiveTriggerSystem } from './PassiveTriggerSystem';
import { Logger } from '../utils/Logger';

/** Tower XP reward constant (not in GameConfig yet) */
const TOWER_XP_REWARD = 100;

export class RewardSystem {
  /**
   * Award XP and gold for killing an entity.
   * @param killedEntity - The entity that was killed
   * @param killerId - ID of the entity that got the last hit (may be undefined)
   * @param context - Server game context
   */
  static awardKillRewards(
    killedEntity: ServerEntity,
    killerId: string | undefined,
    context: ServerGameContext
  ): void {
    // Get XP and gold values from the killed entity
    const { xp, gold } = RewardSystem.getRewardValues(killedEntity, context);

    if (xp <= 0 && gold <= 0) {
      return; // No rewards to give
    }

    // Award gold to last-hitter only
    if (killerId && gold > 0) {
      const killer = context.getEntity(killerId);
      if (killer && killer.entityType === EntityType.CHAMPION) {
        const killerChampion = killer as ServerChampion;
        killerChampion.grantGold(gold);
        Logger.combat.info(`${killerChampion.playerId} earned ${gold}g for kill`);

        // Emit gold earned event for floating gold number
        context.addEvent(GameEventType.GOLD_EARNED, {
          entityId: killerChampion.id,
          amount: gold,
          sourceType: killedEntity.entityType, // What was killed to earn gold
        });

        // Dispatch on_kill trigger for passive abilities
        passiveTriggerSystem.dispatchTrigger('on_kill', killerChampion, context, {
          target: killedEntity,
        });
      }
    }

    // Award XP to all nearby allied champions
    if (xp > 0) {
      RewardSystem.awardXPToNearbyAllies(killedEntity, killerId, xp, context);
    }
  }

  /**
   * Get XP and gold reward values for a killed entity.
   */
  private static getRewardValues(
    entity: ServerEntity,
    context: ServerGameContext
  ): { xp: number; gold: number } {
    switch (entity.entityType) {
      case EntityType.MINION: {
        // Minion rewards are stored on the entity
        const minion = entity as any;
        return {
          xp: minion.experienceReward ?? 0,
          gold: minion.goldReward ?? 0,
        };
      }

      case EntityType.JUNGLE_CAMP: {
        // Jungle creature rewards are stored on the entity
        const creature = entity as any;
        return {
          xp: creature.expReward ?? 0,
          gold: creature.goldReward ?? 0,
        };
      }

      case EntityType.CHAMPION: {
        // Champion kill XP: base + level difference bonus
        const champion = entity as ServerChampion;
        const baseXP = GameConfig.EXPERIENCE.CHAMPION_KILL_XP_BASE;
        const levelBonus = champion.level * GameConfig.EXPERIENCE.XP_PER_LEVEL_DIFF;
        const xp = baseXP + levelBonus;

        // Champion kill gold: base + kill streak modifiers (simplified for now)
        const gold = GameConfig.ECONOMY.CHAMPION_KILL_GOLD_BASE;

        return { xp, gold };
      }

      case EntityType.TOWER: {
        // Tower rewards
        const tower = entity as any;
        return {
          xp: TOWER_XP_REWARD,
          gold: tower.reward?.killer ?? GameConfig.ECONOMY.TOWER_GOLD.killer,
        };
      }

      default:
        return { xp: 0, gold: 0 };
    }
  }

  /**
   * Award XP to all allied champions within XP range.
   * XP is split evenly among nearby allies.
   */
  private static awardXPToNearbyAllies(
    killedEntity: ServerEntity,
    killerId: string | undefined,
    totalXP: number,
    context: ServerGameContext
  ): void {
    const xpRange = GameConfig.EXPERIENCE.XP_RANGE;
    const killedPosition = killedEntity.position;
    const killedSide = killedEntity.side;

    // Find all allied champions within XP range
    // "Allied" means the opposite side of the killed entity
    const nearbyAlliedChampions: ServerChampion[] = [];

    for (const champion of context.getAllChampions()) {
      // Skip champions on the same side as the killed entity
      if (champion.side === killedSide) continue;

      // Skip dead champions
      if (champion.isDead) continue;

      // Check if in range
      const distance = champion.position.distanceTo(killedPosition);
      if (distance <= xpRange) {
        nearbyAlliedChampions.push(champion);
      }
    }

    // If no nearby champions, try to give XP to killer only
    if (nearbyAlliedChampions.length === 0) {
      if (killerId) {
        const killer = context.getEntity(killerId);
        if (killer && killer.entityType === EntityType.CHAMPION) {
          const killerChampion = killer as ServerChampion;
          // Only award if killer is on opposite side
          if (killerChampion.side !== killedSide) {
            killerChampion.gainExperience(totalXP);
            Logger.combat.debug(`${killerChampion.playerId} earned ${totalXP} XP (solo)`);

            // Emit XP earned event for floating XP number
            context.addEvent(GameEventType.XP_EARNED, {
              entityId: killerChampion.id,
              amount: totalXP,
              sourceType: killedEntity.entityType,
            });
          }
        }
      }
      return;
    }

    // Split XP evenly among nearby allies
    const xpPerChampion = Math.floor(totalXP / nearbyAlliedChampions.length);

    for (const champion of nearbyAlliedChampions) {
      champion.gainExperience(xpPerChampion);

      // Emit XP earned event for floating XP number
      context.addEvent(GameEventType.XP_EARNED, {
        entityId: champion.id,
        amount: xpPerChampion,
        sourceType: killedEntity.entityType,
      });
    }

    Logger.combat.debug(`${xpPerChampion} XP each to ${nearbyAlliedChampions.length} champions`);
  }

  /**
   * Award global tower gold to all allied champions.
   * Called when a tower is destroyed.
   */
  static awardGlobalTowerGold(
    towerSide: number,
    context: ServerGameContext
  ): void {
    const globalGold = GameConfig.ECONOMY.TOWER_GOLD.global;

    for (const champion of context.getAllChampions()) {
      // Award gold to champions on the opposite side
      if (champion.side !== towerSide && !champion.isDead) {
        champion.grantGold(globalGold);

        // Emit gold earned event for floating gold number
        context.addEvent(GameEventType.GOLD_EARNED, {
          entityId: champion.id,
          amount: globalGold,
          sourceType: EntityType.TOWER,
        });
      }
    }

    Logger.combat.info(`Tower destroyed: ${globalGold}g global gold awarded`);
  }
}

export default RewardSystem;
