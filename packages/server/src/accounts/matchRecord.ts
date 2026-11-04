/**
 * What's kept of a finished match (AccountStore.recordMatch): every
 * champion's final stats (GameRoom.getFinalStats) with who played it (their
 * name, a bot or not, the account they played with), the map, where it came
 * from and how it ended.
 */

import type { FinalPlayerStats } from '@siege/shared';
import type { MatchMode, MatchRecord } from './AccountStore';

export interface MatchRecordSource {
  stats: FinalPlayerStats[];
  /** The match's players (GameRoom.getPlayersWithEntityIds) */
  players: { playerId: string; side: number; isBot: boolean; name?: string }[];
  /** The account a human played with, if any */
  accountOf: (playerId: string) => number | undefined;
  mapId: string;
  mode: MatchMode;
  practice: boolean;
  /** Seconds */
  duration: number;
  winningSide: number;
}

export function matchRecordOf(source: MatchRecordSource): MatchRecord {
  const players = new Map(source.players.map(player => [player.playerId, player]));
  return {
    mapId: source.mapId,
    mode: source.mode,
    practice: source.practice,
    duration: source.duration,
    winningSide: source.winningSide,
    players: source.stats.map(stats => {
      const player = players.get(stats.playerId);
      // A champion no player is known for is no one's
      const isBot = player?.isBot ?? true;
      return {
        playerId: stats.playerId,
        accountId: isBot ? null : source.accountOf(stats.playerId) ?? null,
        name: isBot ? null : player?.name ?? null,
        isBot,
        championId: stats.championId,
        side: stats.side,
        level: stats.level,
        kills: stats.kills,
        deaths: stats.deaths,
        assists: stats.assists,
        cs: stats.cs,
        gold: stats.gold,
        items: stats.items,
        totals: stats.totals,
      };
    }),
  };
}
