/**
 * An ability event from something this client never had (an enemy's
 * stealthed trap springing or bursting) still shows where it happened: the
 * server tells the place (x, y), and its look and sound play there.
 */
import { describe, it, expect, afterEach } from 'bun:test';
import { GameEventType } from '@siege/shared';
import { OnlineStateManager } from '@/core/OnlineStateManager';
import { getVFXManager, resetVFXManager } from '@/vfx';
import { getAudio } from '@/audio/AudioManager';

function manager(): OnlineStateManager {
  return new OnlineStateManager({
    gameId: 'game',
    yourSide: 1,
    yourPlayerId: 'player-local',
    players: [{ playerId: 'player-local', championId: 'warrior', side: 1, entityId: 'champ-local' }],
  });
}

function recordSpawns(state: OnlineStateManager) {
  const spawned: { abilityId: string; x: number; y: number }[] = [];
  const vfx = getVFXManager(state);
  vfx.spawnAbilityVFX = ((abilityId: string, x: number, y: number) => { spawned.push({ abilityId, x, y }); }) as typeof vfx.spawnAbilityVFX;
  return spawned;
}

function recordSounds() {
  const played: { sound: string; where?: { x: number; y: number } }[] = [];
  const audio = getAudio();
  audio.play = ((sound: string, where?: { x: number; y: number }) => { played.push({ sound, where }); return null; }) as typeof audio.play;
  return played;
}

describe('ability events from unseen casters', () => {
  afterEach(() => resetVFXManager());

  for (const abilityId of ['vile_trap_trigger', 'vile_trap_explosion']) {
    it(`${abilityId} from a trap this client never saw plays where it was`, () => {
      const state = manager();
      const spawned = recordSpawns(state);
      const played = recordSounds();
      state.processStateUpdate({
        tick: 1, timestamp: Date.now(), gameTime: 1, deltas: [],
        events: [{ type: GameEventType.ABILITY_CAST, timestamp: 1, data: { entityId: 'trap-unseen', abilityId, x: 300, y: 200 } }],
      } as never);
      expect(spawned).toContainEqual({ abilityId, x: 300, y: 200 });
      expect(played.some(sound => sound.sound === abilityId && sound.where?.x === 300 && sound.where?.y === 200)).toBe(true);
    });
  }

  it('an event from an unseen caster with no place shows nothing', () => {
    const state = manager();
    const spawned = recordSpawns(state);
    state.processStateUpdate({
      tick: 1, timestamp: Date.now(), gameTime: 1, deltas: [],
      events: [{ type: GameEventType.ABILITY_CAST, timestamp: 1, data: { entityId: 'someone-unseen', abilityId: 'magnus_fireball' } }],
    } as never);
    expect(spawned).toHaveLength(0);
  });
});
