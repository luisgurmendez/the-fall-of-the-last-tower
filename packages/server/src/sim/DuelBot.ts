/**
 * DuelBot - a plain duelist for measuring champions against each other
 * (src/sim/duels.ts): it fights one enemy champion, casting whatever is ready
 * when it reaches, and attacks in between. Every champion gets the same
 * simple play (no dodging, no kiting), so what differs between duels is the
 * kits and the numbers, not how well a bot plays each one.
 */

import {
  InputType,
  Vector,
  getAbilityDefinition,
  type AbilityDefinition,
  type AbilitySlot,
} from '@siege/shared';
import type { BotController, BotInput } from '../bots/BotController';
import { abilityHandlerRegistry } from '../abilities/AbilityHandlerRegistry';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerGameContext } from '../game/ServerGameContext';

const SLOTS: AbilitySlot[] = ['R', 'Q', 'W', 'E'];

/** Seconds between decisions */
const DECISION_INTERVAL = 0.2;

/** An ability cast that didn't go off (refused, like Martyr on itself) isn't tried again for this long */
const REFUSED_FOR = 5;

export class DuelBot implements BotController {
  private untilDecision = 0;
  private time = 0;
  /** The last ability it cast, to notice one that didn't go off */
  private lastCast: AbilitySlot | null = null;
  /** Abilities not to try, until a time */
  private readonly refusedUntil = new Map<AbilitySlot, number>();

  constructor(readonly playerId: string, private readonly enemyPlayerId: string) {}

  think(champion: ServerChampion, context: ServerGameContext, dt: number): BotInput[] {
    this.time += dt;
    this.untilDecision -= dt;
    if (this.untilDecision > 0 || champion.isDead) return [];
    this.untilDecision = DECISION_INTERVAL;
    // In a cast time: wait for it to go off
    if (champion.isCasting()) return [];
    if (this.lastCast && champion.abilityStates[this.lastCast].cooldownRemaining <= 0) {
      this.refusedUntil.set(this.lastCast, this.time + REFUSED_FOR);
    }
    this.lastCast = null;

    const enemy = context.getChampionByPlayerId(this.enemyPlayerId);
    if (!enemy || enemy.isDead) return [];
    const distance = champion.position.distanceTo(enemy.position);

    const cast = this.chooseCast(champion, enemy, distance, context);
    if (cast) {
      this.lastCast = cast.type === InputType.ABILITY ? cast.slot : null;
      return [cast];
    }
    if (champion.targetEntityId === enemy.id) return [];
    return [{ type: InputType.TARGET_UNIT, targetEntityId: enemy.id }];
  }

  private chooseCast(champion: ServerChampion, enemy: ServerChampion, distance: number, context: ServerGameContext): BotInput | null {
    if (champion.ccStatus.isSilenced || champion.ccStatus.isStunned) return null;
    const reach = champion.getAttackRange() + champion.getRadius() + enemy.getRadius();
    for (const slot of SLOTS) {
      const rank = champion.abilityRanks[slot];
      if (rank <= 0 || champion.abilityStates[slot].cooldownRemaining > 0) continue;
      if ((this.refusedUntil.get(slot) ?? 0) > this.time) continue;
      const definition = getAbilityDefinition(champion.definition.abilities[slot]);
      if (!definition || champion.resource < (definition.manaCost?.[rank - 1] ?? 0)) continue;
      const input = castAt(definition, slot, champion, enemy, distance, reach);
      if (input && wouldGoOff(definition, slot, champion, input, context)) return input;
    }
    return null;
  }
}

/**
 * Whether its handler would let it go off now, as a player would see (Kip's
 * W and R need an enemy he marked): one it would refuse isn't pressed.
 */
function wouldGoOff(definition: AbilityDefinition, slot: AbilitySlot, champion: ServerChampion, input: BotInput, context: ServerGameContext): boolean {
  const handler = abilityHandlerRegistry.get(definition.id);
  if (!handler?.validate || input.type !== InputType.ABILITY) return true;
  return handler.validate({
    champion,
    slot,
    definition,
    rank: champion.abilityRanks[slot],
    targetPosition: input.targetX !== undefined && input.targetY !== undefined ? new Vector(input.targetX, input.targetY) : undefined,
    targetEntityId: input.targetEntityId,
    context,
    damageMultiplier: 1,
  }).valid;
}

/** The cast of an ability on the enemy, if it reaches and makes sense now */
function castAt(
  definition: AbilityDefinition,
  slot: AbilitySlot,
  champion: ServerChampion,
  enemy: ServerChampion,
  distance: number,
  reach: number
): BotInput | null {
  const range = definition.range ?? 0;
  const atEnemy: BotInput = { type: InputType.ABILITY, slot, targetType: 'position', targetX: enemy.position.x, targetY: enemy.position.y };
  switch (definition.targetType) {
    case 'target_enemy':
    case 'target_unit':
      return distance <= range + enemy.getRadius() ? { type: InputType.ABILITY, slot, targetType: 'unit', targetEntityId: enemy.id } : null;
    case 'skillshot':
      return distance <= range ? atEnemy : null;
    case 'ground_target':
      // A dash closes the gap; an area lands on the enemy
      if (definition.dash) return distance > reach ? atEnemy : null;
      return distance <= range + (definition.aoeRadius ?? 0) ? atEnemy : null;
    case 'no_target':
      return distance <= (definition.aoeRadius ?? reach) + enemy.getRadius() ? { type: InputType.ABILITY, slot, targetType: 'none' } : null;
    case 'self':
      return distance <= reach + 150 ? { type: InputType.ABILITY, slot, targetType: 'none' } : null;
    case 'target_ally':
      // On itself (there's no ally in a duel)
      return !definition.excludesSelf && distance <= reach + 150 && champion.health < champion.maxHealth * 0.8
        ? { type: InputType.ABILITY, slot, targetType: 'unit', targetEntityId: champion.id }
        : null;
    default:
      return null;
  }
}
