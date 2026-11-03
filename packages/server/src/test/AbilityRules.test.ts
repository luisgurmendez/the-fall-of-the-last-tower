/**
 * Rules every ability follows, whoever casts it:
 * - Only units are hit: champions, minions, monsters and (when an ability
 *   says so) structures and wards. Projectiles, zones, Lume's orb and
 *   healing blossoms are never hit, so they never stop a skillshot or die
 *   to one.
 * - A ground-targeted ability clicked past its range goes off at its range.
 * - A dash hits only what its ability affects: not towers, not wards.
 * - Rooted or grounded, nothing that moves the caster goes off.
 * - Heals and shields reach units, never structures.
 * - An ally-targeted ability with no ally under the cursor (or one it
 *   doesn't affect, like a minion for a champions-only shield) is cast on
 *   the caster.
 */

import { describe, test, expect } from 'bun:test';
import {
  Vector,
  EntityType,
  CHAMPION_DEFINITIONS,
  MAPS,
  TEAM_BLUE,
  TEAM_RED,
  canAbilityAffectEntityType,
  getAbilityDefinition,
  type AbilitySlot,
} from '@siege/shared';
import { createTestArena, type TestArena, type TestChampion } from './ServerTestUtils';
import { ServerZone } from '../simulation/ServerZone';
import { ServerLightOrb } from '../simulation/ServerLightOrb';
import { ServerBlossom } from '../simulation/ServerBlossom';
import { ServerWard } from '../simulation/ServerWard';
import type { ServerEntity } from '../simulation/ServerEntity';
import { passiveTriggerSystem } from '../systems/PassiveTriggerSystem';

const SLOTS: AbilitySlot[] = ['Q', 'W', 'E', 'R'];
const DT = 1 / 60;

/** Every ability of every champion */
const ALL_ABILITIES = Object.values(CHAMPION_DEFINITIONS).flatMap(def =>
  SLOTS.map(slot => ({ championId: def.id, slot, definition: getAbilityDefinition(def.abilities[slot])! })));

/**
 * Step only champions and projectiles (zones, orbs and blossoms stay where
 * the test put them).
 */
function stepProjectiles(arena: TestArena, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) {
    arena.tick(DT);
    for (const entity of arena.context.getAllEntities()) {
      if (entity.entityType === EntityType.PROJECTILE) entity.update(DT, arena.context);
    }
  }
}

function addEnemyZone(arena: TestArena, owner: TestChampion, at: Vector): ServerZone {
  const zone = new ServerZone({
    id: arena.context.generateEntityId(),
    position: at,
    side: owner.side,
    radius: 60,
    duration: 10,
    sourceId: owner.id,
    abilityId: owner.definition.abilities.E,
    zoneType: 'slow',
  });
  arena.context.addEntity(zone);
  return zone;
}

function addOrb(arena: TestArena, owner: TestChampion, at: Vector): ServerLightOrb {
  const orb = new ServerLightOrb({ id: arena.context.generateEntityId(), position: at, side: owner.side, ownerId: owner.id });
  arena.context.addEntity(orb as unknown as ServerEntity);
  return orb;
}

function entitiesOfType(arena: TestArena, type: EntityType): ServerEntity[] {
  return arena.context.getAllEntities().filter(entity => entity.entityType === type);
}

// =============================================================================
// Only units are hit
// =============================================================================

describe('Only units are hit by abilities', () => {
  const NOT_UNITS = [EntityType.PROJECTILE, EntityType.ZONE, EntityType.LIGHT_ORB, EntityType.BLOSSOM];

  test('no ability affects a projectile, a zone, an orb or a blossom', () => {
    for (const { definition } of ALL_ABILITIES) {
      for (const type of NOT_UNITS) {
        expect({ ability: definition.id, type, affects: canAbilityAffectEntityType(definition, type) })
          .toEqual({ ability: definition.id, type, affects: false });
      }
    }
  });

  test('an unknown entity type is not affected either', () => {
    const fireball = getAbilityDefinition('magnus_fireball');
    expect(canAbilityAffectEntityType(fireball, 99)).toBe(false);
  });

  test('units still are: champions, minions and monsters by default; structures and wards only when it says so', () => {
    const fireball = getAbilityDefinition('magnus_fireball');
    expect(canAbilityAffectEntityType(fireball, EntityType.CHAMPION)).toBe(true);
    expect(canAbilityAffectEntityType(fireball, EntityType.MINION)).toBe(true);
    expect(canAbilityAffectEntityType(fireball, EntityType.JUNGLE_CAMP)).toBe(true);
    expect(canAbilityAffectEntityType(fireball, EntityType.TOWER)).toBe(false);
    expect(canAbilityAffectEntityType(fireball, EntityType.WARD)).toBe(false);
    expect(canAbilityAffectEntityType(undefined, EntityType.CHAMPION)).toBe(false);
  });

  test("a skillshot flies through an enemy zone, hits the champion behind it, and the zone stays", () => {
    const arena = createTestArena({ blueChampion: 'vex', redChampion: 'magnus', redPosition: new Vector(300, 0) });
    const zone = addEnemyZone(arena, arena.red, new Vector(150, 0));
    const health = arena.red.health;

    expect(arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(300, 0) }).success).toBe(true);
    stepProjectiles(arena, 1);

    expect(arena.red.health).toBeLessThan(health);
    expect(zone.isDead).toBe(false);
    expect(arena.context.getEntity(zone.id)).toBe(zone);
  });

  test("Vile's arrow isn't stopped by a zone, so its recast doesn't open there", () => {
    const arena = createTestArena({ blueChampion: 'vile', redChampion: 'magnus', redPosition: new Vector(300, 0) });
    addEnemyZone(arena, arena.red, new Vector(120, 0));

    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(300, 0) });
    stepProjectiles(arena, 0.35);
    // Past the zone and not at the champion yet: nothing to recast to
    expect(arena.blue.hasRecastAvailable('Q')).toBe(false);
    stepProjectiles(arena, 1);
    expect(arena.blue.hasRecastAvailable('Q')).toBe(true);
    expect(arena.blue.getRecastHitPosition('Q')!.x).toBeGreaterThan(200);
  });

  test("a skillshot flies through Lume's orb, and the orb stays alive", () => {
    const arena = createTestArena({ blueChampion: 'magnus', redChampion: 'lume', redPosition: new Vector(320, 0) });
    const orb = addOrb(arena, arena.red, new Vector(150, 0));
    const health = arena.red.health;

    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(320, 0) });
    stepProjectiles(arena, 1);

    expect(orb.isDead).toBe(false);
    expect(arena.red.health).toBeLessThan(health);
  });

  test('a skillshot flies through a healing blossom', () => {
    const arena = createTestArena({ blueChampion: 'caelum', redChampion: 'magnus', redPosition: new Vector(300, 0) });
    const blossom = new ServerBlossom({ id: 'blossom', position: new Vector(150, 0) }, MAPS.narrows.BLOSSOMS);
    arena.context.addEntity(blossom);
    const health = arena.red.health;

    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(300, 0) });
    stepProjectiles(arena, 1);

    expect(arena.red.health).toBeLessThan(health);
    expect(blossom.isDead).toBe(false);
  });

  test("two skillshots cross: neither stops the other, and both land", () => {
    const arena = createTestArena({ blueChampion: 'magnus', redChampion: 'caelum', redPosition: new Vector(400, 0) });
    const blueHealth = arena.blue.health;
    const redHealth = arena.red.health;

    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(400, 0) });
    arena.castAbility(arena.red, 'Q', { targetPosition: new Vector(0, 0) });
    stepProjectiles(arena, 1.2);

    expect(arena.blue.health).toBeLessThan(blueHealth);
    expect(arena.red.health).toBeLessThan(redHealth);
  });

  test("an area landing on an enemy zone doesn't remove it", () => {
    const arena = createTestArena({ blueChampion: 'caelum', redChampion: 'magnus', redPosition: new Vector(600, 0) });
    const zone = addEnemyZone(arena, arena.red, new Vector(200, 0));

    expect(arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(200, 0) }).success).toBe(true);
    arena.tickAllFrames(10);

    expect(zone.isDead).toBe(false);
    expect(arena.context.getEntity(zone.id)).toBe(zone);
  });

  test("a minion still stops a skillshot (it's a unit)", () => {
    const arena = createTestArena({ blueChampion: 'vex', redChampion: 'magnus', redPosition: new Vector(300, 0) });
    const minion = arena.addMinion(TEAM_RED, new Vector(150, 0));
    const health = arena.red.health;
    const minionHealth = minion.health;

    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(300, 0) });
    stepProjectiles(arena, 1);

    expect(minion.health).toBeLessThan(minionHealth);
    // (It regenerates a little meanwhile)
    expect(arena.red.health).toBeGreaterThanOrEqual(health);
  });
});

// =============================================================================
// Ground targets past their range
// =============================================================================

describe('A ground-targeted ability clicked past its range', () => {
  const GROUND = ALL_ABILITIES.filter(({ definition }) => definition.targetType === 'ground_target' && definition.range);

  /** A fresh arena for each cast (an ability may leave its caster channeling or silenced) */
  function prepare(championId: string): TestArena {
    const arena = createTestArena({ blueChampion: championId, redChampion: 'gorath', redPosition: new Vector(3000, 3000) });
    if (championId === 'lume') addOrb(arena, arena.blue, new Vector(60, 0));
    return arena;
  }

  for (const { championId, slot, definition } of GROUND) {
    test(`${definition.id} (${championId} ${slot}) goes off in every direction, at its range`, () => {
      const range = definition.range!;
      const failures: string[] = [];
      for (let i = 0; i < 36; i++) {
        const angle = (i / 36) * Math.PI * 2;
        for (const distance of [range * 2.5, range + 1e-9, range + 0.5]) {
          const arena = prepare(championId);
          const at = new Vector(Math.cos(angle) * distance, Math.sin(angle) * distance);
          const result = arena.castAbility(arena.blue, slot, { targetPosition: at });
          if (!result.success) failures.push(`${(angle * 180 / Math.PI).toFixed(0)}° at ${distance.toFixed(3)}: ${result.failReason}`);
        }
      }
      expect(failures).toEqual([]);
    });
  }

  test('inside its range it goes off where clicked', () => {
    const arena = createTestArena({ blueChampion: 'caelum', redChampion: 'gorath', redPosition: new Vector(3000, 3000) });
    const result = arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(100, 50), windup: true });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Dashes hit only what their ability affects
// =============================================================================

describe('Dashes hit only what their ability affects', () => {
  function dashThrough(championId: string, slot: AbilitySlot) {
    const arena = createTestArena({ blueChampion: championId, redChampion: 'gorath', redPosition: new Vector(3000, 3000) });
    const tower = arena.addTower(TEAM_RED, new Vector(110, 0));
    const ward = new ServerWard({ id: 'red-ward', position: new Vector(60, 10), side: TEAM_RED, wardType: 'stealth', ownerId: 'player-red' });
    arena.context.addEntity(ward);
    const minion = arena.addMinion(TEAM_RED, new Vector(120, -20));
    const towerHealth = tower.health;
    const minionHealth = minion.health;
    expect(arena.castAbility(arena.blue, slot, { targetPosition: new Vector(400, 0) }).success).toBe(true);
    arena.tickFrames(60);
    return { arena, tower, ward, minion, towerHealth, minionHealth };
  }

  test("Kael's charge doesn't hurt a tower or kill a ward it runs through, but hits a minion", () => {
    const { tower, ward, minion, towerHealth, minionHealth } = dashThrough('warrior', 'E');
    expect(tower.health).toBe(towerHealth);
    expect(ward.isDead).toBe(false);
    expect(minion.health).toBeLessThan(minionHealth);
  });

  test("Vex's dash doesn't hurt a tower or kill a ward it runs through", () => {
    const { tower, ward, towerHealth } = dashThrough('vex', 'E');
    expect(tower.health).toBe(towerHealth);
    expect(ward.isDead).toBe(false);
  });

  test("a dash doesn't hit allied units", () => {
    const arena = createTestArena({ blueChampion: 'warrior', redChampion: 'gorath', redPosition: new Vector(3000, 3000) });
    const ally = arena.addMinion(TEAM_BLUE, new Vector(120, 0));
    const health = ally.health;
    arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(400, 0) });
    arena.tickFrames(60);
    expect(ally.health).toBe(health);
    expect(ally.activeEffects.length).toBe(0);
  });

  test('a dash hits each enemy once, however long it overlaps it', () => {
    const arena = createTestArena({ blueChampion: 'warrior', redChampion: 'gorath', redPosition: new Vector(120, 0) });
    const health = arena.red.health;
    let hits = 0;
    const takeDamage = arena.red.takeDamage.bind(arena.red);
    arena.red.takeDamage = ((...args: Parameters<typeof takeDamage>) => { hits++; return takeDamage(...args); }) as typeof takeDamage;
    arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(400, 0) });
    arena.tickFrames(60);
    expect(hits).toBe(1);
    expect(arena.red.health).toBeLessThan(health);
  });
});

// =============================================================================
// Rooted, nothing moves the caster
// =============================================================================

/** Every ability that moves its caster, how to aim it, and what it needs first */
const MOBILITY: { championId: string; slot: AbilitySlot; aimAtEnemy?: boolean }[] = [
  { championId: 'warrior', slot: 'E' },
  { championId: 'warrior', slot: 'R', aimAtEnemy: true },
  { championId: 'vex', slot: 'E' },
  { championId: 'uruk', slot: 'R', aimAtEnemy: true },
  { championId: 'oitboil', slot: 'E' },
  { championId: 'elora', slot: 'E' },
  { championId: 'fenris', slot: 'E', aimAtEnemy: true },
  { championId: 'hop', slot: 'E' },
  { championId: 'zhakrul', slot: 'E' },
];

describe('Rooted or grounded, nothing moves the caster', () => {
  for (const { championId, slot, aimAtEnemy } of MOBILITY) {
    for (const cc of ['root', 'grounded']) {
      test(`${championId} ${slot} doesn't go off with ${cc}: nothing spent, nothing moved`, () => {
        const arena = createTestArena({ blueChampion: championId, redChampion: 'gorath', redPosition: new Vector(150, 0) });
        arena.blue.applyEffect(cc, 2, arena.red.id);
        const mana = arena.blue.resource;
        const result = arena.castAbility(arena.blue, slot, { targetPosition: new Vector(150, 0), targetId: aimAtEnemy ? arena.red.id : undefined });
        arena.tickFrames(30);

        expect(result.success).toBe(false);
        expect(result.failReason).toBe('rooted');
        expect(arena.blue.position.x).toBeCloseTo(0, 5);
        expect(arena.blue.position.y).toBeCloseTo(0, 5);
        expect(arena.blue.resource).toBeGreaterThanOrEqual(mana);
        expect(arena.blue.getAbilityCooldown(slot)).toBe(0);
      });
    }

    test(`${championId} ${slot} goes off when only slowed`, () => {
      const arena = createTestArena({ blueChampion: championId, redChampion: 'gorath', redPosition: new Vector(150, 0) });
      arena.blue.applyEffect('slow_30', 2, arena.red.id);
      const result = arena.castAbility(arena.blue, slot, { targetPosition: new Vector(150, 0), targetId: aimAtEnemy ? arena.red.id : undefined });
      expect(result.success).toBe(true);
    });
  }

  describe("Vile's arrow recast", () => {
    function hitWithArrow(): TestArena {
      const arena = createTestArena({ blueChampion: 'vile', redChampion: 'gorath', redPosition: new Vector(250, 0) });
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(250, 0) });
      stepProjectiles(arena, 1);
      expect(arena.blue.hasRecastAvailable('Q')).toBe(true);
      return arena;
    }

    test("rooted, the recast doesn't go off, and it's still there when the root ends", () => {
      const arena = hitWithArrow();
      arena.blue.applyEffect('root', 0.5, arena.red.id);
      const result = arena.castAbility(arena.blue, 'Q');
      arena.tickFrames(20);
      expect(result.success).toBe(false);
      expect(result.failReason).toBe('rooted');
      expect(arena.blue.position.x).toBeCloseTo(0, 5);
      expect(arena.blue.hasRecastAvailable('Q')).toBe(true);

      arena.tickFrames(40);
      expect(arena.castAbility(arena.blue, 'Q').success).toBe(true);
      arena.tickFrames(40);
      expect(arena.blue.position.x).toBeGreaterThan(100);
    });

    test("in her own Veil (which roots her) the recast doesn't go off", () => {
      const arena = hitWithArrow();
      arena.blue.applyEffect('vile_rooted_self', 2, arena.blue.id);
      const result = arena.castAbility(arena.blue, 'Q');
      arena.tickFrames(20);
      expect(result.success).toBe(false);
      expect(arena.blue.position.x).toBeCloseTo(0, 5);
    });

    test('stunned, the recast doesn\'t go off', () => {
      const arena = hitWithArrow();
      arena.blue.applyEffect('stun', 0.5, arena.red.id);
      expect(arena.castAbility(arena.blue, 'Q').success).toBe(false);
    });
  });
});

// =============================================================================
// Heals and shields reach units only
// =============================================================================

describe('Heals and shields never reach structures', () => {
  function hurtTower(arena: TestArena, at: Vector) {
    const tower = arena.addTower(TEAM_BLUE, at);
    tower.takeDamage(500, 'true');
    return { tower, health: tower.health };
  }

  test("Elara's Blessed Presence heals an allied minion near her, not an allied tower", () => {
    const arena = createTestArena({ blueChampion: 'elara', redChampion: 'gorath', redPosition: new Vector(3000, 3000) });
    const { tower, health } = hurtTower(arena, new Vector(100, 0));
    const minion = arena.addMinion(TEAM_BLUE, new Vector(-100, 0));
    minion.takeDamage(150, 'true');
    const minionHealth = minion.health;
    for (let i = 0; i < 60 * 3; i++) {
      arena.tick(DT);
      passiveTriggerSystem.processAlwaysPassives(DT, [arena.blue], arena.context);
    }
    expect(tower.health).toBe(health);
    expect(minion.health).toBeGreaterThan(minionHealth);
  });

  test("Elara's Divine Intervention heals units around her, not an allied tower, and the tower isn't counted as healing", () => {
    const arena = createTestArena({ blueChampion: 'elara', redChampion: 'gorath', redPosition: new Vector(3000, 3000) });
    const { tower, health } = hurtTower(arena, new Vector(100, 0));
    arena.blue.setLevel(6);
    arena.blue.setHealth(arena.blue.maxHealth);
    arena.castAbility(arena.blue, 'R');
    expect(tower.health).toBe(health);
    expect(arena.blue.matchStats.toTotals().healing).toBe(0);
  });

  test("Elara's heal can't be cast on an allied tower", () => {
    const arena = createTestArena({ blueChampion: 'elara', redChampion: 'gorath', redPosition: new Vector(3000, 3000) });
    const { tower, health } = hurtTower(arena, new Vector(100, 0));
    arena.castAbility(arena.blue, 'Q', { targetId: tower.id, targetPosition: tower.position.clone() });
    expect(tower.health).toBe(health);
  });

  test("Lume's Warmth heals and hurts units around the orb, not towers", () => {
    const arena = createTestArena({ blueChampion: 'lume', redChampion: 'gorath', redPosition: new Vector(100, 60) });
    addOrb(arena, arena.blue, new Vector(60, 0));
    const { tower, health } = hurtTower(arena, new Vector(100, 0));
    const enemyTower = arena.addTower(TEAM_RED, new Vector(60, -60));
    const enemyTowerHealth = enemyTower.health;
    const redHealth = arena.red.health;
    arena.blue.takeDamage(200, 'true');
    const lumeHealth = arena.blue.health;

    expect(arena.castAbility(arena.blue, 'W').success).toBe(true);

    expect(tower.health).toBe(health);
    expect(enemyTower.health).toBe(enemyTowerHealth);
    expect(arena.red.health).toBeLessThan(redHealth);
    expect(arena.blue.health).toBeGreaterThan(lumeHealth);
  });

  test("Lume's Warmth doesn't destroy an enemy ward or trap by the orb", () => {
    const arena = createTestArena({ blueChampion: 'lume', redChampion: 'gorath', redPosition: new Vector(3000, 3000) });
    addOrb(arena, arena.blue, new Vector(60, 0));
    const ward = new ServerWard({ id: 'red-ward', position: new Vector(80, 0), side: TEAM_RED, wardType: 'stealth', ownerId: 'player-red' });
    arena.context.addEntity(ward);
    arena.castAbility(arena.blue, 'W');
    expect(ward.isDead).toBe(false);
  });
});

// =============================================================================
// Ally-targeted abilities
// =============================================================================

describe('Ally-targeted abilities', () => {
  function supportArena(championId: string) {
    return createTestArena({ blueChampion: championId, redChampion: 'gorath', redPosition: new Vector(3000, 3000) });
  }

  for (const [championId, slot] of [['elara', 'W'], ['caelum', 'W']] as const) {
    describe(`${championId} ${slot}`, () => {
      test('with no ally under the cursor, it goes on the caster', () => {
        const arena = supportArena(championId);
        const result = arena.castAbility(arena.blue, slot, { targetPosition: new Vector(100, 0) });
        expect(result.success).toBe(true);
        const definition = getAbilityDefinition(arena.blue.definition.abilities[slot])!;
        if (definition.shield) expect(arena.blue.getTotalShieldAmount()).toBeGreaterThan(0);
        for (const effectId of definition.appliesEffects ?? []) expect(arena.blue.hasEffect(effectId)).toBe(true);
      });

      test("on an allied minion it goes on the caster instead (it's for champions)", () => {
        const arena = supportArena(championId);
        const minion = arena.addMinion(TEAM_BLUE, new Vector(100, 0));
        const result = arena.castAbility(arena.blue, slot, { targetId: minion.id, targetPosition: minion.position.clone() });
        expect(result.success).toBe(true);
        const definition = getAbilityDefinition(arena.blue.definition.abilities[slot])!;
        for (const effectId of definition.appliesEffects ?? []) {
          expect(arena.blue.hasEffect(effectId)).toBe(true);
          expect(minion.activeEffects.some(effect => effect.definitionId === effectId)).toBe(false);
        }
        if (definition.shield) expect(arena.blue.getTotalShieldAmount()).toBeGreaterThan(0);
      });

      test('on an allied champion in range it goes on that champion', () => {
        const arena = supportArena(championId);
        const ally = new (arena.blue.constructor as typeof TestChampion)({
          id: 'blue-ally', position: new Vector(150, 0), side: TEAM_BLUE, definition: CHAMPION_DEFINITIONS.gorath, playerId: 'player-ally',
        });
        arena.context.addChampion(ally, 'player-ally');
        const result = arena.castAbility(arena.blue, slot, { targetId: ally.id, targetPosition: ally.position.clone() });
        expect(result.success).toBe(true);
        const definition = getAbilityDefinition(arena.blue.definition.abilities[slot])!;
        if (definition.shield) {
          expect(ally.getTotalShieldAmount()).toBeGreaterThan(0);
          expect(arena.blue.getTotalShieldAmount()).toBe(0);
        }
        for (const effectId of definition.appliesEffects ?? []) {
          expect(ally.hasEffect(effectId)).toBe(true);
          expect(arena.blue.hasEffect(effectId)).toBe(false);
        }
      });

      test('on an allied champion out of range it fails, with nothing spent', () => {
        const arena = supportArena(championId);
        const ally = new (arena.blue.constructor as typeof TestChampion)({
          id: 'blue-ally', position: new Vector(1500, 0), side: TEAM_BLUE, definition: CHAMPION_DEFINITIONS.gorath, playerId: 'player-ally',
        });
        arena.context.addChampion(ally, 'player-ally');
        const mana = arena.blue.resource;
        const result = arena.castAbility(arena.blue, slot, { targetId: ally.id, targetPosition: ally.position.clone() });
        expect(result.success).toBe(false);
        expect(result.failReason).toBe('out_of_range');
        expect(arena.blue.resource).toBe(mana);
        expect(arena.blue.getAbilityCooldown(slot)).toBe(0);
      });

      test('on an allied tower it goes on the caster, not the tower', () => {
        const arena = supportArena(championId);
        const tower = arena.addTower(TEAM_BLUE, new Vector(100, 0));
        const result = arena.castAbility(arena.blue, slot, { targetId: tower.id, targetPosition: tower.position.clone() });
        expect(result.success).toBe(true);
        const definition = getAbilityDefinition(arena.blue.definition.abilities[slot])!;
        for (const effectId of definition.appliesEffects ?? []) expect(arena.blue.hasEffect(effectId)).toBe(true);
      });
    });
  }

  test("Elara's heal with no ally under the cursor heals herself", () => {
    const arena = supportArena('elara');
    arena.blue.takeDamage(200, 'true');
    const health = arena.blue.health;
    expect(arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(100, 0) }).success).toBe(true);
    expect(arena.blue.health).toBeGreaterThan(health);
  });

  test("Elara's heal still heals an allied minion she targets", () => {
    const arena = supportArena('elara');
    const minion = arena.addMinion(TEAM_BLUE, new Vector(100, 0));
    minion.takeDamage(150, 'true');
    const health = minion.health;
    arena.castAbility(arena.blue, 'Q', { targetId: minion.id, targetPosition: minion.position.clone() });
    expect(minion.health).toBeGreaterThan(health);
  });

  test("an enemy under the cursor isn't healed: it fails, with nothing spent", () => {
    const arena = createTestArena({ blueChampion: 'elara', redChampion: 'gorath', redPosition: new Vector(150, 0) });
    arena.red.takeDamage(200, 'true');
    const health = arena.red.health;
    const mana = arena.blue.resource;
    const result = arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id, targetPosition: arena.red.position.clone() });
    expect(result.success).toBe(false);
    expect(arena.red.health).toBe(health);
    expect(arena.blue.resource).toBe(mana);
  });

  test("Caelum's Martyr can't go on himself: with no ally it fails, with nothing spent", () => {
    const arena = supportArena('caelum');
    const health = arena.blue.health;
    const result = arena.castAbility(arena.blue, 'R', { targetPosition: new Vector(100, 0) });
    expect(result.success).toBe(false);
    expect(arena.blue.health).toBe(health);
    expect(arena.blue.getAbilityCooldown('R')).toBe(0);
  });
});
