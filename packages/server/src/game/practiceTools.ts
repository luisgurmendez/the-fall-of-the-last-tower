/**
 * The practice tools: what a player can do to their own match in practice
 * (InputType.PRACTICE_TOOL; GameRoom ignores them in any other match).
 *
 * - **level_up / max_level:** a level (or every one up to 18), earned as
 *   experience is, so each comes with its skill point and its stats.
 * - **gold:** GOLD more.
 * - **reset_cooldowns:** abilities (and their charges), summoner spells,
 *   item actives and the passive, ready.
 * - **refill:** full health and mana; dead, back at the fountain at once.
 * - **teleport:** to (x, y), or the nearest spot the champion fits; it stands
 *   still there (a recall, a cast, a dash or a walk under way ends).
 * - **toggle_no_cooldowns:** while on, abilities, charges, summoner spells
 *   and item actives are ready again after every tick (afterTick).
 * - **toggle_invulnerable:** while on, the champion takes no damage at all
 *   (ServerChampion.invulnerableInPractice).
 * - **toggle_freeze_bots:** while on, the bots do nothing (GameRoom skips
 *   them) and stand where they were.
 *
 * Each use tells the player the tool and which toggles are on (a
 * PRACTICE_TOOLS event), and so does a reconnect (announce).
 */

import { GameConfig, GameEventType, PRACTICE_TOOLS, Vector, type PracticeTool, type PracticeToggles } from '@siege/shared';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerGameContext } from './ServerGameContext';

/** What the gold tool gives */
export const PRACTICE_GOLD = 1000;

const TOOLS: ReadonlySet<unknown> = new Set(PRACTICE_TOOLS);

export function isPracticeTool(value: unknown): value is PracticeTool {
  return TOOLS.has(value);
}

/** What a PRACTICE_TOOL input carries (untrusted JSON) */
export interface PracticeToolRequest {
  tool?: unknown;
  x?: unknown;
  y?: unknown;
}

export class PracticeTools {
  /** Players with no cooldowns, and players who can't be hurt */
  private readonly noCooldowns = new Set<string>();
  private readonly invulnerable = new Set<string>();
  private frozen = false;

  /** @param botPlayerIds The bots' players (frozen bots stop) */
  constructor(private readonly botPlayerIds: () => Iterable<string>) {}

  /** Whether the bots are frozen */
  get botsFrozen(): boolean {
    return this.frozen;
  }

  /** Which toggles are on for a player */
  togglesOf(playerId: string): PracticeToggles {
    return {
      noCooldowns: this.noCooldowns.has(playerId),
      invulnerable: this.invulnerable.has(playerId),
      freezeBots: this.frozen,
    };
  }

  /**
   * A player uses a tool on their champion. Returns whether it was one (an
   * unknown tool, or a teleport without a point, does nothing).
   */
  use(playerId: string, request: PracticeToolRequest, context: ServerGameContext): boolean {
    const { tool } = request;
    const champion = context.getChampionByPlayerId(playerId);
    if (!isPracticeTool(tool) || !champion) return false;

    switch (tool) {
      case 'level_up':
        levelUp(champion);
        break;
      case 'max_level':
        while (champion.level < GameConfig.LIMITS.MAX_LEVEL) levelUp(champion);
        break;
      case 'gold':
        champion.gold += PRACTICE_GOLD;
        break;
      case 'reset_cooldowns':
        champion.resetCooldowns();
        champion.passiveState.cooldownRemaining = 0;
        break;
      case 'refill':
        refill(champion);
        break;
      case 'teleport': {
        const { x, y } = request;
        if (!Number.isFinite(x) || !Number.isFinite(y) || champion.isDead) return false;
        teleport(champion, new Vector(x as number, y as number), context);
        break;
      }
      case 'toggle_no_cooldowns':
        flip(this.noCooldowns, playerId);
        if (this.noCooldowns.has(playerId)) champion.resetCooldowns();
        break;
      case 'toggle_invulnerable':
        flip(this.invulnerable, playerId);
        champion.invulnerableInPractice = this.invulnerable.has(playerId);
        break;
      case 'toggle_freeze_bots':
        this.frozen = !this.frozen;
        if (this.frozen) this.stopBots(context);
        break;
    }

    this.announce(playerId, tool, context);
    return true;
  }

  /** After each tick: no cooldowns for those who turned it on */
  afterTick(context: ServerGameContext): void {
    for (const playerId of this.noCooldowns) {
      const champion = context.getChampionByPlayerId(playerId);
      if (champion) champion.resetCooldowns();
    }
  }

  /** Tell the player which toggles are on (tool: the one just used; null on a reconnect) */
  announce(playerId: string, tool: PracticeTool | null, context: ServerGameContext): void {
    const champion = context.getChampionByPlayerId(playerId);
    if (!champion) return;
    context.addEvent(GameEventType.PRACTICE_TOOLS, { entityId: champion.id, tool, ...this.togglesOf(playerId) });
  }

  /** Every bot's champion stands where it is */
  private stopBots(context: ServerGameContext): void {
    for (const playerId of this.botPlayerIds()) {
      const champion = context.getChampionByPlayerId(playerId);
      if (champion) halt(champion, context);
    }
  }
}

function flip(set: Set<string>, playerId: string): void {
  if (set.has(playerId)) set.delete(playerId);
  else set.add(playerId);
}

/** A level as earned: exactly the experience it lacked */
function levelUp(champion: ServerChampion): void {
  if (champion.level >= GameConfig.LIMITS.MAX_LEVEL) return;
  champion.gainExperience(Math.max(0, champion.experienceToNextLevel - champion.experience));
}

function refill(champion: ServerChampion): void {
  if (champion.isDead) {
    // The respawn comes on the next tick, with full health and mana
    champion.respawnTimer = 0;
    return;
  }
  const stats = champion.getStats();
  champion.health = stats.maxHealth;
  champion.resource = stats.maxResource;
}

/** It stops whatever it was doing and stands still */
function halt(champion: ServerChampion, context: ServerGameContext): void {
  champion.cancelRecall();
  champion.cancelCast(context);
  champion.endAttackMove();
  champion.stop();
  context.pathFollower.clear(champion.id);
}

/** To `to`, or the nearest spot the champion fits */
function teleport(champion: ServerChampion, to: Vector, context: ServerGameContext): void {
  const radius = champion.getRadius();
  const spot = to.clone();
  context.terrain.resolveCircle(spot, radius);
  // Still in something (a nexus, or a wall too thick to be pushed out of): the open spot nearest it on the way there
  const landing = context.terrain.clearanceAt(spot.x, spot.y) >= radius - 1
    ? spot
    : context.terrain.landingSpot(champion.position, to, Number.POSITIVE_INFINITY, radius);
  halt(champion, context);
  champion.forcedMovement = null;
  champion.dashAbilityId = null;
  champion.position.setFrom(landing);
}
