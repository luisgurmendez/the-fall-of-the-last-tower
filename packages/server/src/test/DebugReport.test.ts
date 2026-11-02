/**
 * The debug overlay's DEBUG_STATE: what the server thinks about each unit
 * (DebugReport, ServerEntity.debugInfo), and that only practice matches send it.
 */
import { describe, test, expect } from 'bun:test';
import { CHAMPION_DEFINITIONS, Vector, TEAM_RED, type ChampionDefinition, type DebugStateData } from '@siege/shared';
import { ServerGameContext } from '../game/ServerGameContext';
import { buildDebugState } from '../game/DebugReport';
import { GameRoom } from '../game/GameRoom';
import { ServerTower } from '../simulation/ServerTower';
import { ServerMinion } from '../simulation/ServerMinion';
import { ServerJungleCreature } from '../simulation/ServerJungleCreature';
import { TestChampion } from './ServerTestUtils';

describe('Debug report', () => {
  function scene() {
    const context = new ServerGameContext({ gameId: 'debug-test' });
    const tower = new ServerTower({ id: 'tower', position: new Vector(0, 0), side: 0, lane: 'mid', tier: 1 });
    const minion = new ServerMinion({
      id: 'minion', position: new Vector(150, 0), side: 1, minionType: 'melee', lane: 'mid', waypoints: [],
    });
    const champion = new TestChampion({
      id: 'champion', position: new Vector(250, 0), side: TEAM_RED, playerId: 'bot-player',
      definition: CHAMPION_DEFINITIONS['warrior'],
    });
    const creature = new ServerJungleCreature({
      id: 'creature', position: new Vector(-2000, 0), campId: 'camp', creatureType: 'thornspitter',
      homePosition: new Vector(-2000, 0),
    });
    for (const entity of [tower, minion, champion, creature]) context.addEntity(entity);
    return { context, tower, minion, champion, creature };
  }

  test('each unit says what it is doing', () => {
    const { context, tower, champion } = scene();
    tower.triggerAggro('champion');
    tower.update(0.1, context);
    champion.abilityRanks.Q = 1;
    context.moveChampion(champion, new Vector(600, 300));

    const report = buildDebugState(context.getAllEntities(), context, 9, id => id === 'bot-player' ? 'farm' : undefined);
    const unit = (id: string) => report.units.find(u => u.entityId === id)!;

    expect(report.tick).toBe(9);
    expect(unit('tower')).toMatchObject({ state: 'shooting', targetId: 'champion' });
    expect(unit('tower').notes).toContainEqual(expect.stringContaining('aggro on champion'));

    expect(unit('minion')).toMatchObject({ state: 'walking the lane', targetId: null });
    expect(unit('minion').attackRange).toBeGreaterThan(0);

    expect(unit('champion').state).toBe('bot: farm (walking)');
    expect(unit('champion').path!.at(-1)).toEqual({ x: 600, y: 300 });
    expect(unit('champion').abilities!.map(a => a.slot)).toEqual(['Q']);

    expect(unit('creature').state).toBe('idle');
    expect(unit('creature').leash).toMatchObject({ x: -2000, y: 0 });
  });

  test('only practice matches send it, to players who turn it on', () => {
    const definitions = new Map<string, ChampionDefinition>(Object.entries(CHAMPION_DEFINITIONS));
    const players = [
      { playerId: 'human', side: 0 as const, championId: 'vex', connected: true },
      { playerId: 'other', side: 1 as const, championId: 'vile', connected: true },
    ];
    const ranked = new GameRoom({ gameId: 'ranked', players, championDefinitions: definitions });
    expect(ranked.setDebug('human', true)).toBe(false);

    const sent: Array<[string, DebugStateData]> = [];
    const practice = new GameRoom({
      gameId: 'practice', players, championDefinitions: definitions, allowDebug: true,
      onStateUpdate: () => {},
      onDebugState: (playerId, data) => sent.push([playerId, data]),
    });
    practice.start();
    try {
      expect(practice.setDebug('human', true)).toBe(true);
      const broadcast = (tick: number) => (practice as unknown as { broadcastState(tick: number): void }).broadcastState(tick);
      broadcast(3);
      expect(sent.map(([playerId]) => playerId)).toEqual(['human']);
      // Its own champion is in it
      expect(sent[0][1].units.some(unit => unit.state === 'idle' && unit.abilities)).toBe(true);

      // Not every broadcast, and not after it's turned off
      broadcast(4);
      practice.setDebug('human', false);
      broadcast(6);
      expect(sent).toHaveLength(1);
    } finally {
      practice.stop();
    }
  });
});
