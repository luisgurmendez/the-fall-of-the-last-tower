/**
 * VFXManager scheduling: effects of a delayed phase, including their
 * one-shot particles, start when the phase does, not when the ability is cast.
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
});
