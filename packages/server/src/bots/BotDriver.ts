/**
 * BotDriver - Runs bot controllers each tick and feeds their inputs to the
 * InputHandler, exactly like network inputs.
 */

import type { InputHandler } from '../network/InputHandler';
import type { ServerGameContext } from '../game/ServerGameContext';
import { BotInputStamper, type BotController } from './BotController';
import { Logger } from '../utils/Logger';

export class BotDriver {
  private readonly bots: { controller: BotController; stamper: BotInputStamper }[] = [];

  /**
   * @param stampers Sequence counters per player, shared with anything else that
   *                 queues inputs for the same players (so sequences never go backwards)
   */
  constructor(private readonly stampers: Map<string, BotInputStamper> = new Map()) {}

  add(controller: BotController): void {
    let stamper = this.stampers.get(controller.playerId);
    if (!stamper) {
      stamper = new BotInputStamper();
      this.stampers.set(controller.playerId, stamper);
    }
    this.bots.push({ controller, stamper });
  }

  remove(playerId: string): void {
    const index = this.bots.findIndex(bot => bot.controller.playerId === playerId);
    if (index >= 0) this.bots.splice(index, 1);
  }

  has(playerId: string): boolean {
    return this.bots.some(bot => bot.controller.playerId === playerId);
  }

  /** What the bot playing a player last decided (undefined for humans) */
  decisionOf(playerId: string): string | undefined {
    return this.bots.find(bot => bot.controller.playerId === playerId)?.controller.lastDecision;
  }

  /**
   * Let every bot think and queue its inputs.
   * @param clientTime Timestamp to stamp inputs with
   */
  update(context: ServerGameContext, inputHandler: InputHandler, dt: number, clientTime: number): void {
    for (const { controller, stamper } of this.bots) {
      const champion = context.getChampionByPlayerId(controller.playerId);
      if (!champion) continue;

      for (const input of controller.think(champion, context, dt)) {
        const result = inputHandler.queueInput(controller.playerId, stamper.stamp(input, clientTime));
        if (!result.valid) {
          Logger.input.debug(`Bot ${controller.playerId} input rejected: ${result.reason}`);
        }
      }
    }
  }
}
