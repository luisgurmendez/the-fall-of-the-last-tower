/**
 * Who plays a practice match: the player in mid on blue, and bots for every
 * other role on both sides.
 * - 1v1: a bot in mid
 * - 3v3: top, mid and bot lanes
 * - 5v5: top, mid, bot, a support (a second LaneBot in the bot lane) and a
 *   jungler (JungleBot)
 * Bots pick champions that suit their role when they can (a tank on top, a
 * healer as support, a fighter in the jungle), with no repeats on a team.
 */

import type { LaneId, SummonerSpellId } from '@siege/shared';
import type { PlayerInfo } from '../game/GameRoom';
import type { BotController } from './BotController';
import { LaneBot } from './LaneBot';
import { JungleBot } from './JungleBot';

export type PracticeRole = 'top' | 'mid' | 'bot' | 'support' | 'jungle';
export type PracticeTeamSize = 1 | 3 | 5;

const ROLES: Record<PracticeTeamSize, PracticeRole[]> = {
  1: ['mid'],
  3: ['top', 'mid', 'bot'],
  5: ['top', 'mid', 'bot', 'support', 'jungle'],
};

/** Champions that suit a role, best first (any other will do when they're taken) */
const ROLE_PICKS: Record<PracticeRole, string[]> = {
  top: ['gorath', 'warrior', 'vile'],
  mid: ['magnus', 'lume', 'vex'],
  bot: ['vile', 'magnus', 'lume'],
  support: ['elara', 'lume', 'gorath'],
  jungle: ['warrior', 'vex', 'gorath'],
};

/** Summoner spells by role */
const ROLE_SPELLS: Record<PracticeRole, SummonerSpellId[]> = {
  top: ['blink', 'scorch'],
  mid: ['blink', 'mend'],
  bot: ['blink', 'mend'],
  support: ['blink', 'aegis'],
  jungle: ['reap', 'blink'],
};

/** Laners' lanes (the support goes bot) */
const ROLE_LANES: Record<Exclude<PracticeRole, 'jungle'>, LaneId> = {
  top: 'top',
  mid: 'mid',
  bot: 'bot',
  support: 'bot',
};

export function isPracticeTeamSize(size: unknown): size is PracticeTeamSize {
  return size === 1 || size === 3 || size === 5;
}

export interface PracticeMatchOptions {
  playerId: string;
  championId: string;
  summonerSpells: SummonerSpellId[];
  teamSize: PracticeTeamSize;
  /** Every champion bots may play */
  champions: readonly string[];
  /** The 1v1 bot's champion (the client picks it); the player's own if not given */
  botChampionId?: string;
  /** For tests */
  random?: () => number;
}

/** The match's players (the player first) and the bots that play for the rest */
export function buildPracticeMatch(options: PracticeMatchOptions): { players: PlayerInfo[]; bots: BotController[] } {
  const { playerId, championId, summonerSpells, teamSize, champions } = options;
  const random = options.random ?? Math.random;
  const players: PlayerInfo[] = [{ playerId, side: 0, championId, connected: true, summonerSpells }];
  const bots: BotController[] = [];

  for (const side of [0, 1] as const) {
    const taken = new Set(side === 0 ? [championId] : []);
    for (const role of ROLES[teamSize]) {
      if (side === 0 && role === 'mid') continue; // The player's

      const botId = teamSize === 1 ? `bot-${playerId}` : `bot-${playerId}-${side === 0 ? 'blue' : 'red'}-${role}`;
      const botChampion = teamSize === 1
        ? options.botChampionId ?? championId
        : pickChampion(role, champions, taken, random);
      taken.add(botChampion);

      players.push({ playerId: botId, side, championId: botChampion, connected: true, isBot: true, summonerSpells: ROLE_SPELLS[role] });
      bots.push(role === 'jungle'
        ? new JungleBot({ playerId: botId })
        : new LaneBot({ playerId: botId, lane: ROLE_LANES[role] }));
    }
  }
  return { players, bots };
}

/** A champion for the role not yet on the team: one that suits it if free, else any */
function pickChampion(role: PracticeRole, champions: readonly string[], taken: Set<string>, random: () => number): string {
  const free = champions.filter(id => !taken.has(id));
  const suited = ROLE_PICKS[role].filter(id => free.includes(id));
  const pool = suited.length > 0 ? suited : free.length > 0 ? free : champions;
  return pool[Math.floor(random() * pool.length)];
}
