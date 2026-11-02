/**
 * DebugReport - The debug overlay's DEBUG_STATE: what the server thinks
 * about each unit a player's side sees. Units describe themselves
 * (ServerEntity.debugInfo); a bot's champion also says what the bot decided.
 * Practice matches only (GameRoom.setDebug).
 */

import { EntityType, type DebugStateData, type DebugUnit } from '@siege/shared';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerGameContext } from './ServerGameContext';

/**
 * @param entities What the player's side sees
 * @param botDecision What the bot playing a champion last decided, if a bot plays it
 */
export function buildDebugState(
  entities: ServerEntity[],
  context: ServerGameContext,
  tick: number,
  botDecision: (playerId: string) => string | undefined,
): DebugStateData {
  const units: DebugUnit[] = [];
  for (const entity of entities) {
    const unit = entity.debugInfo(context);
    if (!unit) continue;
    if (entity.entityType === EntityType.CHAMPION) {
      const decision = botDecision((entity as ServerChampion).playerId);
      if (decision) unit.state = `bot: ${decision} (${unit.state})`;
    }
    units.push(unit);
  }
  return { tick, gameTime: context.getGameTime(), units };
}
