/**
 * Urûk Champion Tests
 *
 * Urûk - The Silver Dragonborn, a spear fighter.
 * - Passive: Hunter's Instinct - while an enemy champion his side sees within
 *   800 is under half health: +12% movement speed and +10% attack speed
 * - Q: Spear Thrust - a line through every enemy, base + 80% AD
 * - W: Spear Charge - his next attack within 4 s reaches 40 further, is ready
 *   at once and hits for base + 50% AD more; for 4 s his physical damage
 *   ignores 10/14/18/22/26 armor
 * - E: Silver Scales - a shield; when it breaks or runs out it bursts in
 *   frost around him (magic damage, 30% slow)
 * - R: Fatal Strike - a leap at an enemy: base + 100% AD, up to 50% more the
 *   less health it has when he lands (the leap itself: Dashes.test.ts)
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  Vector,
  CHAMPION_DEFINITIONS,
  GameEventType,
  TEAM_BLUE,
  TEAM_RED,
  calculatePhysicalDamage,
  calculateMagicDamage,
  getAbilityDefinition,
  getPassiveDefinition,
} from '@siege/shared';
import { createTestArena, type TestArena, type TestChampion } from '../ServerTestUtils';
import type { ServerEntity } from '../../simulation/ServerEntity';
import { SPEAR_CHARGE_REACH } from '../../abilities/handlers/uruk/UrukWHandler';

const BASE_STATS = CHAMPION_DEFINITIONS.uruk.baseStats;
const THRUST = getAbilityDefinition('uruk_q')!;
const SPEAR_CHARGE = getAbilityDefinition('uruk_w')!;
const SCALES = getAbilityDefinition('uruk_e')!;
const FATAL_STRIKE = getAbilityDefinition('uruk_r')!;
const PASSIVE = getPassiveDefinition('uruk_passive')!;
/** Hunter's Instinct's numbers, as its description gives them */
const HUNT = { range: 800, health: 0.5, moveSpeed: 1.12, attackSpeed: 1.1 };
/** Spear Charge's armor penetration by rank, as its description gives it */
const PIERCING = [10, 14, 18, 22, 26];
const FPS = 60;

function arenaWith(redAt = new Vector(100, 0), redChampion = 'magnus'): TestArena {
  const arena = createTestArena({ blueChampion: 'uruk', redChampion, bluePosition: new Vector(0, 0), redPosition: redAt });
  // (The arena's level 6 raised their max health, not their health)
  for (const champion of [arena.blue, arena.red]) {
    champion.setLevel(champion.level);
    champion.setHealth(champion.maxHealth);
  }
  return arena;
}

/** Each hit Urûk lands on `target` while `run` runs: its damage, and the target's health just before */
function hitsOn(arena: TestArena, target: ServerEntity, run: () => void): { damage: number; healthBefore: number; type: string }[] {
  const hits: { damage: number; healthBefore: number; type: string }[] = [];
  const takeDamage = target.takeDamage.bind(target);
  target.takeDamage = ((...args: Parameters<typeof takeDamage>) => {
    const healthBefore = target.health;
    const damage = takeDamage(...args);
    if (args[2] === arena.blue.id && damage > 0) hits.push({ damage, healthBefore, type: args[1] });
    return damage;
  }) as typeof takeDamage;
  run();
  target.takeDamage = takeDamage;
  return hits;
}

function total(hits: { damage: number }[]): number {
  return hits.reduce((sum, hit) => sum + hit.damage, 0);
}

/** Physical damage from Urûk on `target`, after its armor less his penetration now */
function physicalOn(arena: TestArena, target: TestChampion, raw: number): number {
  const penetration = arena.blue.getPenetration();
  return calculatePhysicalDamage(raw, target.getStats().armor, penetration.armorFlat, penetration.armorPercent);
}

/** An AD ability's damage at a rank before resistances */
function rawAd(arena: TestArena, abilityId: string, rank: number): number {
  const scaling = getAbilityDefinition(abilityId)!.damage!.scaling;
  return scaling.base[rank - 1] + arena.blue.getStats().attackDamage * (scaling.adRatio ?? 0);
}

/** Tick until the leap ends */
function untilLanded(arena: TestArena): void {
  for (let i = 0; i < 2 * FPS && (i === 0 || arena.blue.forcedMovement); i++) arena.tick();
}

/** Urûk attacks red until his first attack lands */
function attackOnce(arena: TestArena): void {
  arena.blue.setAttackTarget(arena.red.id);
  for (let i = 0; i < 2 * FPS && arena.blue.basicAttacks.cooldownRemaining <= 0; i++) arena.tick();
  // Its blow lands at the animation's damage keyframe
  arena.tickFrames(Math.ceil(arena.blue.basicAttacks.getDamageDelay() * FPS) + 2);
}

describe('Urûk', () => {
  let arena: TestArena;

  beforeEach(() => {
    arena = arenaWith();
  });

  test('base stats: the longest melee reach', () => {
    const level1 = createTestArena({ blueChampion: 'uruk', redChampion: 'magnus', learnAbilities: false });
    expect(level1.blue.maxHealth).toBe(BASE_STATS.health);
    expect(level1.blue.getStats().attackRange).toBe(BASE_STATS.attackRange);
    const melee = Object.values(CHAMPION_DEFINITIONS).filter(def => def.attackType === 'melee' && def.id !== 'uruk');
    expect(BASE_STATS.attackRange).toBeGreaterThan(Math.max(...melee.map(def => def.baseStats.attackRange)));
  });

  // ===========================================================================
  // Passive - Hunter's Instinct
  // ===========================================================================

  describe("Passive - Hunter's Instinct", () => {
    test('is an always-on passive', () => {
      expect(PASSIVE.trigger).toBe('always');
    });

    test('an enemy champion under half health nearby: +12% movement and +10% attack speed', () => {
      const speed = arena.blue.getStats().movementSpeed;
      const attackSpeed = arena.blue.getStats().attackSpeed;
      arena.red.setHealth(arena.red.maxHealth * 0.4);
      arena.tick();
      expect(arena.blue.hasEffect('uruk_hunt')).toBe(true);
      expect(arena.blue.getStats().movementSpeed).toBeCloseTo(speed * HUNT.moveSpeed, 5);
      expect(arena.blue.getStats().attackSpeed).toBeCloseTo(attackSpeed * HUNT.attackSpeed, 5);
    });

    test('at half health or more: nothing', () => {
      for (const share of [HUNT.health, 0.6, 1]) {
        const healthy = arenaWith();
        healthy.red.setHealth(healthy.red.maxHealth * share);
        healthy.tick();
        expect(healthy.blue.hasEffect('uruk_hunt')).toBe(false);
        expect(healthy.blue.hasEffect('uruk_hunt_speed')).toBe(false);
      }
    });

    test(`within ${HUNT.range} it counts, past it not`, () => {
      // Seen by his side (as an ally or a ward would see it), past his own sight
      expect(arena.context.isVisibleTo(arena.red, arena.blue.side)).toBe(true);
      arena.red.setHealth(arena.red.maxHealth * 0.3);
      arena.red.position.setFrom(new Vector(HUNT.range - 1, 0));
      arena.tick();
      expect(arena.blue.hasEffect('uruk_hunt')).toBe(true);

      const far = arenaWith();
      expect(far.context.isVisibleTo(far.red, far.blue.side)).toBe(true);
      far.red.setHealth(far.red.maxHealth * 0.3);
      far.red.position.setFrom(new Vector(HUNT.range + 1, 0));
      far.tick();
      expect(far.blue.hasEffect('uruk_hunt')).toBe(false);
    });

    test("an enemy his side can't see doesn't count", () => {
      const unseen = arenaWith(new Vector(3000, 3000));
      expect(unseen.context.isVisibleTo(unseen.red, unseen.blue.side)).toBe(false);
      unseen.red.position.setFrom(new Vector(300, 0));
      unseen.red.setHealth(unseen.red.maxHealth * 0.3);
      unseen.tick();
      expect(unseen.blue.hasEffect('uruk_hunt')).toBe(false);
    });

    test("hurt minions and monsters, and a dead champion, don't count", () => {
      arena.red.takeDamage(1e9, 'true');
      const minion = arena.addMinion(TEAM_RED, new Vector(100, 50));
      minion.health = minion.maxHealth * 0.2;
      const creature = arena.addJungleCreature(new Vector(100, -50), 'wolf');
      creature.health = creature.maxHealth * 0.2;
      arena.tick();
      expect(arena.blue.hasEffect('uruk_hunt')).toBe(false);
    });

    test('it fades a moment after the prey heals', () => {
      arena.red.setHealth(arena.red.maxHealth * 0.4);
      arena.tick();
      expect(arena.blue.hasEffect('uruk_hunt')).toBe(true);
      arena.red.setHealth(arena.red.maxHealth);
      arena.tickFrames(0.5 * FPS);
      expect(arena.blue.hasEffect('uruk_hunt')).toBe(false);
      expect(arena.blue.hasEffect('uruk_hunt_speed')).toBe(false);
    });

    test('dead, he hunts nothing', () => {
      arena.red.setHealth(arena.red.maxHealth * 0.4);
      arena.blue.takeDamage(1e9, 'true');
      arena.tick();
      expect(arena.blue.hasEffect('uruk_hunt')).toBe(false);
    });
  });

  // ===========================================================================
  // Q - Spear Thrust
  // ===========================================================================

  describe('Q - Spear Thrust', () => {
    test('rank 1 and max rank: its base plus 80% AD, after armor', () => {
      const hits = hitsOn(arena, arena.red, () => arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(200, 0) }));
      expect(hits.length).toBe(1);
      expect(hits[0].damage).toBeCloseTo(physicalOn(arena, arena.red, rawAd(arena, 'uruk_q', 1)), 5);

      const max = arenaWith();
      max.blue.maxAbility('Q');
      max.blue.setLevel(18);
      const maxHits = hitsOn(max, max.red, () => max.castAbility(max.blue, 'Q', { targetPosition: new Vector(200, 0) }));
      expect(maxHits[0].damage).toBeCloseTo(physicalOn(max, max.red, rawAd(max, 'uruk_q', THRUST.maxRank)), 5);
    });

    test('every enemy along the line is hit, each once', () => {
      const first = arena.addMinion(TEAM_RED, new Vector(50, 0));
      const last = arena.addMinion(TEAM_RED, new Vector(THRUST.range! - 20, 5));
      const hitFirst = hitsOn(arena, first, () => {
        const hitLast = hitsOn(arena, last, () => {
          const hitRed = hitsOn(arena, arena.red, () => arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(200, 0) }));
          expect(hitRed.length).toBe(1);
        });
        expect(hitLast.length).toBe(1);
      });
      expect(hitFirst.length).toBe(1);
    });

    test('its band: a body touching it is hit, one just clear of it is not', () => {
      arena.red.position.setFrom(new Vector(3000, 3000));
      const probe = arena.addMinion(TEAM_RED, new Vector(0, 0));
      const radius = probe.getRadius();
      const half = THRUST.aoeRadius!;
      const cases: Array<[Vector, boolean]> = [
        [new Vector(120, half + radius - 1), true],
        [new Vector(120, half + radius + 1), false],
        [new Vector(THRUST.range! + radius - 1, 0), true],
        [new Vector(THRUST.range! + radius + 1, 0), false],
        [new Vector(-radius - 1, 0), false],
      ];
      for (const [at, hit] of cases) {
        const line = arenaWith(new Vector(3000, 3000));
        const minion = line.addMinion(TEAM_RED, at);
        const health = minion.health;
        line.castAbility(line.blue, 'Q', { targetPosition: new Vector(200, 0) });
        expect(minion.health < health).toBe(hit);
      }
    });

    test(`aimed far away, it is still ${THRUST.range} long`, () => {
      arena.red.position.setFrom(new Vector(3000, 3000));
      const near = arena.addMinion(TEAM_RED, new Vector(THRUST.range! - 10, 0));
      const beyond = arena.addMinion(TEAM_RED, new Vector(THRUST.range! + 80, 0));
      const healths = [near.health, beyond.health];
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(2000, 0) });
      expect(near.health).toBeLessThan(healths[0]);
      expect(beyond.health).toBe(healths[1]);
    });

    test('nothing in its cast time or the thrust; then it lands', () => {
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(200, 0), casting: true });
      expect(arena.blue.isCasting()).toBe(true);
      arena.blue.advanceCast(10, arena.context);
      arena.context.advanceTime(THRUST.aoeDelay! - 0.05);
      expect(arena.red.health).toBe(health);
      arena.context.advanceTime(0.05 + 1e-6);
      expect(arena.red.health).toBeLessThan(health);
    });

    test('it thrusts from where he is when it lands, aimed where he cast it', () => {
      arena.red.position.setFrom(new Vector(100, 300));
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(200, 0), windup: true });
      arena.blue.position.setFrom(new Vector(0, 300));
      arena.context.advanceTime(THRUST.aoeDelay! + 1e-6);
      expect(arena.red.health).toBeLessThan(health);
    });

    test('allies and towers are untouched; monsters are hit', () => {
      arena.red.position.setFrom(new Vector(3000, 3000));
      const ally = arena.addMinion(TEAM_BLUE, new Vector(60, 0));
      const tower = arena.addTower(TEAM_RED, new Vector(140, 0));
      const creature = arena.addJungleCreature(new Vector(200, 0), 'wolf');
      const healths = [ally.health, tower.health, creature.health];
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(200, 0) });
      expect(ally.health).toBe(healths[0]);
      expect(tower.health).toBe(healths[1]);
      expect(creature.health).toBeLessThan(healths[2]);
    });

    test("Spear Charge's armor penetration pierces it too", () => {
      arena.castAbility(arena.blue, 'W');
      const hits = hitsOn(arena, arena.red, () => arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(200, 0) }));
      const armor = arena.red.getStats().armor;
      expect(hits[0].damage).toBeCloseTo(calculatePhysicalDamage(rawAd(arena, 'uruk_q', 1), armor, PIERCING[0]), 5);
      expect(hits[0].damage).toBeGreaterThan(calculatePhysicalDamage(rawAd(arena, 'uruk_q', 1), armor));
    });

    test('mana and cooldown at rank 1 and max rank; silenced fails', () => {
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(200, 0) });
      expect(arena.blue.resource).toBe(mana - THRUST.manaCost![0]);
      expect(arena.blue.getAbilityCooldown('Q')).toBe(THRUST.cooldown![0]);
      arena.blue.resetCooldowns();
      arena.blue.maxAbility('Q');
      const before = arena.blue.resource;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(200, 0) });
      expect(arena.blue.resource).toBe(before - THRUST.manaCost![THRUST.maxRank - 1]);
      expect(arena.blue.getAbilityCooldown('Q')).toBe(THRUST.cooldown![THRUST.maxRank - 1]);

      const silenced = arenaWith();
      silenced.blue.applyEffect('silence', 1, silenced.red.id);
      expect(silenced.castAbility(silenced.blue, 'Q', { targetPosition: new Vector(200, 0) }).failReason).toBe('silenced');
    });
  });

  // ===========================================================================
  // W - Spear Charge
  // ===========================================================================

  describe('W - Spear Charge', () => {
    test('instant, and it readies an attack at once (an attack reset)', () => {
      attackOnce(arena);
      expect(arena.blue.basicAttacks.cooldownRemaining).toBeGreaterThan(0);
      arena.castAbility(arena.blue, 'W', { casting: true });
      expect(arena.blue.isCasting()).toBe(false);
      expect(arena.blue.basicAttacks.cooldownRemaining).toBe(0);
    });

    test('the charged attack hits for its base plus 50% AD more, then the charge is spent', () => {
      arena.castAbility(arena.blue, 'W');
      const hits = hitsOn(arena, arena.red, () => attackOnce(arena));
      expect(hits.length).toBe(2);
      const ad = arena.blue.getStats().attackDamage;
      expect(hits[0].damage).toBeCloseTo(physicalOn(arena, arena.red, ad), 5);
      expect(hits[1].damage).toBeCloseTo(physicalOn(arena, arena.red, SPEAR_CHARGE.damage!.scaling.base[0] + ad * SPEAR_CHARGE.damage!.scaling.adRatio!), 5);
      expect(arena.blue.hasEffect('uruk_spear_charge')).toBe(false);

      // The next attack is a plain one
      arena.blue.stop();
      arena.tickFrames(2 * FPS);
      const next = hitsOn(arena, arena.red, () => attackOnce(arena));
      expect(next.length).toBe(1);
    });

    test('max rank: its top base', () => {
      arena.blue.maxAbility('W');
      arena.castAbility(arena.blue, 'W');
      const hits = hitsOn(arena, arena.red, () => attackOnce(arena));
      const ad = arena.blue.getStats().attackDamage;
      expect(hits[1].damage).toBeCloseTo(physicalOn(arena, arena.red, SPEAR_CHARGE.damage!.scaling.base[SPEAR_CHARGE.maxRank - 1] + ad * SPEAR_CHARGE.damage!.scaling.adRatio!), 5);
    });

    test(`the charged attack reaches ${SPEAR_CHARGE_REACH} further, then the reach goes back`, () => {
      const normalReach = BASE_STATS.attackRange + arena.blue.getRadius() + arena.red.getRadius();
      arena.red.position.setFrom(new Vector(normalReach + SPEAR_CHARGE_REACH - 10, 0));
      // Rooted: he can only hit what's in reach
      arena.blue.applyEffect('root', 5, arena.red.id);
      arena.blue.setAttackTarget(arena.red.id);
      arena.tickFrames(0.5 * FPS);
      expect(total(hitsOn(arena, arena.red, () => arena.tickFrames(FPS)))).toBe(0);

      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.getAttackRange()).toBe(BASE_STATS.attackRange + SPEAR_CHARGE_REACH);
      const hits = hitsOn(arena, arena.red, () => arena.tickFrames(FPS));
      expect(hits.length).toBe(2);
      expect(arena.blue.getAttackRange()).toBe(BASE_STATS.attackRange);
    });

    test('unused, the charge and its reach last 4 seconds', () => {
      arena.red.position.setFrom(new Vector(3000, 3000));
      arena.castAbility(arena.blue, 'W');
      arena.tickFrames((SPEAR_CHARGE.effectDuration! - 0.2) * FPS);
      expect(arena.blue.hasEffect('uruk_spear_charge')).toBe(true);
      arena.tickFrames(0.4 * FPS);
      expect(arena.blue.hasEffect('uruk_spear_charge')).toBe(false);
      expect(arena.blue.getAttackRange()).toBe(BASE_STATS.attackRange);
    });

    test(`for 4 seconds his physical damage ignores ${PIERCING.join('/')} armor by rank`, () => {
      expect(arena.blue.getPenetration().armorFlat).toBe(0);
      for (let rank = 1; rank <= SPEAR_CHARGE.maxRank; rank++) {
        const ranked = arenaWith(new Vector(3000, 3000));
        while (ranked.blue.getAbilityRank('W') < rank) {
          ranked.blue.skillPoints++;
          ranked.blue.levelUpAbility('W');
        }
        ranked.castAbility(ranked.blue, 'W');
        expect(ranked.blue.getPenetration().armorFlat).toBe(PIERCING[rank - 1]);
      }
      arena.castAbility(arena.blue, 'W');
      arena.tickFrames((SPEAR_CHARGE.effectDuration! + 0.2) * FPS);
      expect(arena.blue.getPenetration().armorFlat).toBe(0);
    });

    test('mana and cooldown by rank; silenced fails', () => {
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.resource).toBe(mana - SPEAR_CHARGE.manaCost![0]);
      expect(arena.blue.getAbilityCooldown('W')).toBe(SPEAR_CHARGE.cooldown![0]);
      arena.blue.resetCooldowns();
      arena.blue.maxAbility('W');
      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.getAbilityCooldown('W')).toBe(SPEAR_CHARGE.cooldown![SPEAR_CHARGE.maxRank - 1]);

      const silenced = arenaWith();
      silenced.blue.applyEffect('silence', 1, silenced.red.id);
      expect(silenced.castAbility(silenced.blue, 'W').success).toBe(false);
      expect(silenced.blue.hasEffect('uruk_spear_charge')).toBe(false);
    });
  });

  // ===========================================================================
  // E - Silver Scales
  // ===========================================================================

  describe('E - Silver Scales', () => {
    const shieldOf = (target: TestArena) => target.blue.getShields().filter(shield => shield.sourceId === 'uruk_e').reduce((sum, shield) => sum + shield.amount, 0);
    const burstDamage = (target: TestArena, rank: number) =>
      calculateMagicDamage(SCALES.damage!.scaling.base[rank - 1] + target.blue.getStats().abilityPower * SCALES.damage!.scaling.apRatio!, target.red.getStats().magicResist);

    test('rank 1 and max rank: a shield of its base plus 60% AP, instant', () => {
      arena.castAbility(arena.blue, 'E', { casting: true });
      expect(arena.blue.isCasting()).toBe(false);
      expect(shieldOf(arena)).toBeCloseTo(SCALES.shield!.scaling.base[0], 5);

      const max = arenaWith();
      max.blue.maxAbility('E');
      max.blue.items[0] = { definitionId: 'cinder_rod', slot: 0, passiveCooldowns: {}, nextIntervalTick: {} };
      max.blue.invalidateStats();
      max.castAbility(max.blue, 'E');
      expect(shieldOf(max)).toBeCloseTo(SCALES.shield!.scaling.base[SCALES.maxRank - 1] + 50 * SCALES.shield!.scaling.apRatio!, 5);
    });

    test(`run out after ${SCALES.shield!.duration} s, it bursts: magic damage and a 30% slow around him`, () => {
      arena.castAbility(arena.blue, 'E');
      const early = hitsOn(arena, arena.red, () => arena.tickFrames((SCALES.shield!.duration - 0.2) * FPS));
      expect(early.length).toBe(0);
      const hits = hitsOn(arena, arena.red, () => arena.tickFrames(0.4 * FPS));
      expect(hits.length).toBe(1);
      expect(hits[0].type).toBe('magic');
      expect(hits[0].damage).toBeCloseTo(burstDamage(arena, 1), 5);
      expect(arena.red.hasEffect('slow_30')).toBe(true);
      expect(arena.red.getEffect('slow_30')!.timeRemaining).toBeLessThanOrEqual(SCALES.effectDuration!);
    });

    test('BUG: broken by damage (even in the tick it was cast), it bursts at once', () => {
      arena.castAbility(arena.blue, 'E');
      arena.blue.takeDamage(shieldOf(arena) + 5, 'true', arena.red.id, arena.context);
      const hits = hitsOn(arena, arena.red, () => arena.tick());
      expect(hits.length).toBe(1);
      expect(arena.context.flushEvents().some(event => event.type === GameEventType.ABILITY_CAST && event.data.abilityId === 'uruk_e_burst')).toBe(true);
    });

    test('it bursts once, where he stands then', () => {
      arena.castAbility(arena.blue, 'E');
      arena.blue.position.setFrom(new Vector(600, 0));
      arena.red.position.setFrom(new Vector(650, 0));
      const hits = hitsOn(arena, arena.red, () => arena.tickFrames((SCALES.shield!.duration + 1.5) * FPS));
      expect(hits.length).toBe(1);
    });

    test(`its radius: hit at ${SCALES.aoeRadius! - 1}, not at ${SCALES.aoeRadius! + 1}; allies and towers untouched, monsters hit`, () => {
      arena.red.position.setFrom(new Vector(SCALES.aoeRadius! - 1, 0));
      const outside = arena.addMinion(TEAM_RED, new Vector(0, SCALES.aoeRadius! + 1));
      const ally = arena.addMinion(TEAM_BLUE, new Vector(0, -60));
      const tower = arena.addTower(TEAM_RED, new Vector(-80, 0));
      const creature = arena.addJungleCreature(new Vector(60, 60), 'wolf');
      const healths = [outside.health, ally.health, tower.health, creature.health];
      arena.castAbility(arena.blue, 'E');
      arena.blue.takeDamage(shieldOf(arena) + 5, 'true', arena.red.id, arena.context);
      const hits = hitsOn(arena, arena.red, () => arena.tick());
      expect(hits.length).toBe(1);
      expect(outside.health).toBe(healths[0]);
      expect(ally.health).toBe(healths[1]);
      expect(tower.health).toBe(healths[2]);
      expect(creature.health).toBeLessThan(healths[3]);
    });

    test('dying behind the scales: no burst, then or after respawning', () => {
      arena.castAbility(arena.blue, 'E');
      arena.blue.takeDamage(1e9, 'true', arena.red.id, arena.context);
      expect(arena.blue.isDead).toBe(true);
      arena.blue.respawnTimer = 0.01;
      const hits = hitsOn(arena, arena.red, () => arena.tickFrames(2 * FPS));
      expect(arena.blue.isDead).toBe(false);
      expect(hits.length).toBe(0);
    });

    test('max rank burst with AP', () => {
      const max = arenaWith();
      max.blue.maxAbility('E');
      max.blue.items[0] = { definitionId: 'cinder_rod', slot: 0, passiveCooldowns: {}, nextIntervalTick: {} };
      max.blue.invalidateStats();
      max.castAbility(max.blue, 'E');
      max.blue.takeDamage(shieldOf(max) + 5, 'true', max.red.id, max.context);
      const hits = hitsOn(max, max.red, () => max.tick());
      expect(hits[0].damage).toBeCloseTo(burstDamage(max, SCALES.maxRank), 5);
    });

    test('mana and cooldown by rank; stunned fails', () => {
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'E');
      expect(arena.blue.resource).toBe(mana - SCALES.manaCost![0]);
      expect(arena.blue.getAbilityCooldown('E')).toBe(SCALES.cooldown![0]);
      const max = arenaWith();
      max.blue.maxAbility('E');
      max.castAbility(max.blue, 'E');
      expect(max.blue.getAbilityCooldown('E')).toBe(SCALES.cooldown![SCALES.maxRank - 1]);

      const stunned = arenaWith();
      stunned.blue.applyEffect('stun', 1, stunned.red.id);
      expect(stunned.castAbility(stunned.blue, 'E').failReason).toBe('stunned');
      expect(shieldOf(stunned)).toBe(0);
    });
  });

  // ===========================================================================
  // R - Fatal Strike
  // ===========================================================================

  describe('R - Fatal Strike', () => {
    const EXECUTE = FATAL_STRIKE.damage!.executeBonus!;

    /** Its hit on red: damage, and what the execute should make it from red's health when it landed */
    function strike(target: TestArena, rank = 1): { damage: number; expected: number } {
      const hits = hitsOn(target, target.red, () => {
        expect(target.castAbility(target.blue, 'R', { targetId: target.red.id }).success).toBe(true);
        untilLanded(target);
      });
      expect(hits.length).toBe(1);
      const missing = 1 - hits[0].healthBefore / target.red.maxHealth;
      return { damage: hits[0].damage, expected: physicalOn(target, target.red, rawAd(target, 'uruk_r', rank) * (1 + EXECUTE * missing)) };
    }

    test('a target at full health takes its base plus 100% AD', () => {
      arena.red.setHealth(arena.red.maxHealth);
      const { damage } = strike(arena);
      expect(damage).toBeCloseTo(physicalOn(arena, arena.red, rawAd(arena, 'uruk_r', 1)), 1);
    });

    for (const share of [0.75, 0.4, 0.05]) {
      test(`at ${share * 100}% health it hits ${Math.round(EXECUTE * (1 - share) * 100)}% harder`, () => {
        arena.red.setHealth(arena.red.maxHealth * share);
        const { damage, expected } = strike(arena);
        expect(damage).toBeCloseTo(expected, 5);
      });
    }

    test('max rank: its top base', () => {
      const max = arenaWith();
      max.blue.maxAbility('R');
      max.blue.setLevel(18);
      max.red.setLevel(18);
      max.red.setHealth(max.red.maxHealth * 0.9);
      const { damage, expected } = strike(max, FATAL_STRIKE.maxRank);
      expect(damage).toBeCloseTo(expected, 5);
    });

    test('the execute reads the health when he lands: hurt in the air, it hits harder', () => {
      const healthy = arenaWith(new Vector(250, 0));
      const plain = strike(healthy).damage;

      const hurt = arenaWith(new Vector(250, 0));
      const hits = hitsOn(hurt, hurt.red, () => {
        hurt.castAbility(hurt.blue, 'R', { targetId: hurt.red.id });
        hurt.tick();
        hurt.red.setHealth(hurt.red.maxHealth * 0.3);
        untilLanded(hurt);
      });
      expect(hits[0].damage).toBeGreaterThan(plain * 1.25);
    });

    test("Spear Charge's armor penetration pierces it", () => {
      arena.castAbility(arena.blue, 'W');
      const { damage, expected } = strike(arena);
      expect(damage).toBeCloseTo(expected, 5);
      expect(arena.blue.getPenetration().armorFlat).toBe(PIERCING[0]);
    });

    test(`its range: ${FATAL_STRIKE.range! - 1} goes, ${FATAL_STRIKE.range! + 1} is refused (nothing spent)`, () => {
      expect(arenaWith(new Vector(FATAL_STRIKE.range! - 1, 0)).castAbility).toBeDefined();
      const near = arenaWith(new Vector(FATAL_STRIKE.range! - 1, 0));
      expect(near.castAbility(near.blue, 'R', { targetId: near.red.id }).success).toBe(true);
      const far = arenaWith(new Vector(FATAL_STRIKE.range! + 1, 0));
      const mana = far.blue.resource;
      expect(far.castAbility(far.blue, 'R', { targetId: far.red.id }).failReason).toBe('out_of_range');
      expect(far.blue.resource).toBe(mana);
    });

    test('a minion can be struck; an ally, a tower or a dead enemy cannot', () => {
      const minion = arena.addMinion(TEAM_RED, new Vector(120, 60));
      minion.health = minion.maxHealth * 0.5;
      const health = minion.health;
      expect(arena.castAbility(arena.blue, 'R', { targetId: minion.id }).success).toBe(true);
      untilLanded(arena);
      expect(minion.isDead || minion.health < health).toBe(true);

      const refusals = arenaWith();
      const ally = refusals.addMinion(TEAM_BLUE, new Vector(100, 30));
      const tower = refusals.addTower(TEAM_RED, new Vector(150, -40));
      for (const targetId of [ally.id, tower.id]) {
        expect(refusals.castAbility(refusals.blue, 'R', { targetId }).failReason).toBe('invalid_target');
      }
      refusals.red.takeDamage(1e9, 'true');
      expect(refusals.castAbility(refusals.blue, 'R', { targetId: refusals.red.id }).failReason).toBe('invalid_target');
    });

    test('rooted: refused, nothing spent', () => {
      arena.blue.applyEffect('root', 1, arena.red.id);
      const mana = arena.blue.resource;
      expect(arena.castAbility(arena.blue, 'R', { targetId: arena.red.id }).failReason).toBe('rooted');
      expect(arena.blue.resource).toBe(mana);
      expect(arena.blue.forcedMovement).toBeNull();
    });

    test('mana and cooldown by rank; not learned before level 6', () => {
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'R', { targetId: arena.red.id });
      expect(arena.blue.resource).toBe(mana - FATAL_STRIKE.manaCost![0]);
      expect(arena.blue.getAbilityCooldown('R')).toBe(FATAL_STRIKE.cooldown![0]);
      const max = arenaWith();
      max.blue.maxAbility('R');
      max.castAbility(max.blue, 'R', { targetId: max.red.id });
      expect(max.blue.getAbilityCooldown('R')).toBe(FATAL_STRIKE.cooldown![FATAL_STRIKE.maxRank - 1]);

      const level1 = createTestArena({ blueChampion: 'uruk', redChampion: 'magnus', learnAbilities: false });
      expect(level1.castAbility(level1.blue, 'R', { targetId: level1.red.id }).failReason).toBe('not_learned');
    });
  });
});
