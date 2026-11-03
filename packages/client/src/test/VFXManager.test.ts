/**
 * VFXManager scheduling: effects of a delayed phase, including their
 * one-shot particles, start when the phase does, not when the ability is
 * cast; a caster's pending effects can be cancelled (a monster dying
 * mid-wind-up); and a shield bubble lasts as long as its shield does.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { VFXManager } from '@/vfx/VFXManager';
import { registerAbilityVFX } from '@/vfx/VFXRegistryStore';
import type { OnlineStateManager } from '@/core/OnlineStateManager';

const TEST_VFX = 'test_delayed_burst';

registerAbilityVFX({
  abilityId: TEST_VFX,
  phases: [
    {
      name: 'later',
      delay: 0.5,
      duration: 0.5,
      anchor: 'caster',
      effects: [
        {
          type: 'particle_burst',
          count: 10,
          color: '#ffffff',
          size: { min: 1, max: 2 },
          speed: { min: 10, max: 20 },
          lifetime: { min: 1, max: 1 },
          spread: Math.PI * 2,
        },
      ],
    },
  ],
});

describe('VFXManager', () => {
  let clock = 0;
  const realNow = performance.now.bind(performance);

  beforeEach(() => {
    clock = 1000;
    performance.now = () => clock;
  });
  afterEach(() => {
    performance.now = realNow;
  });

  it("spawns a delayed phase's particles when the phase starts", () => {
    const manager = new VFXManager({ getEntity: () => undefined } as unknown as OnlineStateManager);
    manager.spawnAbilityVFX(TEST_VFX, 0, 0);
    expect(manager.getStats().activeParticles).toBe(0);

    clock += 300;
    manager.update(0.3);
    expect(manager.getStats().activeParticles).toBe(0);

    clock += 300;
    manager.update(0.3);
    expect(manager.getStats().activeParticles).toBe(10);
  });

  it("cancels a caster's effects that haven't started", () => {
    const manager = new VFXManager({ getEntity: () => undefined } as unknown as OnlineStateManager);
    // The particle pool is shared, so count from here
    const particlesBefore = manager.getStats().activeParticles;
    manager.spawnAbilityVFX(TEST_VFX, 0, 0, undefined, undefined, 'monster-1');
    manager.spawnAbilityVFX(TEST_VFX, 0, 0, undefined, undefined, 'monster-2');
    expect(manager.getStats().activeEffects).toBe(2);

    manager.cancelCasterEffects('monster-1');
    clock += 600;
    manager.update(0.6);

    expect(manager.getStats().activeEffects).toBe(1);
    expect(manager.getStats().activeParticles - particlesBefore).toBe(10);
  });

  describe('shield bubbles', () => {
    /** A state manager whose champion has the shields given (by source) */
    function withShields(shields: { current: string[] }) {
      return {
        getEntity: (id: string) => id === 'kael'
          ? { position: { x: 0, y: 0 }, snapshot: { entityId: 'kael', shields: shields.current.map(sourceId => ({ sourceId, amount: 50, remainingDuration: 2, shieldType: 'normal' })) } }
          : undefined,
      } as unknown as OnlineStateManager;
    }

    it('goes away when its shield breaks, before its time is up', () => {
      const shields = { current: ['warrior_shield'] };
      const manager = new VFXManager(withShields(shields));
      manager.spawnAbilityVFX('warrior_shield', 0, 0, undefined, undefined, 'kael');
      manager.update(0.016);
      expect(manager.getStats().activeShields).toBe(1);

      clock += 500;
      manager.update(0.5);
      expect(manager.getStats().activeShields).toBe(1);

      shields.current = [];
      clock += 100;
      manager.update(0.1);
      expect(manager.getStats().activeShields).toBe(0);
    });

    it("stays while its shield holds, and lasts no longer than its time", () => {
      const shields = { current: ['warrior_shield'] };
      const manager = new VFXManager(withShields(shields));
      manager.spawnAbilityVFX('warrior_shield', 0, 0, undefined, undefined, 'kael');
      clock += 2000;
      manager.update(2);
      expect(manager.getStats().activeShields).toBe(1);
      clock += 2000;
      manager.update(2);
      expect(manager.getStats().activeShields).toBe(0);
    });

    it("waits a moment for the shield to show up in the champion's state", () => {
      const shields = { current: [] as string[] };
      const manager = new VFXManager(withShields(shields));
      manager.spawnAbilityVFX('warrior_shield', 0, 0, undefined, undefined, 'kael');
      clock += 100;
      manager.update(0.1);
      expect(manager.getStats().activeShields).toBe(1);
      shields.current = ['warrior_shield'];
      clock += 400;
      manager.update(0.4);
      expect(manager.getStats().activeShields).toBe(1);
    });

    it("a bubble that isn't a shield's (Gorath's Fortify, armor) lasts its time", () => {
      const manager = new VFXManager(withShields({ current: [] }));
      manager.spawnAbilityVFX('gorath_fortify', 0, 0, undefined, undefined, 'kael');
      clock += 2000;
      manager.update(2);
      expect(manager.getStats().activeShields).toBe(1);
    });
  });
});
