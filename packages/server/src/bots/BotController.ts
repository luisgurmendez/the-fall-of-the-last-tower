/**
 * BotController - Interface for anything that plays a champion on the server
 * without a network connection (practice bots, simulation agents).
 *
 * Bots produce the same inputs a client would send. GameRoom and Simulation
 * stamp them with a sequence number and queue them through the InputHandler,
 * so bots go through the same validation and rate limits as real players.
 */

import type { ClientInput } from '@siege/shared';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerGameContext } from '../game/ServerGameContext';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * A client input without the transport fields (seq, clientTime).
 */
export type BotInput = DistributiveOmit<ClientInput, 'seq' | 'clientTime'>;

export interface BotController {
  readonly playerId: string;
  /** What it decided last, in a few words (the debug overlay and the simulation sandbox show it) */
  readonly lastDecision?: string;

  /**
   * Decide what to do this tick.
   * @param champion The champion this bot controls
   * @param context Game state (bots may read everything, like a server-side AI)
   * @param dt Seconds since the last call
   */
  think(champion: ServerChampion, context: ServerGameContext, dt: number): BotInput[];
}

/**
 * Turns bot inputs into client inputs with increasing sequence numbers.
 */
export class BotInputStamper {
  private seq = 0;

  stamp(input: BotInput, clientTime: number): ClientInput {
    this.seq++;
    return { ...input, seq: this.seq, clientTime } as ClientInput;
  }
}
