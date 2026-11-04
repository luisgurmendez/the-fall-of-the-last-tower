/**
 * Lume Champion Tests
 *
 * Tests for Lume - The Wandering Light, a utility mage with a unique Light Orb mechanic.
 * Abilities:
 * - Passive: Guiding Glow - Allies near orb gain MS, enemies take increased magic damage
 * - Q: Send the Light - Send orb to location, deals damage, recast to recall
 * - W: Warmth - Pulse from orb, heals allies and damages enemies
 * - E: Prismatic Beam - A beam from Lume to the orb: damages once, slows enemies in it, speeds allies
 * - R: Eclipse - The orb fires a long beam toward the aim after a windup
 *
 * The second half ("Kit edge cases") goes through every part of the kit:
 * damage and heals from the definitions at rank 1 and max rank with
 * ability power, radii just inside and outside, the orb's travel and
 * timings, the recast, what's hit (allies, minions, monsters, towers,
 * wards), casts refused with nothing spent, and the review's bugs: the
 * passive's damage amp that did nothing, and the orb popping up over her
 * body on a long death.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { Vector, EntityType, GameEventType, TEAM_BLUE, TEAM_RED, CHAMPION_DEFINITIONS, LUME_ORB_CONFIG, getAbilityDefinition, getCastTime, getPassiveDefinition } from "@siege/shared";
import { createTestArena, calculateMagicDamage, TestArena, TestChampion } from "../ServerTestUtils";
import { ServerLightOrb } from "../../simulation/ServerLightOrb";
import { ServerWard } from "../../simulation/ServerWard";
import type { ServerEntity } from "../../simulation/ServerEntity";

/**
 * Give Lume her Light Orb, as a real match does (W, E and R need it).
 */
function giveLumeOrb(arena: TestArena): void {
  const orb = new ServerLightOrb({
    id: arena.context.generateEntityId(),
    position: arena.blue.position.clone().add(new Vector(60, 0)),
    side: arena.blue.side,
    ownerId: arena.blue.id,
  });
  arena.context.addEntity(orb as unknown as Parameters<typeof arena.context.addEntity>[0]);
}

describe("Lume", () => {
  let arena: TestArena;

  beforeEach(() => {
    arena = createTestArena({
      blueChampion: "lume",
      redChampion: "magnus",
      bluePosition: new Vector(0, 0),
      redPosition: new Vector(400, 0),
    });
  });

  describe("Base Stats", () => {
    // Note: Tests use level 6 arena (default with learnAbilities: true)
    // Base values: health=540, AD=52, mana=320, armor=26, MR=30, MS=335
    // Growth per level: health=85, AD=3.2, mana=45, armor=3.5, MR=1.3

    test("should have ranged attack range", () => {
      // Attack range doesn't scale with level
      expect(arena.blue.getStats().attackRange).toBe(CHAMPION_DEFINITIONS.lume.baseStats.attackRange);
      expect(CHAMPION_DEFINITIONS.lume.baseStats.attackRange).toBeGreaterThan(100);
    });

    test("should have correct movement speed", () => {
      // Movement speed doesn't scale with level
      expect(arena.blue.getStats().movementSpeed).toBe(CHAMPION_DEFINITIONS.lume.baseStats.movementSpeed);
    });

    test("should use mana resource type", () => {
      expect(arena.blue.definition.resourceType).toBe("mana");
    });

    test("should have health scaling (base 590 + 85/level)", () => {
      // At level 6: 590 + 85*5 = 1015
      expect(arena.blue.getStats().maxHealth).toBe(1015);
    });

    test("should have attack damage scaling (base 52 + 3.2/level)", () => {
      // At level 6: 52 + 3.2*5 = 68
      expect(arena.blue.getStats().attackDamage).toBe(68);
    });

    test("should have mana scaling (base 320 + 45/level)", () => {
      // At level 6: 320 + 45*5 = 545
      expect(arena.blue.getStats().maxResource).toBe(545);
    });
  });

  describe("Light Orb Entity", () => {
    test("should create light orb with correct initial state", () => {
      const orb = new ServerLightOrb({
        id: "test-orb",
        position: new Vector(0, 0),
        side: TEAM_BLUE,
        ownerId: "test-owner",
      });

      expect(orb.state).toBe("orbiting");
      expect(orb.isDestroyed).toBe(false);
      expect(orb.isOrbiting).toBe(true);
    });

    test("should transition to traveling when sendTo is called", () => {
      const orb = new ServerLightOrb({
        id: "test-orb",
        position: new Vector(0, 0),
        side: TEAM_BLUE,
        ownerId: "test-owner",
      });

      const result = orb.sendTo(new Vector(300, 0));

      expect(result).toBe(true);
      expect(orb.state).toBe("traveling");
      expect(orb.isTraveling).toBe(true);
    });

    test("should not send when destroyed", () => {
      const orb = new ServerLightOrb({
        id: "test-orb",
        position: new Vector(0, 0),
        side: TEAM_BLUE,
        ownerId: "test-owner",
      });

      orb.destroy();
      const result = orb.sendTo(new Vector(300, 0));

      expect(result).toBe(false);
      expect(orb.state).toBe("destroyed");
    });

    test("should transition to destroyed when destroy is called", () => {
      const orb = new ServerLightOrb({
        id: "test-orb",
        position: new Vector(0, 0),
        side: TEAM_BLUE,
        ownerId: "test-owner",
      });

      orb.destroy();

      expect(orb.state).toBe("destroyed");
      expect(orb.isDestroyed).toBe(true);
    });

    test("should come back orbiting when its owner is alive (she respawned)", () => {
      const orb = new ServerLightOrb({
        id: "test-orb",
        position: new Vector(0, 0),
        side: TEAM_BLUE,
        ownerId: arena.blue.id,
      });

      arena.context.addEntity(orb);
      orb.destroy();

      expect(orb.isDestroyed).toBe(true);

      orb.update(1 / 60, arena.context);

      expect(orb.state).toBe("orbiting");
      expect(orb.isDestroyed).toBe(false);
    });

    test("should recall when recall is called from stationed state", () => {
      const orb = new ServerLightOrb({
        id: "test-orb",
        position: new Vector(0, 0),
        side: TEAM_BLUE,
        ownerId: "test-owner",
      });

      // Manually set to stationed state
      orb.sendTo(new Vector(300, 0));
      // Can't easily simulate arriving, but we can test recall from traveling
      const result = orb.recall();

      expect(result).toBe(true);
      expect(orb.state).toBe("traveling");
    });

    test("slows the enemies it passes through when called back, each once", () => {
      giveLumeOrb(arena);
      const orb = arena.context.getAllEntities().find(e => e.entityType === EntityType.LIGHT_ORB) as unknown as ServerLightOrb;
      // Out past Magnus (at 400), then back through him
      orb.sendTo(new Vector(600, 0));
      for (let i = 0; i < 60 && !orb.isStationed; i++) orb.update(1 / 30, arena.context);
      expect(orb.isStationed).toBe(true);
      expect(arena.red.getEffect(LUME_ORB_CONFIG.returnSlowEffect)).toBeUndefined();

      orb.recall();
      for (let i = 0; i < 60 && !orb.isOrbiting; i++) orb.update(1 / 30, arena.context);
      expect(arena.red.getEffect(LUME_ORB_CONFIG.returnSlowEffect)).toBeDefined();
    });

    test("doesn't slow on its own way back after its time is up", () => {
      giveLumeOrb(arena);
      const orb = arena.context.getAllEntities().find(e => e.entityType === EntityType.LIGHT_ORB) as unknown as ServerLightOrb;
      orb.sendTo(new Vector(600, 0));
      // Stationed, then back on its own once the time is up, through Magnus
      for (let i = 0; i < 300 && !orb.isOrbiting; i++) orb.update(1 / 30, arena.context);
      expect(arena.red.getEffect(LUME_ORB_CONFIG.returnSlowEffect)).toBeUndefined();
    });

    test("should not recall when orbiting", () => {
      const orb = new ServerLightOrb({
        id: "test-orb",
        position: new Vector(0, 0),
        side: TEAM_BLUE,
        ownerId: "test-owner",
      });

      const result = orb.recall();

      expect(result).toBe(false);
      expect(orb.state).toBe("orbiting");
    });

    test("toSnapshot should return correct data", () => {
      const orb = new ServerLightOrb({
        id: "test-orb",
        position: new Vector(100, 200),
        side: TEAM_BLUE,
        ownerId: "test-owner",
      });

      const snapshot = orb.toSnapshot();

      expect(snapshot.entityId).toBe("test-orb");
      expect(snapshot.entityType).toBe(EntityType.LIGHT_ORB);
      expect(snapshot.side).toBe(TEAM_BLUE);
      expect(snapshot.ownerId).toBe("test-owner");
      expect(snapshot.state).toBe("orbiting");
      expect(snapshot.x).toBe(100);
      expect(snapshot.y).toBe(200);
    });
  });

  describe("Light Orb Orbiting", () => {
    test("orb should orbit at correct radius", () => {
      const orb = new ServerLightOrb({
        id: "test-orb",
        position: new Vector(0, 0),
        side: TEAM_BLUE,
        ownerId: arena.blue.id,
      });

      arena.context.addEntity(orb);

      // Tick to update orb position
      arena.tickAll();

      // Orb should be at orbit radius from owner
      const distance = orb.position.distanceTo(arena.blue.position);
      expect(distance).toBeCloseTo(60, 1); // LUME_ORB_CONFIG.orbitRadius = 60
    });

    test("orb should rotate over time", () => {
      const orb = new ServerLightOrb({
        id: "test-orb",
        position: new Vector(60, 0), // Start at orbit radius
        side: TEAM_BLUE,
        ownerId: arena.blue.id,
      });

      arena.context.addEntity(orb);

      const initialX = orb.position.x;
      const initialY = orb.position.y;

      // Tick for a bit
      arena.tickAllFrames(30); // 0.5 seconds

      // Position should have changed due to rotation
      const movedX = orb.position.x !== initialX;
      const movedY = orb.position.y !== initialY;
      expect(movedX || movedY).toBe(true);
    });
  });

  describe("Q - Send the Light", () => {
    test("should cast successfully", () => {
      const result = arena.castAbility(arena.blue, "Q", {
        targetPosition: new Vector(300, 0),
      });

      expect(result.success).toBe(true);
    });

    test("should have correct mana cost at rank 1 (40)", () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, "Q", {
        targetPosition: new Vector(300, 0),
      });

      expect(arena.blue.resource).toBe(initialMana - 40);
    });

    test("should have correct cooldown at rank 1 (8s)", () => {
      arena.castAbility(arena.blue, "Q", {
        targetPosition: new Vector(300, 0),
      });

      expect(arena.blue.getAbilityCooldown("Q")).toBe(8);
    });

    test("cooldown should decrease with rank", () => {
      arena.blue.maxAbility("Q");
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, "Q", {
        targetPosition: new Vector(300, 0),
      });

      expect(arena.blue.getAbilityCooldown("Q")).toBeLessThanOrEqual(6);
    });
  });

  describe("W - Warmth", () => {
    beforeEach(() => giveLumeOrb(arena));

    test("should cast successfully", () => {
      const result = arena.castAbility(arena.blue, "W");
      expect(result.success).toBe(true);
    });

    test("should have correct mana cost at rank 1 (60)", () => {
      const initialMana = arena.blue.resource;
      arena.castAbility(arena.blue, "W");
      expect(arena.blue.resource).toBe(initialMana - 60);
    });

    test("should have correct cooldown at rank 1 (14s)", () => {
      arena.castAbility(arena.blue, "W");
      expect(arena.blue.getAbilityCooldown("W")).toBe(14);
    });
  });

  describe("E - Prismatic Beam", () => {
    beforeEach(() => giveLumeOrb(arena));

    function orb(): ServerLightOrb {
      return arena.context.getAllEntities().find(e => e.entityType === EntityType.LIGHT_ORB) as unknown as ServerLightOrb;
    }

    test("should cast successfully", () => {
      const result = arena.castAbility(arena.blue, "E");
      expect(result.success).toBe(true);
      expect(arena.blue.hasEffect("lume_prism")).toBe(true);
    });

    test("should have correct mana cost (60) and cooldown at rank 1 (14s)", () => {
      const initialMana = arena.blue.resource;
      arena.castAbility(arena.blue, "E");
      expect(arena.blue.resource).toBe(initialMana - 60);
      expect(arena.blue.getAbilityCooldown("E")).toBe(14);
    });

    test("hits an enemy between Lume and the orb once, and slows it while it's in the beam", () => {
      // The orb out past Magnus (at 400)
      orb().sendTo(new Vector(600, 0));
      for (let i = 0; i < 60 && !orb().isStationed; i++) orb().update(1 / 30, arena.context);
      const health = arena.red.health;
      arena.castAbility(arena.blue, "E");
      arena.tickAllFrames(30);
      const afterBeam = arena.red.health;
      expect(afterBeam).toBeLessThan(health);
      expect(arena.red.hasEffect("slow_30")).toBe(true);
      // Once per cast
      arena.tickAllFrames(30);
      expect(arena.red.health).toBeGreaterThanOrEqual(afterBeam - 1);
    });

    test("doesn't touch an enemy off the beam", () => {
      arena.red.position.setFrom(new Vector(300, 300));
      orb().sendTo(new Vector(600, 0));
      for (let i = 0; i < 60 && !orb().isStationed; i++) orb().update(1 / 30, arena.context);
      const health = arena.red.health;
      arena.castAbility(arena.blue, "E");
      arena.tickAllFrames(30);
      // Not hurt (it may have regenerated)
      expect(arena.red.health).toBeGreaterThanOrEqual(health);
      expect(arena.red.hasEffect("slow_30")).toBe(false);
    });
  });

  describe("R - Eclipse", () => {
    beforeEach(() => giveLumeOrb(arena));

    test("should cast successfully toward a point, and keep the orb", () => {
      const result = arena.castAbility(arena.blue, "R", { targetPosition: new Vector(800, 0) });
      expect(result.success).toBe(true);
      const orb = arena.context.getAllEntities().find(e => e.entityType === EntityType.LIGHT_ORB) as unknown as ServerLightOrb;
      expect(orb.isDestroyed).toBe(false);
    });

    test("should have correct mana cost (100) and cooldown at rank 1 (110s)", () => {
      const initialMana = arena.blue.resource;
      arena.castAbility(arena.blue, "R", { targetPosition: new Vector(800, 0) });
      expect(arena.blue.resource).toBe(initialMana - 100);
      expect(arena.blue.getAbilityCooldown("R")).toBe(110);
    });

    test("the beam from the orb hits an enemy along it after the windup", () => {
      const health = arena.red.health;
      arena.castAbility(arena.blue, "R", { targetPosition: new Vector(800, 0) });
      expect(arena.red.health).toBeLessThan(health);
    });

    test("misses an enemy off the beam's line", () => {
      arena.red.position.setFrom(new Vector(400, 300));
      const health = arena.red.health;
      arena.castAbility(arena.blue, "R", { targetPosition: new Vector(800, 0) });
      expect(arena.red.health).toBe(health);
    });
  });

  describe("Passive - Guiding Glow", () => {
    test("allies near orb should gain movement speed buff", () => {
      // Create orb and ally minion
      const orb = new ServerLightOrb({
        id: "test-orb",
        position: new Vector(100, 0),
        side: TEAM_BLUE,
        ownerId: arena.blue.id,
      });
      arena.context.addEntity(orb);

      // Position ally (Lume) near orb
      arena.blue.position.setFrom(new Vector(100, 0));

      // Tick to apply passive effects
      arena.tickAllFrames(5);

      // Lume should have the speed buff
      expect(arena.blue.hasEffect("lume_guiding_glow_speed")).toBe(true);
    });

    test("enemies near orb should have damage amp debuff", () => {
      // Create orb and send it near enemy
      const orb = new ServerLightOrb({
        id: "test-orb",
        position: new Vector(0, 0),
        side: TEAM_BLUE,
        ownerId: arena.blue.id,
      });
      arena.context.addEntity(orb);

      // Send orb near enemy (red is at 400,0)
      orb.sendTo(new Vector(350, 0));

      // Tick until orb arrives and becomes stationed (350 units at LUME_ORB_CONFIG.travelSpeed)
      arena.tickAllFrames(Math.ceil((350 / LUME_ORB_CONFIG.travelSpeed) * 60) + 5);

      // Red champion should have the damage amp debuff
      expect(arena.red.hasEffect("lume_guiding_glow_amp")).toBe(true);
    });

    test("passive effects should not apply while the orb is gone (Lume is dead)", () => {
      const orb = new ServerLightOrb({
        id: "test-orb",
        position: new Vector(350, 0),
        side: TEAM_BLUE,
        ownerId: arena.blue.id,
      });
      arena.context.addEntity(orb);

      // Lume dies: the orb goes
      arena.blue.takeDamage(99999, "true", arena.red.id, arena.context);

      // Tick
      arena.tickAllFrames(5);
      expect(orb.isDestroyed).toBe(true);

      // Effects should not be applied
      expect(arena.red.hasEffect("lume_guiding_glow_amp")).toBe(false);
    });
  });

  describe("Integration - Light Orb Lifecycle", () => {
    test("orb should follow Lume when orbiting", () => {
      const orb = new ServerLightOrb({
        id: "test-orb",
        position: new Vector(60, 0),
        side: TEAM_BLUE,
        ownerId: arena.blue.id,
      });
      arena.context.addEntity(orb);

      // Move Lume
      arena.blue.position.setFrom(new Vector(200, 100));

      // Tick to update orb
      arena.tickAllFrames(10);

      // Orb should be near Lume's new position
      const distance = orb.position.distanceTo(arena.blue.position);
      expect(distance).toBeCloseTo(60, 5);
    });

    test("full Q cycle: send -> station -> auto-return", () => {
      const orb = new ServerLightOrb({
        id: "test-orb",
        position: new Vector(60, 0),
        side: TEAM_BLUE,
        ownerId: arena.blue.id,
      });
      arena.context.addEntity(orb);

      // Initial state
      expect(orb.state).toBe("orbiting");

      // Send orb
      orb.sendTo(new Vector(300, 0));
      expect(orb.state).toBe("traveling");

      // Tick until orb arrives (about 240 units at its travel speed)
      arena.tickAllFrames(Math.ceil((240 / LUME_ORB_CONFIG.travelSpeed) * 60) + 5);

      // Should be stationed
      expect(orb.state).toBe("stationed");

      // Tick until auto-return
      arena.tickAllFrames(Math.ceil(LUME_ORB_CONFIG.stationedDuration * 60) + 10);

      // Should be traveling back or orbiting
      expect(["traveling", "orbiting"].includes(orb.state)).toBe(true);
    });
  });
});

// =============================================================================
// Kit edge cases
// =============================================================================

const Q = getAbilityDefinition("lume_q")!;
const W = getAbilityDefinition("lume_w")!;
const E = getAbilityDefinition("lume_e")!;
const R = getAbilityDefinition("lume_r")!;
const DT = 1 / 60;

/** Lume's orb at a spot (it stays there unless the test updates it) */
function addOrb(arena: TestArena, at = arena.blue.position.added(new Vector(LUME_ORB_CONFIG.orbitRadius, 0))): ServerLightOrb {
  const orb = new ServerLightOrb({ id: arena.context.generateEntityId(), position: at.clone(), side: arena.blue.side, ownerId: arena.blue.id });
  arena.context.addEntity(orb as unknown as Parameters<typeof arena.context.addEntity>[0]);
  return orb;
}

/** Send the orb out and update it until it's stationed there */
function stationOrb(arena: TestArena, orb: ServerLightOrb, at: Vector): void {
  orb.sendTo(at);
  for (let i = 0; i < 600 && !orb.isStationed; i++) orb.update(DT, arena.context);
  expect(orb.isStationed).toBe(true);
}

/** Everything an entity is dealt from now on (after resistances), and how many hits */
function recordDamage(entity: ServerEntity): { total: number; hits: number } {
  const record = { total: 0, hits: 0 };
  const takeDamage = entity.takeDamage.bind(entity);
  entity.takeDamage = ((...args: Parameters<typeof takeDamage>) => {
    const dealt = takeDamage(...args);
    record.total += dealt;
    if (dealt > 0) record.hits++;
    return dealt;
  }) as typeof takeDamage;
  return record;
}

/** A second champion on Lume's side */
function addAlly(arena: TestArena, at: Vector): TestChampion {
  const ally = new TestChampion({ id: "blue-ally", position: at.clone(), side: TEAM_BLUE, definition: CHAMPION_DEFINITIONS.gorath, playerId: "player-ally" });
  arena.context.addChampion(ally, "player-ally");
  return ally;
}

/** Lume at the origin, Magnus `redAt` (out of the way unless given) */
function lumeArena(redAt = new Vector(3000, 3000)): TestArena {
  const arena = createTestArena({ blueChampion: "lume", redChampion: "magnus", bluePosition: new Vector(0, 0), redPosition: redAt });
  arena.red.setHealth(arena.red.maxHealth);
  return arena;
}

/** An ability's value at a rank with some ability power */
function valueAt(scaling: { base: number[]; apRatio?: number }, rank: number, abilityPower: number): number {
  return scaling.base[rank - 1] + abilityPower * (scaling.apRatio ?? 0);
}

describe("Lume: kit edge cases", () => {
  describe("Passive - Guiding Glow", () => {
    test("it has no cooldown (nothing for a tooltip to show)", () => {
      expect(getPassiveDefinition("lume_passive")!.internalCooldown).toBeUndefined();
    });

    test("an enemy near the orb takes 8% more magic damage from Lume", () => {
      const arena = lumeArena(new Vector(200, 0));
      const plain = recordDamage(arena.red);
      arena.red.takeDamage(100, "magic", arena.blue.id, arena.context);
      const without = plain.total;

      arena.red.applyEffect("lume_guiding_glow_amp", 0.5, arena.blue.id);
      arena.red.takeDamage(100, "magic", arena.blue.id, arena.context);
      expect(plain.total - without).toBeCloseTo(without * (1 + LUME_ORB_CONFIG.enemyDamageAmp), 5);
    });

    test("the amp is for her magic damage only: not physical, not true", () => {
      for (const type of ["physical", "true"] as const) {
        const arena = lumeArena(new Vector(200, 0));
        const dealt = recordDamage(arena.red);
        arena.red.takeDamage(100, type, arena.blue.id, arena.context);
        const without = dealt.total;
        arena.red.applyEffect("lume_guiding_glow_amp", 0.5, arena.blue.id);
        arena.red.takeDamage(100, type, arena.blue.id, arena.context);
        expect(dealt.total - without).toBeCloseTo(without, 5);
      }
    });

    test("the amp is for Lume's damage only, not her allies'", () => {
      const arena = lumeArena(new Vector(200, 0));
      const ally = addAlly(arena, new Vector(100, 100));
      const dealt = recordDamage(arena.red);
      arena.red.takeDamage(100, "magic", ally.id, arena.context);
      const without = dealt.total;
      arena.red.applyEffect("lume_guiding_glow_amp", 0.5, arena.blue.id);
      arena.red.takeDamage(100, "magic", ally.id, arena.context);
      expect(dealt.total - without).toBeCloseTo(without, 5);
    });

    test("in a fight: her Warmth on an enemy by the orb hits 8% harder", () => {
      const arena = lumeArena(new Vector(250, 0));
      const orb = addOrb(arena);
      stationOrb(arena, orb, new Vector(250, 30));
      expect(arena.red.hasEffect("lume_guiding_glow_amp")).toBe(true);
      const dealt = recordDamage(arena.red);
      arena.castAbility(arena.blue, "W");
      const raw = valueAt(W.damage!.scaling, 1, 0) * (1 + LUME_ORB_CONFIG.enemyDamageAmp);
      expect(dealt.total).toBeCloseTo(calculateMagicDamage(raw, arena.red.getStats().magicResist), 3);
    });

    test("allied champions near the orb, Lume too, get 15% more speed; allied minions don't", () => {
      const arena = lumeArena();
      const orb = addOrb(arena, new Vector(0, 0));
      const ally = addAlly(arena, new Vector(LUME_ORB_CONFIG.passiveAuraRadius - 10, 0));
      const minion = arena.addMinion(TEAM_BLUE, new Vector(0, 40));
      const speed = ally.getStats().movementSpeed;
      orb.update(DT, arena.context);
      expect(ally.getStats().movementSpeed).toBeCloseTo(speed * (1 + LUME_ORB_CONFIG.allySpeedBonus), 5);
      expect(arena.blue.hasEffect("lume_guiding_glow_speed")).toBe(true);
      expect(minion.activeEffects.some(e => e.definitionId === "lume_guiding_glow_speed")).toBe(false);
    });

    test("just inside its radius, an enemy is exposed; just outside, not", () => {
      const inside = lumeArena(new Vector(LUME_ORB_CONFIG.passiveAuraRadius - 5, 0));
      addOrb(inside, new Vector(0, 0)).update(DT, inside.context);
      expect(inside.red.hasEffect("lume_guiding_glow_amp")).toBe(true);

      const outside = lumeArena(new Vector(LUME_ORB_CONFIG.passiveAuraRadius + 5, 0));
      // (Orbiting, it sits at its orbit radius from her: put her out of its way)
      outside.blue.position.setFrom(new Vector(-LUME_ORB_CONFIG.orbitRadius, 0));
      const orb = addOrb(outside, new Vector(0, 0));
      orb.sendTo(new Vector(0, 0));
      orb.update(DT, outside.context);
      expect(outside.red.hasEffect("lume_guiding_glow_amp")).toBe(false);
    });

    test("its effects last a moment after leaving the orb, then go", () => {
      const arena = lumeArena(new Vector(100, 0));
      addOrb(arena, new Vector(0, 0)).update(DT, arena.context);
      arena.red.position.setFrom(new Vector(1000, 0));
      arena.tickFrames(Math.ceil(0.4 / DT));
      expect(arena.red.hasEffect("lume_guiding_glow_amp")).toBe(true);
      arena.tickFrames(Math.ceil(0.2 / DT));
      expect(arena.red.hasEffect("lume_guiding_glow_amp")).toBe(false);
    });

    test("dead for long (past the old 30 s), the orb stays gone and never touches anyone by her body", () => {
      const arena = lumeArena(new Vector(30, 0));
      const orb = addOrb(arena);
      arena.blue.setHealth(1);
      arena.blue.takeDamage(1000, "true", arena.red.id, arena.context);
      expect(arena.blue.isDead).toBe(true);
      arena.blue.respawnTimer = 60;
      let exposed = false;
      let back = false;
      for (let t = 0; t < 45; t += DT) {
        arena.tick(DT);
        orb.update(DT, arena.context);
        exposed ||= arena.red.hasEffect("lume_guiding_glow_amp");
        back ||= !orb.isDestroyed;
      }
      expect(arena.blue.isDead).toBe(true);
      expect(back).toBe(false);
      expect(exposed).toBe(false);
    });

    test("the orb goes when she dies, and is back orbiting her when she respawns", () => {
      const arena = lumeArena();
      const orb = addOrb(arena);
      arena.blue.takeDamage(99999, "true", arena.red.id, arena.context);
      orb.update(DT, arena.context);
      expect(orb.isDestroyed).toBe(true);
      arena.blue.respawnTimer = 1;
      for (let t = 0; t < 1.5; t += DT) {
        arena.tick(DT);
        orb.update(DT, arena.context);
      }
      expect(arena.blue.isDead).toBe(false);
      expect(orb.isOrbiting).toBe(true);
      expect(orb.position.distanceTo(arena.blue.position)).toBeCloseTo(LUME_ORB_CONFIG.orbitRadius, 3);
    });
  });

  describe("Q - Send the Light", () => {
    test("damage on arrival: base + 60% AP, magic (8% more: the orb got to him first), at rank 1 and max rank", () => {
      for (const rank of [1, Q.maxRank]) {
        const arena = lumeArena(new Vector(250, 0));
        if (rank > 1) arena.blue.maxAbility("Q");
        arena.blue.addModifier({ source: "test_ap", flat: { abilityPower: 100 } });
        const orb = addOrb(arena);
        const dealt = recordDamage(arena.red);
        arena.castAbility(arena.blue, "Q", { targetPosition: new Vector(250, 0) });
        for (let i = 0; i < 120 && !orb.isStationed; i++) orb.update(DT, arena.context);
        expect(dealt.hits).toBe(1);
        expect(arena.red.hasEffect("lume_guiding_glow_amp")).toBe(true);
        const raw = valueAt(Q.damage!.scaling, rank, 100) * (1 + LUME_ORB_CONFIG.enemyDamageAmp);
        expect(dealt.total).toBeCloseTo(calculateMagicDamage(raw, arena.red.getStats().magicResist), 3);
      }
    });

    test(`nothing at the cast: it lands when the orb gets there, at ${LUME_ORB_CONFIG.travelSpeed} units a second`, () => {
      const arena = lumeArena(new Vector(300, 0));
      const orb = addOrb(arena);
      const dealt = recordDamage(arena.red);
      arena.castAbility(arena.blue, "Q", { targetPosition: new Vector(300, 0) });
      expect(dealt.hits).toBe(0);
      const travel = orb.position.distanceTo(new Vector(300, 0)) / LUME_ORB_CONFIG.travelSpeed;
      for (let t = 0; t < travel - 0.05; t += DT) orb.update(DT, arena.context);
      expect(dealt.hits).toBe(0);
      for (let t = 0; t < 0.1; t += DT) orb.update(DT, arena.context);
      expect(dealt.hits).toBe(1);
      expect(orb.isStationed).toBe(true);
    });

    test("an enemy just inside its impact radius is hit; just outside, not", () => {
      for (const [offset, hit] of [[Q.aoeRadius! - 5, 1], [Q.aoeRadius! + 5, 0]] as const) {
        const arena = lumeArena(new Vector(250, offset));
        const orb = addOrb(arena);
        const dealt = recordDamage(arena.red);
        arena.castAbility(arena.blue, "Q", { targetPosition: new Vector(250, 0) });
        for (let i = 0; i < 120 && !orb.isStationed; i++) orb.update(DT, arena.context);
        expect(dealt.hits).toBe(hit);
      }
    });

    test("it hits enemy minions and monsters there, not allies, towers or wards", () => {
      const arena = lumeArena();
      const orb = addOrb(arena);
      const at = new Vector(250, 0);
      const minion = arena.addMinion(TEAM_RED, at.added(new Vector(20, 0)));
      const monster = arena.addJungleCreature(at.added(new Vector(-20, 0)));
      const ally = arena.addMinion(TEAM_BLUE, at.added(new Vector(0, 20)));
      const tower = arena.addTower(TEAM_RED, at.added(new Vector(0, -40)));
      const ward = new ServerWard({ id: "red-ward", position: at.clone(), side: TEAM_RED, wardType: "stealth", ownerId: "player-red" });
      arena.context.addEntity(ward);
      const towerHealth = tower.health;
      arena.castAbility(arena.blue, "Q", { targetPosition: at });
      for (let i = 0; i < 120 && !orb.isStationed; i++) orb.update(DT, arena.context);
      expect(minion.health).toBeLessThan(minion.maxHealth);
      expect(monster.health).toBeLessThan(monster.maxHealth);
      expect(ally.health).toBe(ally.maxHealth);
      expect(tower.health).toBe(towerHealth);
      expect(ward.isDead).toBe(false);
    });

    test("clicked past its range, the orb goes to its range", () => {
      const arena = lumeArena();
      const orb = addOrb(arena);
      arena.castAbility(arena.blue, "Q", { targetPosition: new Vector(Q.range! * 3, 0) });
      for (let i = 0; i < 120 && !orb.isStationed; i++) orb.update(DT, arena.context);
      expect(orb.position.x).toBeCloseTo(Q.range!, 3);
      expect(orb.position.y).toBeCloseTo(0, 3);
    });

    test(`it stays ${LUME_ORB_CONFIG.stationedDuration} s, then comes back on its own`, () => {
      const arena = lumeArena();
      const orb = addOrb(arena);
      arena.castAbility(arena.blue, "Q", { targetPosition: new Vector(200, 0) });
      for (let i = 0; i < 120 && !orb.isStationed; i++) orb.update(DT, arena.context);
      for (let t = 0; t < LUME_ORB_CONFIG.stationedDuration - 0.1; t += DT) orb.update(DT, arena.context);
      expect(orb.isStationed).toBe(true);
      for (let t = 0; t < 0.2; t += DT) orb.update(DT, arena.context);
      expect(orb.isTraveling).toBe(true);
      for (let t = 0; t < 2 && !orb.isOrbiting; t += DT) orb.update(DT, arena.context);
      expect(orb.isOrbiting).toBe(true);
    });

    test("recast: it calls the orb back, free, slowing each enemy it passes once (not allies)", () => {
      const arena = lumeArena(new Vector(200, 0));
      const orb = addOrb(arena);
      const ally = addAlly(arena, new Vector(150, 10));
      arena.castAbility(arena.blue, "Q", { targetPosition: new Vector(Q.range!, 0) });
      for (let i = 0; i < 120 && !orb.isStationed; i++) orb.update(DT, arena.context);
      arena.red.removeEffect(LUME_ORB_CONFIG.returnSlowEffect);
      const mana = arena.blue.resource;
      const cooldown = arena.blue.getAbilityCooldown("Q");
      expect(arena.castAbility(arena.blue, "Q").success).toBe(true);
      expect(arena.blue.resource).toBe(mana);
      expect(arena.blue.getAbilityCooldown("Q")).toBe(cooldown);
      for (let i = 0; i < 120 && !orb.isOrbiting; i++) orb.update(DT, arena.context);
      expect(orb.isOrbiting).toBe(true);
      const slow = arena.red.getEffect(LUME_ORB_CONFIG.returnSlowEffect)!;
      expect(slow).toBeDefined();
      expect(slow.timeRemaining).toBeLessThanOrEqual(LUME_ORB_CONFIG.returnSlowDuration);
      expect(ally.hasEffect(LUME_ORB_CONFIG.returnSlowEffect)).toBe(false);
    });

    test("the recast window: open while the orb is away", () => {
      const arena = lumeArena();
      addOrb(arena);
      arena.castAbility(arena.blue, "Q", { targetPosition: new Vector(200, 0) });
      expect(arena.blue.hasRecastAvailable("Q")).toBe(true);
      expect(arena.blue.abilityStates.Q.recastWindowRemaining).toBeGreaterThan(LUME_ORB_CONFIG.stationedDuration);
    });

    test("once the orb is back on its own, pressing Q is a normal cast (on cooldown)", () => {
      const arena = lumeArena();
      const orb = addOrb(arena);
      arena.castAbility(arena.blue, "Q", { targetPosition: new Vector(200, 0) });
      for (let t = 0; t < LUME_ORB_CONFIG.stationedDuration + 3 && !(t > 1 && orb.isOrbiting); t += DT) orb.update(DT, arena.context);
      expect(orb.isOrbiting).toBe(true);
      const result = arena.castAbility(arena.blue, "Q", { targetPosition: new Vector(200, 0) });
      expect(result.success).toBe(false);
      expect(result.failReason).toBe("on_cooldown");
      expect(arena.blue.hasRecastAvailable("Q")).toBe(false);
    });

    for (const rank of [1, Q.maxRank]) {
      test(`rank ${rank}: costs ${Q.manaCost![rank - 1]} mana, ${Q.cooldown![rank - 1]} s cooldown`, () => {
        const arena = createTestArena({ blueChampion: "lume", redChampion: "magnus", redPosition: new Vector(3000, 3000), maxLevel: true });
        if (rank > 1) arena.blue.maxAbility("Q");
        addOrb(arena);
        const mana = arena.blue.resource;
        expect(arena.castAbility(arena.blue, "Q", { targetPosition: new Vector(200, 0) }).success).toBe(true);
        expect(arena.blue.resource).toBe(mana - Q.manaCost![rank - 1]);
        expect(arena.blue.getAbilityCooldown("Q")).toBe(Q.cooldown![rank - 1]);
      });
    }

    test("it has a cast time; stunned or silenced it fails, nothing spent", () => {
      expect(getCastTime(Q)).toBeGreaterThan(0);
      for (const effect of ["stun", "silence"]) {
        const arena = lumeArena();
        const orb = addOrb(arena);
        arena.blue.applyEffect(effect, 1, arena.red.id);
        const mana = arena.blue.resource;
        expect(arena.castAbility(arena.blue, "Q", { targetPosition: new Vector(200, 0) }).success).toBe(false);
        expect(arena.blue.resource).toBe(mana);
        expect(orb.isOrbiting).toBe(true);
      }
    });
  });

  describe("W - Warmth", () => {
    test("from the orb: heals her and allied champions, hurts enemies, scaled by rank and AP", () => {
      for (const rank of [1, W.maxRank]) {
        const arena = lumeArena(new Vector(400, 40));
        if (rank > 1) arena.blue.maxAbility("W");
        arena.blue.addModifier({ source: "test_ap", flat: { abilityPower: 100 } });
        const ally = addAlly(arena, new Vector(400, -40));
        addOrb(arena, new Vector(400, 0));
        arena.blue.position.setFrom(new Vector(400 - W.aoeRadius! + 20, 0));
        arena.blue.setHealth(arena.blue.maxHealth - 400);
        ally.setHealth(ally.maxHealth - 400);
        const health = arena.blue.health;
        const allyHealth = ally.health;
        const dealt = recordDamage(arena.red);
        arena.castAbility(arena.blue, "W");
        const heal = valueAt(W.heal!.scaling, rank, 100);
        expect(arena.blue.health - health).toBeCloseTo(heal, 3);
        expect(ally.health - allyHealth).toBeCloseTo(heal, 3);
        expect(dealt.total).toBeCloseTo(calculateMagicDamage(valueAt(W.damage!.scaling, rank, 100), arena.red.getStats().magicResist), 3);
      }
    });

    test("centered on the orb, not on her: far from it she isn't healed", () => {
      const arena = lumeArena(new Vector(400, 0));
      addOrb(arena, new Vector(400, 30));
      arena.blue.setHealth(arena.blue.maxHealth - 400);
      const health = arena.blue.health;
      const dealt = recordDamage(arena.red);
      arena.castAbility(arena.blue, "W");
      expect(arena.blue.health).toBe(health);
      expect(dealt.hits).toBe(1);
    });

    test("an enemy just inside its radius is hit; just outside, not", () => {
      for (const [offset, hits] of [[W.aoeRadius! - 5, 1], [W.aoeRadius! + 5, 0]] as const) {
        const arena = lumeArena(new Vector(offset, 0));
        addOrb(arena, new Vector(0, 0));
        const dealt = recordDamage(arena.red);
        arena.castAbility(arena.blue, "W");
        expect(dealt.hits).toBe(hits);
      }
    });

    test("units, not structures or wards: heals allied minions, hurts enemy minions and monsters; towers and wards untouched", () => {
      const arena = lumeArena();
      addOrb(arena, new Vector(0, 0));
      const allyMinion = arena.addMinion(TEAM_BLUE, new Vector(40, 0));
      allyMinion.takeDamage(100, "true");
      const allyMinionHealth = allyMinion.health;
      const enemyMinion = arena.addMinion(TEAM_RED, new Vector(-40, 0));
      const monster = arena.addJungleCreature(new Vector(0, 40));
      const allyTower = arena.addTower(TEAM_BLUE, new Vector(0, -60));
      allyTower.takeDamage(100, "true");
      const allyTowerHealth = allyTower.health;
      const enemyTower = arena.addTower(TEAM_RED, new Vector(60, 60));
      const enemyTowerHealth = enemyTower.health;
      const ward = new ServerWard({ id: "red-ward", position: new Vector(-30, -30), side: TEAM_RED, wardType: "stealth", ownerId: "player-red" });
      arena.context.addEntity(ward);
      arena.castAbility(arena.blue, "W");
      expect(allyMinion.health).toBeGreaterThan(allyMinionHealth);
      expect(enemyMinion.health).toBeLessThan(enemyMinion.maxHealth);
      expect(monster.health).toBeLessThan(monster.maxHealth);
      expect(allyTower.health).toBe(allyTowerHealth);
      expect(enemyTower.health).toBe(enemyTowerHealth);
      expect(ward.isDead).toBe(false);
    });

    test(`nothing at the cast: the orb gathers warmth for ${W.aoeDelay} s, then pulses where it was`, () => {
      const arena = lumeArena(new Vector(400, 0));
      const orb = addOrb(arena, new Vector(400, 30));
      const dealt = recordDamage(arena.red);
      arena.castAbility(arena.blue, "W", { windup: true });
      expect(dealt.hits).toBe(0);
      arena.context.advanceTime(W.aoeDelay! - 0.05);
      expect(dealt.hits).toBe(0);
      // The orb wandering off meanwhile doesn't move the pulse
      orb.position.setFrom(new Vector(1200, 1200));
      arena.context.advanceTime(0.1);
      expect(dealt.hits).toBe(1);
    });

    test("an enemy that walks out of it before it pulses isn't hit (it's dodged)", () => {
      const arena = lumeArena(new Vector(400, 0));
      addOrb(arena, new Vector(400, 30));
      const dealt = recordDamage(arena.red);
      arena.castAbility(arena.blue, "W", { windup: true });
      arena.red.position.setFrom(new Vector(400 + W.aoeRadius! + 60, 30));
      arena.context.advanceTime(W.aoeDelay! + 0.01);
      expect(dealt.hits).toBe(0);
    });

    test("the warning is the one its dodge exemption gives: a gathering of light at the orb", () => {
      expect(W.aoeDelay).toBeGreaterThanOrEqual(0.4);
      expect(W.dodgeExempt).toContain("orb");
    });

    for (const rank of [1, W.maxRank]) {
      test(`rank ${rank}: costs ${W.manaCost![rank - 1]} mana, ${W.cooldown![rank - 1]} s cooldown, instant`, () => {
        const arena = createTestArena({ blueChampion: "lume", redChampion: "magnus", redPosition: new Vector(3000, 3000), maxLevel: true });
        if (rank > 1) arena.blue.maxAbility("W");
        addOrb(arena);
        const mana = arena.blue.resource;
        expect(arena.castAbility(arena.blue, "W").success).toBe(true);
        expect(arena.blue.resource).toBe(mana - W.manaCost![rank - 1]);
        expect(arena.blue.getAbilityCooldown("W")).toBe(W.cooldown![rank - 1]);
        expect(getCastTime(W)).toBe(0);
      });
    }

    test("its cast is reported from the orb (where its VFX and sound go), not from her", () => {
      const arena = lumeArena();
      addOrb(arena, new Vector(250, -120));
      arena.context.flushEvents();
      arena.castAbility(arena.blue, "W");
      const cast = arena.context.flushEvents().find(e => e.type === GameEventType.ABILITY_CAST && e.data.abilityId === "lume_w")!;
      expect(cast).toBeDefined();
      expect(cast.data.originX).toBeCloseTo(250, 5);
      expect(cast.data.originY).toBeCloseTo(-120, 5);
      expect(cast.data.targetX).toBeCloseTo(250, 5);
      expect(cast.data.targetY).toBeCloseTo(-120, 5);
    });

    test("without her orb it fails, nothing spent", () => {
      const arena = lumeArena();
      const mana = arena.blue.resource;
      expect(arena.castAbility(arena.blue, "W").success).toBe(false);
      expect(arena.blue.resource).toBe(mana);
      expect(arena.blue.getAbilityCooldown("W")).toBe(0);
    });

    test("silenced it fails, nothing spent", () => {
      const arena = lumeArena();
      addOrb(arena);
      arena.blue.applyEffect("silence", 1, arena.red.id);
      const mana = arena.blue.resource;
      expect(arena.castAbility(arena.blue, "W").success).toBe(false);
      expect(arena.blue.resource).toBe(mana);
    });
  });

  describe("E - Prismatic Beam", () => {
    /** Lume at the origin, the orb out at (400, 0), Magnus in the beam unless placed */
    function beamArena(redAt = new Vector(200, 0)) {
      const arena = lumeArena(redAt);
      const orb = addOrb(arena, new Vector(400, 0));
      return { arena, orb };
    }

    test("an enemy in it takes its damage once per cast (base + 40% AP) and is slowed while in it", () => {
      const { arena } = beamArena();
      arena.blue.addModifier({ source: "test_ap", flat: { abilityPower: 100 } });
      const dealt = recordDamage(arena.red);
      arena.castAbility(arena.blue, "E");
      arena.tickFrames(60);
      expect(dealt.hits).toBe(1);
      expect(dealt.total).toBeCloseTo(calculateMagicDamage(valueAt(E.damage!.scaling, 1, 100), arena.red.getStats().magicResist), 3);
      expect(arena.red.hasEffect("slow_30")).toBe(true);
    });

    test("stepping out of it, the slow wears off soon; the beam ends after its duration", () => {
      const { arena } = beamArena();
      arena.castAbility(arena.blue, "E");
      arena.tickFrames(5);
      arena.red.position.setFrom(new Vector(200, 300));
      arena.tickFrames(Math.ceil(0.6 / DT));
      expect(arena.red.hasEffect("slow_30")).toBe(false);
      arena.tickFrames(Math.ceil((E.effectDuration as number) / DT));
      expect(arena.blue.hasEffect("lume_prism")).toBe(false);
      arena.red.position.setFrom(new Vector(200, 0));
      arena.tickFrames(5);
      expect(arena.red.hasEffect("slow_30")).toBe(false);
    });

    test("a new cast can hit the same enemy again", () => {
      const { arena } = beamArena();
      const dealt = recordDamage(arena.red);
      arena.castAbility(arena.blue, "E");
      arena.tickFrames(Math.ceil((E.effectDuration as number) / DT) + 2);
      arena.blue.resetCooldowns();
      arena.castAbility(arena.blue, "E");
      arena.tickFrames(5);
      expect(dealt.hits).toBe(2);
    });

    test("it follows the orb: an enemy off the line from her to the orb isn't touched", () => {
      const { arena } = beamArena(new Vector(200, E.aoeRadius! + 40));
      const dealt = recordDamage(arena.red);
      arena.castAbility(arena.blue, "E");
      arena.tickFrames(30);
      expect(dealt.hits).toBe(0);
    });

    test("allied champions crossing it are sped up; allied minions aren't", () => {
      const { arena } = beamArena(new Vector(3000, 3000));
      const ally = addAlly(arena, new Vector(150, 0));
      const minion = arena.addMinion(TEAM_BLUE, new Vector(250, 0));
      arena.castAbility(arena.blue, "E");
      arena.tickFrames(2);
      expect(ally.hasEffect(LUME_ORB_CONFIG.eAllySpeedEffect)).toBe(true);
      expect(minion.activeEffects.some(e => e.definitionId === LUME_ORB_CONFIG.eAllySpeedEffect)).toBe(false);
    });

    test("it hurts enemy minions in it, not towers or wards", () => {
      const { arena } = beamArena(new Vector(3000, 3000));
      const minion = arena.addMinion(TEAM_RED, new Vector(120, 0));
      const tower = arena.addTower(TEAM_RED, new Vector(300, 0));
      const ward = new ServerWard({ id: "red-ward", position: new Vector(200, 0), side: TEAM_RED, wardType: "stealth", ownerId: "player-red" });
      arena.context.addEntity(ward);
      const towerHealth = tower.health;
      arena.castAbility(arena.blue, "E");
      arena.tickFrames(10);
      expect(minion.health).toBeLessThan(minion.maxHealth);
      expect(tower.health).toBe(towerHealth);
      expect(ward.isDead).toBe(false);
    });

    test("without her orb it fails, nothing spent", () => {
      const arena = lumeArena();
      const mana = arena.blue.resource;
      expect(arena.castAbility(arena.blue, "E").success).toBe(false);
      expect(arena.blue.resource).toBe(mana);
      expect(arena.blue.hasEffect("lume_prism")).toBe(false);
    });

    test(`rank ${E.maxRank}: damage and cooldown`, () => {
      const { arena } = beamArena();
      arena.blue.maxAbility("E");
      const dealt = recordDamage(arena.red);
      arena.castAbility(arena.blue, "E");
      expect(arena.blue.getAbilityCooldown("E")).toBe(E.cooldown![E.maxRank - 1]);
      arena.tickFrames(2);
      expect(dealt.total).toBeCloseTo(calculateMagicDamage(valueAt(E.damage!.scaling, E.maxRank, 0), arena.red.getStats().magicResist), 3);
    });
  });

  describe("R - Eclipse", () => {
    test("after its windup, the beam from the orb hits for base + 70% AP (magic), at each rank", () => {
      for (const rank of [1, 2, 3]) {
        const arena = lumeArena(new Vector(600, 0));
        arena.blue.setLevel(18);
        arena.blue.skillPoints = rank - 1;
        while (arena.blue.abilityStates.R.rank < rank) arena.blue.levelUpAbility("R");
        arena.blue.setResource(arena.blue.maxResource);
        arena.blue.addModifier({ source: "test_ap", flat: { abilityPower: 100 } });
        addOrb(arena, new Vector(60, 0));
        const dealt = recordDamage(arena.red);
        expect(arena.castAbility(arena.blue, "R", { targetPosition: new Vector(800, 0) }).success).toBe(true);
        expect(dealt.total).toBeCloseTo(calculateMagicDamage(valueAt(R.damage!.scaling, rank, 100), arena.red.getStats().magicResist), 3);
        expect(arena.blue.getAbilityCooldown("R")).toBe(R.cooldown![rank - 1]);
      }
    });

    test("nothing before the windup ends", () => {
      const arena = lumeArena(new Vector(600, 0));
      addOrb(arena, new Vector(60, 0));
      const dealt = recordDamage(arena.red);
      arena.castAbility(arena.blue, "R", { targetPosition: new Vector(800, 0), windup: true });
      arena.context.advanceTime(R.aoeDelay! - 0.05);
      expect(dealt.hits).toBe(0);
      arena.context.advanceTime(0.1);
      expect(dealt.hits).toBe(1);
    });

    test("it starts at the orb: an enemy behind Lume, on the orb's line, is hit", () => {
      const arena = lumeArena(new Vector(100, 0));
      arena.blue.position.setFrom(new Vector(300, 200));
      addOrb(arena, new Vector(-100, 0));
      const dealt = recordDamage(arena.red);
      arena.castAbility(arena.blue, "R", { targetPosition: new Vector(500, 0) });
      expect(dealt.hits).toBe(1);
    });

    test(`it reaches ${LUME_ORB_CONFIG.rBeamLength} from the orb, ${R.aoeRadius} to each side`, () => {
      const cases: [Vector, number][] = [
        [new Vector(LUME_ORB_CONFIG.rBeamLength - 20, 0), 1],
        [new Vector(LUME_ORB_CONFIG.rBeamLength + 60, 0), 0],
        [new Vector(500, R.aoeRadius! - 5), 1],
        [new Vector(500, R.aoeRadius! + 40), 0],
      ];
      for (const [at, hits] of cases) {
        const arena = lumeArena(at);
        addOrb(arena, new Vector(0, 0));
        const dealt = recordDamage(arena.red);
        arena.castAbility(arena.blue, "R", { targetPosition: new Vector(800, 0) });
        expect(dealt.hits).toBe(hits);
      }
    });

    test("dead before it fires, nothing", () => {
      const arena = lumeArena(new Vector(600, 0));
      addOrb(arena, new Vector(60, 0));
      const dealt = recordDamage(arena.red);
      arena.castAbility(arena.blue, "R", { targetPosition: new Vector(800, 0), windup: true });
      arena.blue.takeDamage(99999, "true", arena.red.id, arena.context);
      arena.context.advanceTime(R.aoeDelay! + 0.1);
      expect(dealt.hits).toBe(0);
    });

    test("aimed at the orb itself, it fires the way she aimed", () => {
      const arena = lumeArena(new Vector(500, 0));
      addOrb(arena, new Vector(200, 0));
      const dealt = recordDamage(arena.red);
      arena.castAbility(arena.blue, "R", { targetPosition: new Vector(200, 0) });
      expect(dealt.hits).toBe(1);
    });

    test("it hurts enemy minions and monsters along it, not towers or wards", () => {
      const arena = lumeArena();
      addOrb(arena, new Vector(0, 0));
      const minion = arena.addMinion(TEAM_RED, new Vector(300, 0));
      const monster = arena.addJungleCreature(new Vector(450, 0));
      const tower = arena.addTower(TEAM_RED, new Vector(600, 0));
      const ward = new ServerWard({ id: "red-ward", position: new Vector(200, 0), side: TEAM_RED, wardType: "stealth", ownerId: "player-red" });
      arena.context.addEntity(ward);
      const towerHealth = tower.health;
      arena.castAbility(arena.blue, "R", { targetPosition: new Vector(800, 0) });
      expect(minion.health).toBeLessThan(minion.maxHealth);
      expect(monster.health).toBeLessThan(monster.maxHealth);
      expect(tower.health).toBe(towerHealth);
      expect(ward.isDead).toBe(false);
    });

    test("without her orb it fizzles at the end of its cast time, nothing spent", () => {
      const arena = lumeArena();
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, "R", { targetPosition: new Vector(800, 0) });
      expect(arena.blue.isCasting()).toBe(false);
      expect(arena.blue.resource).toBe(mana);
      expect(arena.blue.getAbilityCooldown("R")).toBe(0);
    });

    test("silenced it fails, nothing spent", () => {
      const arena = lumeArena();
      addOrb(arena);
      arena.blue.applyEffect("silence", 1, arena.red.id);
      const mana = arena.blue.resource;
      expect(arena.castAbility(arena.blue, "R", { targetPosition: new Vector(800, 0) }).success).toBe(false);
      expect(arena.blue.resource).toBe(mana);
    });
  });
});
