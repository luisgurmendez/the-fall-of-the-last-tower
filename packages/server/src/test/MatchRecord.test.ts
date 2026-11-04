/**
 * What's kept of a finished match (src/accounts/matchRecord.ts): every
 * champion's final stats with who played it (their name, a bot or not, the
 * account they played with), the map, where it came from (the queue, a
 * room) and how it ended.
 */

import { describe, test, expect } from 'bun:test';
import type { FinalPlayerStats } from '@siege/shared';
import { matchRecordOf } from '../accounts/matchRecord';

const TOTALS = {
  damageToChampions: 1, damageDealt: 2, damageTaken: 3, healing: 4, damageToStructures: 5,
  goldEarned: 6, wardsPlaced: 7, wardsDestroyed: 8, largestKillingSpree: 9,
};

function stats(playerId: string, side: number, championId = 'vex'): FinalPlayerStats {
  return { playerId, championId, side, level: 11, kills: 5, deaths: 3, assists: 8, cs: 120, gold: 800, items: ['a', null], totals: TOTALS };
}

describe('A match to keep', () => {
  const players = [
    { playerId: 'luis', side: 0, isBot: false, name: 'Luis' },
    { playerId: 'bot-1', side: 1, isBot: true },
    { playerId: 'guest', side: 1, isBot: false, name: 'Pepe' },
    { playerId: 'nameless', side: 0, isBot: false },
  ];
  const accounts: Record<string, number> = { luis: 7, 'bot-1': 99 };

  const record = matchRecordOf({
    stats: [stats('luis', 0), stats('bot-1', 1, 'gorath'), stats('guest', 1, 'kael'), stats('nameless', 0)],
    players,
    accountOf: playerId => accounts[playerId],
    mapId: 'narrows',
    mode: 'room',
    practice: false,
    duration: 321,
    winningSide: 1,
  });

  test("the match's facts", () => {
    expect(record).toMatchObject({ mapId: 'narrows', mode: 'room', practice: false, duration: 321, winningSide: 1 });
  });

  test("each champion's stats, with who played it", () => {
    expect(record.players).toHaveLength(4);
    expect(record.players[0]).toEqual({
      playerId: 'luis', accountId: 7, name: 'Luis', isBot: false, championId: 'vex', side: 0,
      level: 11, kills: 5, deaths: 3, assists: 8, cs: 120, gold: 800, items: ['a', null], totals: TOTALS,
    });
  });

  test('a bot has no account (even if one was known for its id) and no name', () => {
    expect(record.players[1]).toMatchObject({ playerId: 'bot-1', isBot: true, accountId: null, name: null, championId: 'gorath' });
  });

  test("a guest keeps the name it typed; one with none, null", () => {
    expect(record.players[2]).toMatchObject({ accountId: null, name: 'Pepe', isBot: false });
    expect(record.players[3]).toMatchObject({ accountId: null, name: null, isBot: false });
  });

  test('a champion whose player is unknown is kept as a bot (never as someone)', () => {
    const lonely = matchRecordOf({
      stats: [stats('who', 0)], players: [], accountOf: () => 3,
      mapId: 'vale', mode: 'queue', practice: false, duration: 1, winningSide: 0,
    });
    expect(lonely.players[0]).toMatchObject({ playerId: 'who', isBot: true, accountId: null, name: null });
  });
});
