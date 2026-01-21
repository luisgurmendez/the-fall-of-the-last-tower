/**
 * Tests for server-side effect definitions.
 */

import { describe, test, expect } from 'bun:test';
import {
  ALL_SERVER_EFFECTS,
  getServerEffectById,
  isCCEffect,
  isStatEffect,
  isOverTimeEffect,
  isShieldEffect,
  StunEffect,
  SilenceEffect,
  RootEffect,
  SlowEffect,
  BurnEffect,
  PoisonEffect,
  AttackSpeedBuff,
  ArmorReduction,
  type ServerCCEffectDef,
  type ServerStatEffectDef,
  type ServerOverTimeEffectDef,
} from '../data/effects';

describe('Effect Definitions', () => {
  test('all effects have unique IDs', () => {
    const ids = ALL_SERVER_EFFECTS.map(effect => effect.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test('all effects have required fields', () => {
    for (const effect of ALL_SERVER_EFFECTS) {
      expect(effect.id).toBeTruthy();
      expect(effect.name).toBeTruthy();
      expect(effect.category).toBeTruthy();
      expect(effect.stackBehavior).toBeTruthy();
      expect(typeof effect.cleansable).toBe('boolean');
      expect(typeof effect.persistsThroughDeath).toBe('boolean');
    }
  });

  test('stackable effects have maxStacks defined', () => {
    for (const effect of ALL_SERVER_EFFECTS) {
      if (effect.stackBehavior === 'stack') {
        expect(effect.maxStacks).toBeGreaterThan(0);
      }
    }
  });
});

describe('getServerEffectById', () => {
  test('returns effect by ID', () => {
    const stun = getServerEffectById('stun');
    expect(stun).toBeDefined();
    expect(stun?.name).toBe('Stunned');
  });

  test('returns undefined for unknown ID', () => {
    const unknown = getServerEffectById('unknown_effect');
    expect(unknown).toBeUndefined();
  });

  test('all registered effects are retrievable', () => {
    for (const effect of ALL_SERVER_EFFECTS) {
      const retrieved = getServerEffectById(effect.id);
      expect(retrieved).toBe(effect);
    }
  });
});

describe('Effect Type Guards', () => {
  describe('isCCEffect', () => {
    test('returns true for CC effects', () => {
      expect(isCCEffect(StunEffect)).toBe(true);
      expect(isCCEffect(SilenceEffect)).toBe(true);
      expect(isCCEffect(RootEffect)).toBe(true);
      expect(isCCEffect(SlowEffect)).toBe(true);
    });

    test('returns false for non-CC effects', () => {
      expect(isCCEffect(BurnEffect)).toBe(false);
      expect(isCCEffect(AttackSpeedBuff)).toBe(false);
    });
  });

  describe('isStatEffect', () => {
    test('returns true for stat effects', () => {
      expect(isStatEffect(AttackSpeedBuff)).toBe(true);
      expect(isStatEffect(ArmorReduction)).toBe(true);
    });

    test('returns false for non-stat effects', () => {
      expect(isStatEffect(StunEffect)).toBe(false);
      expect(isStatEffect(BurnEffect)).toBe(false);
    });
  });

  describe('isOverTimeEffect', () => {
    test('returns true for over-time effects', () => {
      expect(isOverTimeEffect(BurnEffect)).toBe(true);
      expect(isOverTimeEffect(PoisonEffect)).toBe(true);
    });

    test('returns false for non-over-time effects', () => {
      expect(isOverTimeEffect(StunEffect)).toBe(false);
      expect(isOverTimeEffect(AttackSpeedBuff)).toBe(false);
    });
  });
});

describe('CC Effects', () => {
  test('stun prevents all actions', () => {
    const stun = getServerEffectById('stun') as ServerCCEffectDef;
    expect(stun.ccType).toBe('stun');
    expect(stun.cleansable).toBe(true);
  });

  test('silence prevents casting', () => {
    const silence = getServerEffectById('silence') as ServerCCEffectDef;
    expect(silence.ccType).toBe('silence');
  });

  test('root prevents movement', () => {
    const root = getServerEffectById('root') as ServerCCEffectDef;
    expect(root.ccType).toBe('root');
  });

  test('knockup is not cleansable', () => {
    const knockup = getServerEffectById('knockup') as ServerCCEffectDef;
    expect(knockup.cleansable).toBe(false);
  });

  test('suppress is not cleansable', () => {
    const suppress = getServerEffectById('suppress') as ServerCCEffectDef;
    expect(suppress.cleansable).toBe(false);
  });

  test('grounded prevents mobility abilities', () => {
    const grounded = getServerEffectById('grounded') as ServerCCEffectDef;
    expect(grounded.ccType).toBe('grounded');
  });
});

describe('Stat Effects', () => {
  test('attack speed buff has correct stat type', () => {
    const buff = getServerEffectById('attack_speed_buff') as ServerStatEffectDef;
    expect(buff.stat).toBe('attack_speed');
    expect(buff.category).toBe('buff');
  });

  test('armor reduction has correct stat type', () => {
    const debuff = getServerEffectById('armor_reduction') as ServerStatEffectDef;
    expect(debuff.stat).toBe('armor');
    expect(debuff.category).toBe('debuff');
    expect(debuff.cleansable).toBe(true);
  });

  test('buffs are not cleansable', () => {
    const attackSpeedBuff = getServerEffectById('attack_speed_buff') as ServerStatEffectDef;
    const armorBuff = getServerEffectById('armor_buff') as ServerStatEffectDef;
    expect(attackSpeedBuff.cleansable).toBe(false);
    expect(armorBuff.cleansable).toBe(false);
  });
});

describe('Over-Time Effects', () => {
  test('burn effect has correct properties', () => {
    const burn = getServerEffectById('burn') as ServerOverTimeEffectDef;
    expect(burn.otType).toBe('damage');
    expect(burn.damageType).toBe('magic');
    expect(burn.valuePerTick).toBeGreaterThan(0);
    expect(burn.tickInterval).toBeGreaterThan(0);
  });

  test('bleed effect deals physical damage', () => {
    const bleed = getServerEffectById('bleed') as ServerOverTimeEffectDef;
    expect(bleed.otType).toBe('damage');
    expect(bleed.damageType).toBe('physical');
  });

  test('poison effect stacks', () => {
    const poison = getServerEffectById('poison') as ServerOverTimeEffectDef;
    expect(poison.stackBehavior).toBe('stack');
    expect(poison.maxStacks).toBe(5);
  });

  test('healing over time is a heal', () => {
    const hot = getServerEffectById('healing_over_time') as ServerOverTimeEffectDef;
    expect(hot.otType).toBe('heal');
    expect(hot.category).toBe('buff');
  });
});

describe('Effect Categories', () => {
  test('has debuff effects', () => {
    const debuffs = ALL_SERVER_EFFECTS.filter(e => e.category === 'debuff');
    expect(debuffs.length).toBeGreaterThan(0);
  });

  test('has buff effects', () => {
    const buffs = ALL_SERVER_EFFECTS.filter(e => e.category === 'buff');
    expect(buffs.length).toBeGreaterThan(0);
  });

  test('debuffs are cleansable by default', () => {
    const debuffs = ALL_SERVER_EFFECTS.filter(e => e.category === 'debuff');
    const cleansableCount = debuffs.filter(d => d.cleansable).length;
    // Most debuffs should be cleansable (except knockup and suppress)
    expect(cleansableCount).toBeGreaterThan(debuffs.length / 2);
  });
});
