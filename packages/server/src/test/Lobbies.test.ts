/**
 * Rooms (LobbyManager): creating and joining by code, sides, the host's
 * settings, leaving, and the match a room starts (buildLobbyMatch).
 */

import { describe, test, expect } from 'bun:test';
import { CHAMPION_DEFINITIONS } from '@siege/shared';
import { LobbyManager, normalizeCode, sanitizeName, type Lobby } from '../game/LobbyManager';
import { buildLobbyMatch } from '../bots/practiceMatch';

const player = (playerId: string, championId = 'warrior') => ({ playerId, name: playerId, championId, summonerSpells: ['blink', 'mend'] as const });

function seeded(seed = 1) {
  return () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
}

describe('LobbyManager', () => {
  test('a room has a 5-letter code, its creator hosts, on blue', () => {
    const lobbies = new LobbyManager(seeded());
    const lobby = lobbies.create({ ...player('ana'), summonerSpells: ['blink', 'mend'] });
    expect(lobby.code).toMatch(/^[A-Z2-9]{5}$/);
    expect(lobby.hostId).toBe('ana');
    expect(lobby.members.map(m => [m.playerId, m.side])).toEqual([['ana', 0]]);
    expect(LobbyManager.stateOf(lobby)).toMatchObject({ code: lobby.code, hostId: 'ana', mapId: 'vale', teamSize: 3 });
  });

  test('friends join by code (typed any way), on the side with fewer players', () => {
    const lobbies = new LobbyManager(seeded());
    const { code } = lobbies.create({ ...player('ana'), summonerSpells: [] });
    const joined = lobbies.join(` ${code.toLowerCase()} `, { ...player('bo'), summonerSpells: [] }) as Lobby;
    lobbies.join(code, { ...player('cy'), summonerSpells: [] });
    expect(joined.members.map(m => [m.playerId, m.side])).toEqual([['ana', 0], ['bo', 1], ['cy', 0]]);
    expect(lobbies.join('NOPE1', { ...player('dee'), summonerSpells: [] })).toBe('lobby_not_found');
  });

  test('a room holds ten players', () => {
    const lobbies = new LobbyManager(seeded());
    const { code } = lobbies.create({ ...player('p0'), summonerSpells: [] });
    for (let i = 1; i < 10; i++) expect(typeof lobbies.join(code, { ...player(`p${i}`), summonerSpells: [] })).toBe('object');
    expect(lobbies.join(code, { ...player('p10'), summonerSpells: [] })).toBe('lobby_full');
    // Ten players: five a side
    expect(lobbies.lobbyOf('p0')!.teamSize).toBe(5);
  });

  test('switching sides, and the size grows to fit the players', () => {
    const lobbies = new LobbyManager(seeded());
    const { code } = lobbies.create({ ...player('ana'), summonerSpells: [] });
    lobbies.join(code, { ...player('bo'), summonerSpells: [] });
    const lobby = lobbies.settings('ana', { teamSize: 1 })!;
    expect(lobby.teamSize).toBe(1);
    lobbies.switchSide('bo');
    expect(lobby.members.map(m => m.side)).toEqual([0, 0]);
    expect(lobby.teamSize).toBe(3);
  });

  test("a champion a teammate plays can't be picked; an enemy's can", () => {
    const lobbies = new LobbyManager(seeded());
    const { code } = lobbies.create({ ...player('ana', 'lume'), summonerSpells: [] });
    lobbies.join(code, { ...player('bo', 'vex'), summonerSpells: [] });
    lobbies.join(code, { ...player('cy', 'elara'), summonerSpells: [] });
    // cy is on blue with ana
    lobbies.update('cy', 'lume');
    expect(lobbies.lobbyOf('cy')!.members.find(m => m.playerId === 'cy')!.championId).toBe('elara');
    lobbies.update('cy', 'vex', ['blink', 'mend']);
    const cy = lobbies.lobbyOf('cy')!.members.find(m => m.playerId === 'cy')!;
    expect(cy.championId).toBe('vex');
    expect(cy.summonerSpells).toEqual(['blink', 'mend']);
  });

  test('only the host changes settings; the size never drops below a side', () => {
    const lobbies = new LobbyManager(seeded());
    const { code } = lobbies.create({ ...player('ana'), summonerSpells: [] });
    lobbies.join(code, { ...player('bo'), summonerSpells: [] });
    lobbies.switchSide('bo');
    lobbies.settings('bo', { mapId: 'narrows' });
    expect(lobbies.lobbyOf('ana')!.mapId).toBe('vale');
    lobbies.settings('ana', { mapId: 'narrows', teamSize: 1 });
    expect(lobbies.lobbyOf('ana')!.mapId).toBe('narrows');
    expect(lobbies.lobbyOf('ana')!.teamSize).toBe(3);
    lobbies.settings('ana', { mapId: 'nowhere', teamSize: 4 });
    expect(lobbies.lobbyOf('ana')).toMatchObject({ mapId: 'narrows', teamSize: 3 });
  });

  test('when the host leaves the next player hosts; an empty room is gone', () => {
    const lobbies = new LobbyManager(seeded());
    const { code } = lobbies.create({ ...player('ana'), summonerSpells: [] });
    lobbies.join(code, { ...player('bo'), summonerSpells: [] });
    expect(lobbies.leave('ana')!.hostId).toBe('bo');
    lobbies.leave('bo');
    expect(lobbies.size).toBe(0);
    expect(lobbies.join(code, { ...player('cy'), summonerSpells: [] })).toBe('lobby_not_found');
  });

  test('only the host starts, and the room becomes the match', () => {
    const lobbies = new LobbyManager(seeded());
    const { code } = lobbies.create({ ...player('ana'), summonerSpells: [] });
    lobbies.join(code, { ...player('bo'), summonerSpells: [] });
    expect(lobbies.start('bo')).toBeNull();
    expect(lobbies.start('ana')?.code).toBe(code);
    expect(lobbies.lobbyOf('ana')).toBeNull();
    expect(lobbies.size).toBe(0);
  });

  test('names and codes are cleaned up', () => {
    expect(sanitizeName('  Luis <script>  ')).toBe('Luis script');
    expect(sanitizeName('a'.repeat(30))).toHaveLength(16);
    expect(sanitizeName(42)).toBe('Player');
    expect(normalizeCode(' ab 3cd ')).toBe('AB3CD');
  });
});

describe('buildLobbyMatch', () => {
  const champions = [...Object.keys(CHAMPION_DEFINITIONS)];

  test('fills each side up to the size with bots: the jungle and support first', () => {
    const { players, bots } = buildLobbyMatch({
      humans: [
        { playerId: 'ana', side: 0, championId: 'lume', summonerSpells: ['blink', 'mend'] },
        { playerId: 'bo', side: 0, championId: 'elora', summonerSpells: ['blink', 'mend'] },
        { playerId: 'cy', side: 1, championId: 'vex', summonerSpells: ['blink', 'mend'] },
      ],
      teamSize: 5,
      champions,
      matchId: 'ROOM1',
      random: seeded(3),
    });
    expect(players.filter(p => p.side === 0)).toHaveLength(5);
    expect(players.filter(p => p.side === 1)).toHaveLength(5);
    expect(bots).toHaveLength(7);
    const blueBots = players.filter(p => p.side === 0 && p.isBot).map(p => p.playerId);
    expect(blueBots).toEqual(['bot-ROOM1-blue-jungle', 'bot-ROOM1-blue-support', 'bot-ROOM1-blue-top']);
    // No champion twice on a side
    for (const side of [0, 1]) {
      const picks = players.filter(p => p.side === side).map(p => p.championId);
      expect(new Set(picks).size).toBe(picks.length);
    }
  });

  test('a full room has no bots', () => {
    const { bots } = buildLobbyMatch({
      humans: [
        { playerId: 'ana', side: 0, championId: 'lume', summonerSpells: [] },
        { playerId: 'bo', side: 1, championId: 'vex', summonerSpells: [] },
      ],
      teamSize: 1,
      champions,
      matchId: 'ROOM2',
    });
    expect(bots).toHaveLength(0);
  });
});
