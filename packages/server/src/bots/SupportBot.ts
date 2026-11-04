/**
 * SupportBot - A practice bot that supports the bot lane's carry.
 *
 * It plays like a LaneBot (levels, shopping, retreating and recalling,
 * fights, summoner spells), but in lane, while its carry is with it:
 * 1. Heal or shield an ally that's hurt (Elara's blessing and shield)
 * 2. Poke the enemy champion when it's ahead
 * 3. Leave the minions to the carry and stand with it, a step behind
 * Without its carry nearby (dead, gone home) it plays the lane like a LaneBot.
 * Its carry is the player it's given (`carryPlayerId`); without one, the
 * nearest allied champion.
 */

import { getAbilityDefinition, InputType, Vector, withStarter, type AbilitySlot } from '@siege/shared';
import type { BotInput } from './BotController';
import { LaneBot, type LaneBotConfig } from './LaneBot';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerGameContext } from '../game/ServerGameContext';

/** An allied champion this close is the carry the support sticks with */
const CARRY_DISTANCE = 900;
/** How far behind the carry (toward home) the support stands */
const BEHIND_CARRY = 90;
const SLOTS: AbilitySlot[] = ['Q', 'W', 'E', 'R'];

export interface SupportBotConfig extends LaneBotConfig {
  /** The champion to support (the bot lane's carry) */
  carryPlayerId?: string;
}

export class SupportBot extends LaneBot {
  private readonly carryPlayerId: string | undefined;

  constructor(config: SupportBotConfig) {
    super({ ...config, lane: config.lane ?? 'bot' });
    this.carryPlayerId = config.carryPlayerId;
  }

  /** Its build starts with the support's lantern */
  protected override getBuild(champion: ServerChampion): string[] {
    return withStarter(super.getBuild(champion), 'pilgrim_lantern');
  }

  protected override chooseLaneAction(champion: ServerChampion, context: ServerGameContext, enemyChampion: ServerChampion | null): BotInput[] | null {
    const carry = this.findCarry(champion, context);
    if (!carry) return super.chooseLaneAction(champion, context, enemyChampion);

    const care = this.chooseAllyCare(champion, context);
    if (care) {
      this.lastDecision = 'heal or shield an ally';
      return this.cast(care);
    }

    if (enemyChampion && this.canHarass(champion, enemyChampion, context)) {
      this.lastDecision = 'harass';
      return this.attack(enemyChampion);
    }

    this.lastDecision = 'stay with the carry';
    const home = this.getSpawn(champion.side, context);
    return this.moveTo(carry.position.added(Vector.direction(carry.position, home).scaled(BEHIND_CARRY)));
  }

  /** Its carry, or the nearest living allied champion, if close enough to stick with */
  private findCarry(champion: ServerChampion, context: ServerGameContext): ServerChampion | null {
    if (this.carryPlayerId) {
      const carry = context.getChampionByPlayerId(this.carryPlayerId);
      const near = carry && !carry.isDead && !carry.isRecalling && carry.position.distanceTo(champion.position) < CARRY_DISTANCE;
      return near ? carry : null;
    }
    let best: ServerChampion | null = null;
    let bestDistance = CARRY_DISTANCE;
    for (const ally of context.getChampionsBySide(champion.side)) {
      if (ally === champion || ally.isDead || ally.isRecalling) continue;
      const distance = ally.position.distanceTo(champion.position);
      if (distance < bestDistance) {
        best = ally;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** A heal or shield on a hurt ally, out of a fight too */
  private chooseAllyCare(champion: ServerChampion, context: ServerGameContext): BotInput | null {
    if (champion.ccStatus.isSilenced || champion.ccStatus.isStunned) return null;
    for (const slot of SLOTS) {
      const rank = champion.abilityRanks[slot];
      if (rank <= 0 || champion.abilityStates[slot].cooldownRemaining > 0) continue;
      const ability = getAbilityDefinition(champion.abilityInSlot(slot));
      if (ability?.targetType !== 'target_ally') continue;
      if (champion.resource < (ability.manaCost?.[rank - 1] ?? 0)) continue;
      const ally = this.mostWoundedAlly(champion, ability.range ?? 300, context, ability.excludesSelf);
      if (ally) return { type: InputType.ABILITY, slot, targetType: 'unit', targetEntityId: ally.id };
    }
    return null;
  }
}
