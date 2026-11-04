/**
 * Fear: a feared unit runs straight away from whoever scared it (the fear's
 * source) for the fear's duration, and does nothing else.
 * - A champion can't attack, cast or use summoner spells, and orders to move,
 *   attack or recall are overruled; an ability in its cast time and a recall
 *   are interrupted. When it ends, the champion stands where the fear left it
 * - It runs from where the source is now; a source that's dead or gone
 *   leaves it running the way it was going
 * - Tenacity shortens it (it's crowd control, not a displacement)
 * - Minions and jungle monsters run the same way and don't attack meanwhile
 */

import { describe, test, expect } from 'bun:test';
import { Vector, TEAM_BLUE, TEAM_RED, InputType, type AbilitySlot } from '@siege/shared';
import { createTestArena, type TestArena } from './ServerTestUtils';
import { InputHandler } from '../network/InputHandler';

const FRAMES_PER_SECOND = 60;

/** Kael (red) at (100, 0), feared by Magnus (blue) at (0, 0) for `duration` */
function fearKael(duration = 1): TestArena {
  const arena = createTestArena({
    blueChampion: 'magnus',
    redChampion: 'warrior',
    bluePosition: new Vector(0, 0),
    redPosition: new Vector(100, 0),
  });
  arena.red.setLevel(6);
  arena.red.setResource(arena.red.maxResource);
  arena.red.applyEffect('fear', duration, arena.blue.id);
  return arena;
}

describe('Fear', () => {
  describe('a feared champion', () => {
    test('BUG: is feared (the effect exists and sets its status)', () => {
      const arena = fearKael();
      expect(arena.red.hasEffect('fear')).toBe(true);
      expect(arena.red.ccStatus.isFeared).toBe(true);
      expect(arena.red.ccStatus.canAttack).toBe(false);
      expect(arena.red.ccStatus.canCast).toBe(false);
      expect(arena.red.ccStatus.canUseMobilityAbilities).toBe(false);
    });

    test('BUG: runs straight away from whoever scared it', () => {
      const arena = fearKael();
      const speed = arena.red.getStats().movementSpeed;
      arena.tickFrames(0.5 * FRAMES_PER_SECOND);
      // Away along +x, at about its speed
      expect(arena.red.position.x).toBeGreaterThan(100 + speed * 0.5 * 0.8);
      expect(Math.abs(arena.red.position.y)).toBeLessThan(5);
    });

    test('BUG: an order to walk back is overruled', () => {
      const arena = fearKael();
      arena.tick();
      arena.red.setMoveTarget(new Vector(-500, 0));
      const x = arena.red.position.x;
      arena.tickFrames(10);
      expect(arena.red.position.x).toBeGreaterThan(x);
    });

    test("BUG: drops its attack target and doesn't attack", () => {
      const arena = fearKael();
      arena.red.setAttackTarget(arena.blue.id);
      let attacked = false;
      const takeDamage = arena.blue.takeDamage.bind(arena.blue);
      arena.blue.takeDamage = ((...args: Parameters<typeof takeDamage>) => {
        if (args[2] === arena.red.id) attacked = true;
        return takeDamage(...args);
      }) as typeof takeDamage;
      arena.tickFrames(0.9 * FRAMES_PER_SECOND);
      expect(attacked).toBe(false);
      expect(arena.red.targetEntityId).toBeNull();
    });

    test("BUG: can't cast abilities (nothing spent)", () => {
      const arena = fearKael();
      const mana = arena.red.resource;
      for (const slot of ['Q', 'W', 'E'] as AbilitySlot[]) {
        const result = arena.castAbility(arena.red, slot, { targetPosition: new Vector(0, 0) });
        expect(result.success).toBe(false);
        expect(result.failReason).toBe('feared');
      }
      expect(arena.red.resource).toBe(mana);
    });

    test("BUG: can't use summoner spells", () => {
      const arena = fearKael();
      arena.red.summoners.set(['blink', 'haste']);
      const at = arena.red.position.clone();
      expect(arena.red.summoners.cast(0, { x: -600, y: 0 }, arena.context)).toBe(false);
      expect(arena.red.summoners.cast(1, {}, arena.context)).toBe(false);
      expect(arena.red.position.distanceTo(at)).toBeLessThan(1);
    });

    test('BUG: a cast in its cast time is interrupted', () => {
      const arena = createTestArena({
        blueChampion: 'warrior',
        redChampion: 'magnus',
        bluePosition: new Vector(0, 0),
        redPosition: new Vector(100, 0),
      });
      expect(arena.castAbility(arena.red, 'Q', { targetPosition: new Vector(600, 0), casting: true }).success).toBe(true);
      expect(arena.red.isCasting()).toBe(true);
      arena.red.applyEffect('fear', 1, arena.blue.id);
      arena.tick();
      expect(arena.red.isCasting()).toBe(false);
      expect(arena.red.getAbilityCooldown('Q')).toBe(0);
    });

    test('BUG: a recall is interrupted', () => {
      const arena = createTestArena({ blueChampion: 'magnus', redChampion: 'warrior', redPosition: new Vector(100, 0) });
      arena.red.startRecall();
      expect(arena.red.isRecalling).toBe(true);
      arena.red.applyEffect('fear', 1, arena.blue.id);
      arena.tick();
      expect(arena.red.isRecalling).toBe(false);
    });

    test('BUG: the input handler ignores its move, attack, cast and recall orders', () => {
      const arena = fearKael();
      const handler = new InputHandler();
      arena.tick();
      const x = arena.red.position.x;
      handler.queueInput(arena.red.playerId, { type: InputType.MOVE, seq: 1, clientTime: 0, targetX: -800, targetY: 0 } as never);
      handler.queueInput(arena.red.playerId, { type: InputType.TARGET_UNIT, seq: 2, clientTime: 0, targetEntityId: arena.blue.id } as never);
      handler.queueInput(arena.red.playerId, { type: InputType.RECALL, seq: 3, clientTime: 0 } as never);
      handler.processInputs(arena.context);
      arena.tickFrames(10);
      expect(arena.red.position.x).toBeGreaterThan(x);
      expect(arena.red.isRecalling).toBe(false);
      expect(arena.red.targetEntityId).toBeNull();
    });

    test('BUG: runs from where its source is now', () => {
      const arena = fearKael();
      arena.tick();
      // Magnus walks around to its other side: it turns and runs back
      arena.blue.position.setFrom(new Vector(arena.red.position.x + 100, 0));
      const x = arena.red.position.x;
      arena.tickFrames(15);
      expect(arena.red.position.x).toBeLessThan(x);
    });

    test('BUG: with its source dead, it keeps running the way it was going', () => {
      const arena = fearKael();
      arena.tickFrames(10);
      arena.blue.takeDamage(1e9, 'true');
      const x = arena.red.position.x;
      arena.tickFrames(15);
      expect(arena.red.hasEffect('fear')).toBe(true);
      expect(arena.red.position.x).toBeGreaterThan(x + 5);
    });

    test('BUG: when it ends, it stands still and can act again', () => {
      const arena = fearKael(0.5);
      arena.tickFrames(0.5 * FRAMES_PER_SECOND + 2);
      expect(arena.red.hasEffect('fear')).toBe(false);
      expect(arena.red.ccStatus.isFeared).toBe(false);
      const x = arena.red.position.x;
      arena.tickFrames(20);
      expect(arena.red.position.x).toBeCloseTo(x, 0);
      expect(arena.castAbility(arena.red, 'W').success).toBe(true);
    });

    test('BUG: tenacity shortens it', () => {
      const arena = createTestArena({ blueChampion: 'magnus', redChampion: 'warrior', redPosition: new Vector(100, 0) });
      arena.red.addModifier({ source: 'test-tenacity', flat: { tenacity: 0.5 } });
      arena.red.applyEffect('fear', 1, arena.blue.id);
      expect(arena.red.getEffect('fear')!.timeRemaining).toBeCloseTo(0.5, 5);
    });
  });

  describe('a feared minion', () => {
    test('BUG: runs away from its source and lands no attack', () => {
      const arena = createTestArena({ blueChampion: 'magnus', redChampion: 'warrior', redPosition: new Vector(3000, 3000) });
      const scared = arena.addMinion(TEAM_RED, new Vector(40, 0));
      const victim = arena.addMinion(TEAM_BLUE, new Vector(60, 0));
      arena.context.getFogOfWar().updateVision(arena.context, 2);
      scared.applyEffect('fear', 1, arena.blue.id);
      const victimHealth = victim.health;
      arena.tickAllFrames(0.9 * FRAMES_PER_SECOND);
      expect(scared.position.x).toBeGreaterThan(40 + 30);
      expect(victim.health).toBe(victimHealth);
      expect(scared.toSnapshot().isFeared).toBe(true);
    });

    test('BUG: fights again once it ends', () => {
      const arena = createTestArena({ blueChampion: 'magnus', redChampion: 'warrior', redPosition: new Vector(3000, 3000) });
      const scared = arena.addMinion(TEAM_RED, new Vector(40, 0));
      const victim = arena.addMinion(TEAM_BLUE, new Vector(70, 0));
      arena.context.getFogOfWar().updateVision(arena.context, 2);
      scared.applyEffect('fear', 0.3, arena.blue.id);
      arena.tickAllFrames(4 * FRAMES_PER_SECOND);
      expect(victim.health).toBeLessThan(victim.maxHealth);
    });
  });

  describe('a feared jungle monster', () => {
    test('BUG: runs away from its source and lands no attack', () => {
      const arena = createTestArena({ blueChampion: 'magnus', redChampion: 'warrior', redPosition: new Vector(3000, 3000) });
      const monster = arena.addJungleCreature(new Vector(80, 0));
      // It's fighting Magnus, then scared off
      monster.takeDamage(1, 'physical', arena.blue.id, arena.context);
      arena.tickAllFrames(5);
      monster.applyEffect('fear', 1.2, arena.blue.id);
      const x = monster.position.x;
      // A shot it loosed before the fear may still land
      arena.tickAllFrames(0.4 * FRAMES_PER_SECOND);
      const health = arena.blue.health;
      arena.tickAllFrames(0.7 * FRAMES_PER_SECOND);
      expect(monster.position.x).toBeGreaterThan(x + 20);
      // (Magnus regenerates meanwhile)
      expect(arena.blue.health).toBeGreaterThanOrEqual(health);
    });
  });
});
