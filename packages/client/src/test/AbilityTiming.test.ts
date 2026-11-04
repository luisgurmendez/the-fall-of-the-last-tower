/**
 * When abilities take effect on the client (src/core/state/abilityTiming.ts)
 * against the server: a projectile is thrown when its cast time ends (the
 * ABILITY_CAST), so its throw plays then, its gathering plays in the cast
 * time (its `_windup` VFX); a leap's blow and Lume's orb arriving play at
 * their own events (`<id>_land`, `lume_q_arrive`), when they really happen.
 */
import { describe, it, expect } from 'bun:test';
import { CHAMPION_DEFINITIONS, getAbilityDefinition, getCastTime } from '@siege/shared';
import { abilityImpactTime } from '@/core/state/abilityTiming';
import { getAbilityVFX } from '@/vfx/VFXRegistryStore';
import '@/vfx/VFXRegistry';
import { ABILITY_CUES } from '@/audio/abilitySounds';

/** When the server throws a skillshot's projectile after the cast (packages/server generic/Skillshot.ts) */
function serverThrowDelay(abilityId: string): number {
  for (const champion of Object.values(CHAMPION_DEFINITIONS)) {
    const animation = champion.animations?.abilities?.[abilityId];
    const keyframe = animation?.keyframes.find(k => k.trigger.type === 'projectile');
    if (keyframe) return Math.max(0, keyframe.frame * animation!.baseFrameDuration - getCastTime(getAbilityDefinition(abilityId)!));
  }
  return 0;
}

const SKILLSHOTS = ['magnus_fireball', 'vex_shuriken', 'vile_black_arrows', 'elora_w', 'caelum_q', 'protobot_q'];

describe('ability timing', () => {
  it('a projectile with a cast time is thrown at its cast, as on the server', () => {
    for (const abilityId of SKILLSHOTS) {
      expect({ abilityId, at: abilityImpactTime(abilityId) }).toEqual({ abilityId, at: serverThrowDelay(abilityId) });
    }
  });

  it("the projectiles' gathering plays in their cast time", () => {
    for (const abilityId of ['magnus_fireball', 'vex_shuriken', 'vile_black_arrows', 'elora_w', 'caelum_q']) {
      expect({ abilityId, windup: getAbilityVFX(`${abilityId}_windup`) !== undefined }).toEqual({ abilityId, windup: true });
    }
  });

  it("a leap's blow plays when it lands (Kip's Grand Entrance too), and Lume's orb when it arrives", () => {
    for (const abilityId of ['warrior_ultimate_land', 'uruk_r_land', 'fenris_e_land', 'lume_q_arrive', 'kip_e_land']) {
      // (Fenris's one sound is the whole pounce, whoosh to thud, from the cast)
      const sound = abilityId !== 'fenris_e_land';
      expect({ abilityId, vfx: getAbilityVFX(abilityId) !== undefined, sound: (ABILITY_CUES[abilityId]?.length ?? 0) > 0 })
        .toEqual({ abilityId, vfx: true, sound });
    }
    // ...not at a fixed time after the cast
    for (const abilityId of ['warrior_ultimate', 'uruk_r', 'fenris_e', 'lume_q', 'kip_e']) {
      const cues = ABILITY_CUES[abilityId] ?? [];
      expect({ abilityId, delayed: cues.some(cue => (cue.delay ?? 0) > 0) }).toEqual({ abilityId, delayed: false });
      const phases = getAbilityVFX(abilityId)?.phases ?? [];
      expect({ abilityId, delayed: phases.some(phase => phase.delay > 0) }).toEqual({ abilityId, delayed: false });
    }
  });
});
