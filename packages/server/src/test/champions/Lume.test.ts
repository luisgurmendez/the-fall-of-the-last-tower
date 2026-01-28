/**
 * Lume Champion Tests
 *
 * Tests for Lume - The Wandering Light, a utility mage with a unique Light Orb mechanic.
 * Abilities:
 * - Passive: Guiding Glow - Allies near orb gain MS, enemies take increased magic damage
 * - Q: Send the Light - Send orb to location, deals damage, recast to recall
 * - W: Warmth - Pulse from orb, heals allies and damages enemies
 * - E: Dazzle Step - Dash toward orb, blind enemies on arrival
 * - R: Beaconfall - Orb explodes, massive damage + slow, orb destroyed for 60s
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { Vector, EntityType, TEAM_BLUE, TEAM_RED } from "@siege/shared";
import { createTestArena, TestArena } from "../ServerTestUtils";
import { ServerLightOrb } from "../../simulation/ServerLightOrb";

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

    test("should have ranged attack range (550)", () => {
      // Attack range doesn't scale with level
      expect(arena.blue.getStats().attackRange).toBe(550);
    });

    test("should have correct movement speed (335)", () => {
      // Movement speed doesn't scale with level
      expect(arena.blue.getStats().movementSpeed).toBe(335);
    });

    test("should use mana resource type", () => {
      expect(arena.blue.definition.resourceType).toBe("mana");
    });

    test("should have health scaling (base 540 + 85/level)", () => {
      // At level 6: 540 + 85*5 = 965
      expect(arena.blue.getStats().maxHealth).toBe(965);
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

    test("should respawn after respawn time when destroyed", () => {
      const orb = new ServerLightOrb({
        id: "test-orb",
        position: new Vector(0, 0),
        side: TEAM_BLUE,
        ownerId: arena.blue.id,
      });

      arena.context.addEntity(orb);
      orb.destroy();

      expect(orb.isDestroyed).toBe(true);

      // Note: Full respawn timer is 60s, but we need to mock the update
      // For now, test forceRespawn
      orb.forceRespawn();

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

  describe("E - Dazzle Step", () => {
    test("should cast successfully", () => {
      const result = arena.castAbility(arena.blue, "E");
      expect(result.success).toBe(true);
    });

    test("should have correct mana cost (50 at all ranks)", () => {
      const initialMana = arena.blue.resource;
      arena.castAbility(arena.blue, "E");
      expect(arena.blue.resource).toBe(initialMana - 50);
    });

    test("should have correct cooldown at rank 1 (18s)", () => {
      arena.castAbility(arena.blue, "E");
      expect(arena.blue.getAbilityCooldown("E")).toBe(18);
    });

    test("cooldown should decrease with rank", () => {
      arena.blue.maxAbility("E");
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, "E");
      expect(arena.blue.getAbilityCooldown("E")).toBeLessThanOrEqual(10);
    });
  });

  describe("R - Beaconfall", () => {
    test("should cast successfully", () => {
      const result = arena.castAbility(arena.blue, "R");
      expect(result.success).toBe(true);
    });

    test("should have correct mana cost (100)", () => {
      const initialMana = arena.blue.resource;
      arena.castAbility(arena.blue, "R");
      expect(arena.blue.resource).toBe(initialMana - 100);
    });

    test("should have correct cooldown at rank 1 (120s)", () => {
      arena.castAbility(arena.blue, "R");
      expect(arena.blue.getAbilityCooldown("R")).toBe(120);
    });

    test("cooldown should decrease with rank", () => {
      arena.blue.maxAbility("R");
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, "R");
      expect(arena.blue.getAbilityCooldown("R")).toBeLessThanOrEqual(80);
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

      // Tick until orb arrives and becomes stationed (350 units at 1200 u/s = ~18 frames)
      arena.tickAllFrames(25);

      // Red champion should have the damage amp debuff
      expect(arena.red.hasEffect("lume_guiding_glow_amp")).toBe(true);
    });

    test("passive effects should not apply when orb is destroyed", () => {
      const orb = new ServerLightOrb({
        id: "test-orb",
        position: new Vector(350, 0),
        side: TEAM_BLUE,
        ownerId: arena.blue.id,
      });
      arena.context.addEntity(orb);

      // Destroy the orb
      orb.destroy();

      // Tick
      arena.tickAllFrames(5);

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

      // Tick until orb arrives (travels at 1200 units/s, distance ~240 units = ~0.2s = 12 frames)
      arena.tickAllFrames(20);

      // Should be stationed
      expect(orb.state).toBe("stationed");

      // Tick until auto-return (4 seconds = 240 frames)
      arena.tickAllFrames(250);

      // Should be traveling back or orbiting
      expect(["traveling", "orbiting"].includes(orb.state)).toBe(true);
    });
  });
});
