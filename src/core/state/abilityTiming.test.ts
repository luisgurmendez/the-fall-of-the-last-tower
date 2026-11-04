import { describe, expect, it } from 'vitest';
import { getAbilityDefinition, getCastTime } from '@siege/shared';
import { abilityImpactTime, animationImpactTime } from './abilityTiming';

describe('animationImpactTime', () => {
  it('an ability with a cast time: its animation starts at the windup, so the blow comes after the cast time and the delay', () => {
    // Gorath's slam: he winds up standing, then the hammer falls
    const slam = getAbilityDefinition('gorath_slam')!;
    expect(getCastTime(slam)).toBeGreaterThan(0);
    expect(animationImpactTime('gorath_slam')).toBeCloseTo(getCastTime(slam) + slam.aoeDelay!, 5);
  });

  it('an instant ability: the same as from its cast', () => {
    const shield = getAbilityDefinition('warrior_shield')!;
    expect(getCastTime(shield)).toBe(0);
    expect(animationImpactTime('warrior_shield')).toBeCloseTo(abilityImpactTime('warrior_shield'), 5);
  });

  it('a skillshot: the throw on its animation keyframe, counted from the windup', () => {
    const fireball = getAbilityDefinition('magnus_fireball')!;
    expect(animationImpactTime('magnus_fireball')).toBeCloseTo(getCastTime(fireball) + abilityImpactTime('magnus_fireball'), 5);
  });

  it('an unknown ability: at once', () => {
    expect(animationImpactTime('nothing_at_all')).toBeCloseTo(abilityImpactTime('nothing_at_all'), 5);
  });
});
