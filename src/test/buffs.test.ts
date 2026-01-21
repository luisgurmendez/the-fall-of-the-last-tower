/**
 * Comprehensive tests for the buff/debuff system.
 *
 * Tests cover:
 * - All stat modifiers (flat and percentage)
 * - Timed buff expiration
 * - Buff stacking and removal
 * - CC effects (stun, slow, root, silence)
 * - Over-time effects (DoT, HoT)
 *
 * All tests are deterministic and don't require rendering.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestDummy, createTestArena, TestArena } from './ChampionTestUtils';
import { CC, StunEffect, SlowEffect, RootEffect, SilenceEffect } from '@/effects/CrowdControlEffects';
import Vector from '@/physics/vector';

describe('Stat Modifier System', () => {
  let arena: TestArena;
  let champion: TestDummy;

  beforeEach(() => {
    arena = createTestArena();
    champion = arena.ally;
  });

  describe('Flat Stat Bonuses', () => {
    it('should increase attack damage with flat bonus', () => {
      const baseDamage = champion.getComputedStats().attackDamage;

      champion.applyBuff('test_ad', { attackDamage: 20 });

      const newDamage = champion.getComputedStats().attackDamage;
      expect(newDamage).toBe(baseDamage + 20);
    });

    it('should increase armor with flat bonus', () => {
      const baseArmor = champion.getComputedStats().armor;

      champion.applyBuff('test_armor', { armor: 30 });

      const newArmor = champion.getComputedStats().armor;
      expect(newArmor).toBe(baseArmor + 30);
    });

    it('should increase magic resist with flat bonus', () => {
      const baseMR = champion.getComputedStats().magicResist;

      champion.applyBuff('test_mr', { magicResist: 25 });

      const newMR = champion.getComputedStats().magicResist;
      expect(newMR).toBe(baseMR + 25);
    });

    it('should increase health with flat bonus', () => {
      const baseHealth = champion.getComputedStats().maxHealth;

      champion.applyBuff('test_health', { health: 100 });

      const newHealth = champion.getComputedStats().maxHealth;
      expect(newHealth).toBe(baseHealth + 100);
    });

    it('should increase ability power with flat bonus', () => {
      const baseAP = champion.getComputedStats().abilityPower;

      champion.applyBuff('test_ap', { abilityPower: 50 });

      const newAP = champion.getComputedStats().abilityPower;
      expect(newAP).toBe(baseAP + 50);
    });

    it('should increase movement speed with flat bonus', () => {
      const baseMS = champion.getComputedStats().movementSpeed;

      champion.applyBuff('test_ms', { movementSpeed: 50 });

      const newMS = champion.getComputedStats().movementSpeed;
      expect(newMS).toBe(baseMS + 50);
    });

    it('should increase attack speed with flat bonus', () => {
      const baseAS = champion.getComputedStats().attackSpeed;

      champion.applyBuff('test_as', { attackSpeed: 0.2 });

      const newAS = champion.getComputedStats().attackSpeed;
      expect(newAS).toBeCloseTo(baseAS + 0.2, 3);
    });

    it('should increase health regen with flat bonus', () => {
      const baseRegen = champion.getComputedStats().healthRegen;

      champion.applyBuff('test_hp_regen', { healthRegen: 5 });

      const newRegen = champion.getComputedStats().healthRegen;
      expect(newRegen).toBe(baseRegen + 5);
    });

    it('should increase resource regen with flat bonus', () => {
      const baseRegen = champion.getComputedStats().resourceRegen;

      champion.applyBuff('test_mp_regen', { resourceRegen: 3 });

      const newRegen = champion.getComputedStats().resourceRegen;
      expect(newRegen).toBe(baseRegen + 3);
    });

    it('should increase crit chance with flat bonus', () => {
      const baseCrit = champion.getComputedStats().critChance;

      champion.applyBuff('test_crit', { critChance: 0.25 });

      const newCrit = champion.getComputedStats().critChance;
      expect(newCrit).toBe(baseCrit + 0.25);
    });

    it('should stack multiple flat bonuses', () => {
      const baseDamage = champion.getComputedStats().attackDamage;

      champion.applyBuff('buff1', { attackDamage: 10 });
      champion.applyBuff('buff2', { attackDamage: 15 });
      champion.applyBuff('buff3', { attackDamage: 25 });

      const newDamage = champion.getComputedStats().attackDamage;
      expect(newDamage).toBe(baseDamage + 10 + 15 + 25);
    });
  });

  describe('Percentage Stat Bonuses', () => {
    it('should increase attack damage by percentage', () => {
      const baseDamage = champion.getComputedStats().attackDamage;

      // 20% increase
      champion.applyBuff('test_ad_pct', undefined, { attackDamage: 0.2 });

      const newDamage = champion.getComputedStats().attackDamage;
      expect(newDamage).toBeCloseTo(baseDamage * 1.2, 1);
    });

    it('should reduce movement speed by percentage (slow)', () => {
      const baseMS = champion.getComputedStats().movementSpeed;

      // 30% slow
      champion.applyBuff('test_slow', undefined, { movementSpeed: -0.3 });

      const newMS = champion.getComputedStats().movementSpeed;
      expect(newMS).toBeCloseTo(baseMS * 0.7, 1);
    });

    it('should increase attack speed by percentage', () => {
      const baseAS = champion.getComputedStats().attackSpeed;

      // 50% increase
      champion.applyBuff('test_as_pct', undefined, { attackSpeed: 0.5 });

      const newAS = champion.getComputedStats().attackSpeed;
      expect(newAS).toBeCloseTo(baseAS * 1.5, 2);
    });

    it('should stack percentage bonuses multiplicatively', () => {
      const baseMS = champion.getComputedStats().movementSpeed;

      // Two 20% increases should give ~1.44x (1.2 * 1.2)
      champion.applyBuff('buff1', undefined, { movementSpeed: 0.2 });
      champion.applyBuff('buff2', undefined, { movementSpeed: 0.2 });

      const newMS = champion.getComputedStats().movementSpeed;
      expect(newMS).toBeCloseTo(baseMS * 1.2 * 1.2, 1);
    });
  });

  describe('Combined Flat and Percentage Bonuses', () => {
    it('should apply flat then percentage correctly', () => {
      const baseDamage = champion.getComputedStats().attackDamage;

      // +20 flat, then +50%
      champion.applyBuff('flat', { attackDamage: 20 });
      champion.applyBuff('percent', undefined, { attackDamage: 0.5 });

      // Flat is applied first: base + 20
      // Then percentage: (base + 20) * 1.5
      const expectedDamage = (baseDamage + 20) * 1.5;
      const newDamage = champion.getComputedStats().attackDamage;
      expect(newDamage).toBeCloseTo(expectedDamage, 1);
    });
  });

  describe('Buff Management', () => {
    it('should track buff existence with hasBuff()', () => {
      expect(champion.hasBuff('my_buff')).toBe(false);

      champion.applyBuff('my_buff', { attackDamage: 10 });

      expect(champion.hasBuff('my_buff')).toBe(true);
    });

    it('should remove buff with removeBuff()', () => {
      const baseDamage = champion.getComputedStats().attackDamage;

      champion.applyBuff('temp_buff', { attackDamage: 50 });
      expect(champion.getComputedStats().attackDamage).toBe(baseDamage + 50);

      champion.removeBuff('temp_buff');

      expect(champion.getComputedStats().attackDamage).toBe(baseDamage);
      expect(champion.hasBuff('temp_buff')).toBe(false);
    });

    it('should return all buffs with getBuffs()', () => {
      champion.applyBuff('buff1', { attackDamage: 10 });
      champion.applyBuff('buff2', { armor: 20 });
      champion.applyBuff('buff3', { movementSpeed: 30 });

      const buffs = champion.getBuffs();
      expect(buffs.length).toBe(3);
      expect(buffs.some(b => b.source === 'buff1')).toBe(true);
      expect(buffs.some(b => b.source === 'buff2')).toBe(true);
      expect(buffs.some(b => b.source === 'buff3')).toBe(true);
    });
  });

  describe('Timed Buffs', () => {
    it('should expire timed buff after duration', () => {
      const baseDamage = champion.getComputedStats().attackDamage;

      // 2 second buff
      champion.applyBuff('timed_buff', { attackDamage: 30 }, undefined, 2);

      expect(champion.getComputedStats().attackDamage).toBe(baseDamage + 30);

      // Advance 1 second
      arena.tickFrames(60); // 60 frames at 1/60 = 1 second

      expect(champion.hasBuff('timed_buff')).toBe(true);
      expect(champion.getComputedStats().attackDamage).toBe(baseDamage + 30);

      // Advance another 1.5 seconds (should expire)
      arena.tickFrames(90);

      expect(champion.hasBuff('timed_buff')).toBe(false);
      expect(champion.getComputedStats().attackDamage).toBe(baseDamage);
    });

    it('should not expire permanent buffs', () => {
      const baseDamage = champion.getComputedStats().attackDamage;

      // No duration = permanent
      champion.applyBuff('permanent_buff', { attackDamage: 100 });

      // Advance lots of time
      arena.tickFrames(600); // 10 seconds

      expect(champion.hasBuff('permanent_buff')).toBe(true);
      expect(champion.getComputedStats().attackDamage).toBe(baseDamage + 100);
    });

    it('should expire multiple timed buffs independently', () => {
      const baseDamage = champion.getComputedStats().attackDamage;

      champion.applyBuff('short_buff', { attackDamage: 10 }, undefined, 1);
      champion.applyBuff('long_buff', { attackDamage: 20 }, undefined, 3);

      expect(champion.getComputedStats().attackDamage).toBe(baseDamage + 30);

      // After 1.5 seconds: short expires, long remains
      arena.tickFrames(90);

      expect(champion.hasBuff('short_buff')).toBe(false);
      expect(champion.hasBuff('long_buff')).toBe(true);
      expect(champion.getComputedStats().attackDamage).toBe(baseDamage + 20);

      // After 3.5 seconds total: both expired
      arena.tickFrames(120);

      expect(champion.hasBuff('long_buff')).toBe(false);
      expect(champion.getComputedStats().attackDamage).toBe(baseDamage);
    });
  });
});

describe('Crowd Control Effects', () => {
  let arena: TestArena;
  let champion: TestDummy;

  beforeEach(() => {
    arena = createTestArena();
    champion = arena.ally;
  });

  describe('Stun Effect', () => {
    it('should prevent movement while stunned', () => {
      expect(champion.canMove()).toBe(true);

      const stun = CC.stun('test_stun', 1.5);
      stun.apply(champion);

      expect(champion.canMove()).toBe(false);
    });

    it('should prevent attacking while stunned', () => {
      expect(champion.canAttack()).toBe(true);

      const stun = CC.stun('test_stun', 1.5);
      stun.apply(champion);

      expect(champion.canAttack()).toBe(false);
    });

    it('should prevent casting while stunned', () => {
      expect(champion.canCast()).toBe(true);

      const stun = CC.stun('test_stun', 1.5);
      stun.apply(champion);

      expect(champion.canCast()).toBe(false);
    });

    it('should expire after duration', () => {
      const stun = CC.stun('test_stun', 1);
      stun.apply(champion);

      expect(champion.canMove()).toBe(false);

      // Advance past stun duration
      arena.tickFrames(70); // ~1.17 seconds

      expect(champion.canMove()).toBe(true);
    });
  });

  describe('Silence Effect', () => {
    it('should prevent casting while silenced', () => {
      expect(champion.canCast()).toBe(true);

      const silence = CC.silence('test_silence', 2);
      silence.apply(champion);

      expect(champion.canCast()).toBe(false);
    });

    it('should allow movement while silenced', () => {
      const silence = CC.silence('test_silence', 2);
      silence.apply(champion);

      expect(champion.canMove()).toBe(true);
    });

    it('should allow attacking while silenced', () => {
      const silence = CC.silence('test_silence', 2);
      silence.apply(champion);

      expect(champion.canAttack()).toBe(true);
    });

    it('should expire after duration', () => {
      const silence = CC.silence('test_silence', 1);
      silence.apply(champion);

      expect(champion.canCast()).toBe(false);

      // Advance past silence duration
      arena.tickFrames(70);

      expect(champion.canCast()).toBe(true);
    });
  });

  describe('Slow Effect', () => {
    it('should reduce movement speed', () => {
      const baseMS = champion.getComputedStats().movementSpeed;

      const slow = CC.slow('test_slow', 2, 0.4); // 40% slow
      slow.apply(champion);

      const newMS = champion.getComputedStats().movementSpeed;
      expect(newMS).toBeCloseTo(baseMS * 0.6, 1); // 60% of original
    });

    it('should not prevent other actions', () => {
      const slow = CC.slow('test_slow', 2, 0.5);
      slow.apply(champion);

      expect(champion.canMove()).toBe(true);
      expect(champion.canAttack()).toBe(true);
      expect(champion.canCast()).toBe(true);
    });

    it('should expire after duration', () => {
      const baseMS = champion.getComputedStats().movementSpeed;

      const slow = CC.slow('test_slow', 1, 0.5);
      slow.apply(champion);

      expect(champion.getComputedStats().movementSpeed).toBeCloseTo(baseMS * 0.5, 1);

      // Advance past slow duration
      arena.tickFrames(70);

      expect(champion.getComputedStats().movementSpeed).toBe(baseMS);
    });

    it('should stack multiple slows multiplicatively', () => {
      const baseMS = champion.getComputedStats().movementSpeed;

      const slow1 = CC.slow('slow1', 5, 0.2); // 20% slow
      const slow2 = CC.slow('slow2', 5, 0.3); // 30% slow
      slow1.apply(champion);
      slow2.apply(champion);

      const newMS = champion.getComputedStats().movementSpeed;
      // 80% * 70% = 56% of original
      expect(newMS).toBeCloseTo(baseMS * 0.8 * 0.7, 1);
    });
  });

  describe('Root Effect', () => {
    it('should prevent movement', () => {
      const root = CC.root('test_root', 2);
      root.apply(champion);

      // Root applies 100% slow
      const ms = champion.getComputedStats().movementSpeed;
      expect(ms).toBeCloseTo(0, 1);
    });

    it('should allow attacking while rooted', () => {
      const root = CC.root('test_root', 2);
      root.apply(champion);

      expect(champion.canAttack()).toBe(true);
    });

    it('should allow casting while rooted', () => {
      const root = CC.root('test_root', 2);
      root.apply(champion);

      expect(champion.canCast()).toBe(true);
    });

    it('should expire after duration', () => {
      const baseMS = champion.getComputedStats().movementSpeed;

      const root = CC.root('test_root', 1);
      root.apply(champion);

      expect(champion.getComputedStats().movementSpeed).toBeCloseTo(0, 1);

      // Advance past root duration
      arena.tickFrames(70);

      expect(champion.getComputedStats().movementSpeed).toBe(baseMS);
    });
  });

  describe('CC Factory Functions', () => {
    it('CC.stun() creates a valid stun effect', () => {
      const stun = CC.stun('my_stun', 1.5);
      expect(stun).toBeInstanceOf(StunEffect);
      expect(stun.duration).toBe(1.5);
      expect(stun.ccType).toBe('stun');
    });

    it('CC.silence() creates a valid silence effect', () => {
      const silence = CC.silence('my_silence', 2);
      expect(silence).toBeInstanceOf(SilenceEffect);
      expect(silence.duration).toBe(2);
      expect(silence.ccType).toBe('silence');
    });

    it('CC.slow() creates a valid slow effect', () => {
      const slow = CC.slow('my_slow', 3, 0.35);
      expect(slow).toBeInstanceOf(SlowEffect);
      expect(slow.duration).toBe(3);
      expect(slow.slowPercent).toBe(0.35);
    });

    it('CC.root() creates a valid root effect', () => {
      const root = CC.root('my_root', 1);
      expect(root).toBeInstanceOf(RootEffect);
      expect(root.duration).toBe(1);
    });
  });
});

describe('Damage and Healing', () => {
  let arena: TestArena;

  beforeEach(() => {
    arena = createTestArena();
  });

  describe('Physical Damage', () => {
    it('should reduce damage based on armor', () => {
      const { ally, enemy } = arena;

      ally.setHealth(1000);
      const armor = ally.getComputedStats().armor; // 30 base

      // Deal 100 raw physical damage
      const damageTaken = ally.takeDamage(100, 'physical', enemy);

      // Damage reduction: 100 / (100 + armor) = 100 / 130 ≈ 76.9%
      const expectedDamage = 100 * (100 / (100 + armor));
      expect(damageTaken).toBeCloseTo(expectedDamage, 1);
      expect(ally.getState().health).toBeCloseTo(1000 - expectedDamage, 1);
    });

    it('should deal more damage with armor reduction debuff', () => {
      const { ally, enemy } = arena;

      ally.setHealth(1000);
      const baseArmor = ally.getComputedStats().armor;

      // Apply armor reduction
      ally.applyBuff('armor_break', { armor: -20 });
      const newArmor = ally.getComputedStats().armor;
      expect(newArmor).toBe(baseArmor - 20);

      // 100 physical damage with reduced armor
      const damageTaken = ally.takeDamage(100, 'physical', enemy);
      const expectedDamage = 100 * (100 / (100 + newArmor));
      expect(damageTaken).toBeCloseTo(expectedDamage, 1);
    });
  });

  describe('Magic Damage', () => {
    it('should reduce damage based on magic resist', () => {
      const { ally, enemy } = arena;

      ally.setHealth(1000);
      const mr = ally.getComputedStats().magicResist; // 30 base

      const damageTaken = ally.takeDamage(100, 'magic', enemy);

      const expectedDamage = 100 * (100 / (100 + mr));
      expect(damageTaken).toBeCloseTo(expectedDamage, 1);
    });
  });

  describe('True Damage', () => {
    it('should ignore armor and magic resist', () => {
      const { ally, enemy } = arena;

      ally.setHealth(1000);

      // Apply lots of defenses
      ally.applyBuff('tank', { armor: 100, magicResist: 100 });

      const damageTaken = ally.takeDamage(100, 'true', enemy);

      expect(damageTaken).toBe(100);
      expect(ally.getState().health).toBe(900);
    });
  });

  describe('Healing', () => {
    it('should restore health', () => {
      const { ally } = arena;

      ally.setHealth(500);

      ally.heal(200);

      expect(ally.getState().health).toBe(700);
    });

    it('should not exceed max health', () => {
      const { ally } = arena;

      ally.setHealth(900);
      const maxHealth = ally.getComputedStats().maxHealth;

      ally.heal(500);

      expect(ally.getState().health).toBe(maxHealth);
    });

    it('should benefit from increased max health buff', () => {
      const { ally } = arena;

      const baseMaxHealth = ally.getComputedStats().maxHealth;
      ally.applyBuff('hp_buff', { health: 200 });
      const newMaxHealth = ally.getComputedStats().maxHealth;

      expect(newMaxHealth).toBe(baseMaxHealth + 200);

      ally.setHealth(newMaxHealth - 100);
      ally.heal(200);

      expect(ally.getState().health).toBe(newMaxHealth);
    });
  });
});

describe('Shields', () => {
  let arena: TestArena;

  beforeEach(() => {
    arena = createTestArena();
  });

  it('should absorb damage before health', () => {
    const { ally, enemy } = arena;

    ally.setHealth(1000);
    ally.addShield(200, 5, 'test_shield');

    ally.takeDamage(300, 'true', enemy);

    // Shield absorbs 200, health takes 100
    expect(ally.getTotalShield()).toBe(0);
    expect(ally.getState().health).toBe(900);
  });

  it('should expire after duration', () => {
    const { ally } = arena;

    ally.addShield(100, 1, 'temp_shield'); // 1 second duration

    expect(ally.getTotalShield()).toBe(100);

    // Advance past shield duration
    arena.tickFrames(70);

    expect(ally.getTotalShield()).toBe(0);
  });

  it('should stack multiple shields', () => {
    const { ally } = arena;

    ally.addShield(100, 5, 'shield1');
    ally.addShield(150, 5, 'shield2');
    ally.addShield(50, 5, 'shield3');

    expect(ally.getTotalShield()).toBe(300);
  });
});

describe('Level Scaling', () => {
  let champion: TestDummy;

  beforeEach(() => {
    const arena = createTestArena();
    champion = arena.ally;
  });

  it('should increase stats with level', () => {
    const level1Stats = champion.getComputedStats();

    champion.setLevel(10);

    const level10Stats = champion.getComputedStats();

    // Health should increase (85 per level)
    expect(level10Stats.maxHealth).toBeGreaterThan(level1Stats.maxHealth);
    expect(level10Stats.maxHealth).toBe(level1Stats.maxHealth + 85 * 9);

    // AD should increase (3 per level)
    expect(level10Stats.attackDamage).toBeGreaterThan(level1Stats.attackDamage);
    expect(level10Stats.attackDamage).toBe(level1Stats.attackDamage + 3 * 9);
  });

  it('should scale attack speed correctly', () => {
    const level1AS = champion.getComputedStats().attackSpeed;

    champion.setLevel(18);

    const level18AS = champion.getComputedStats().attackSpeed;

    // Attack speed growth is percentage based (2% per level)
    // Level 18: baseAS * (1 + 0.02 * 17)
    const expectedAS = 1.0 * (1 + 0.02 * 17);
    expect(level18AS).toBeCloseTo(expectedAS, 2);
    expect(level18AS).toBeGreaterThan(level1AS);
  });
});

describe('Deterministic Timing', () => {
  it('should advance time precisely with tick()', () => {
    const arena = createTestArena();
    const { ally } = arena;

    // Apply a 0.5 second buff
    ally.applyBuff('precise_buff', { attackDamage: 10 }, undefined, 0.5);

    // Tick exactly 30 frames at 1/60 (0.5 seconds)
    arena.tickFrames(30);

    // Should still be active (exactly at expiry point)
    expect(ally.hasBuff('precise_buff')).toBe(true);

    // One more tick should expire it
    arena.tick();

    expect(ally.hasBuff('precise_buff')).toBe(false);
  });

  it('should calculate position changes deterministically via dash', () => {
    const arena = createTestArena();
    const { ally } = arena;

    ally.setPositionXY(0, 0);
    // Use dash (forced movement) to move - this won't be overridden by step()
    // Dash 100 units at 100 units/second = 1 second duration
    ally.startDash(new Vector(1, 0), 100, 100);

    // Advance 1 second
    arena.tickFrames(60);

    const pos = ally.getPositionXY();
    expect(pos.x).toBeCloseTo(100, 1);
    expect(pos.y).toBeCloseTo(0, 1);
  });
});
