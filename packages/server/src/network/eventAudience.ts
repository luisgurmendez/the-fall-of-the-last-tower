/**
 * Who gets a game event. Most go to every player; a ping only to its team
 * (the enemy mustn't learn where it points), an emote to its team and to
 * whoever sees the champion.
 */

import { GameEventType, type GameEvent } from '@siege/shared';

/**
 * Whether a player on `side` gets `event`; `sees` says whether that side
 * sees an entity.
 */
export function reachesSide(event: GameEvent, side: number, sees: (entityId: string) => boolean): boolean {
  switch (event.type) {
    case GameEventType.PING:
      return event.data.side === side;
    case GameEventType.EMOTE:
      return event.data.side === side || sees(event.data.entityId as string);
    default:
      return true;
  }
}
