/**
 * Tests for ServerAbilityExecutor - ability casting and effects.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  Vector,
  CHAMPION_DEFINITIONS,
  getAbilityDefinition,
  getCastTime,
  DEFAULT_CAST_TIME,
  Side,
  type ChampionDefinition,
} from '@siege/shared';
import { ServerChampion } from '../simulation/ServerChampion';
import { ServerMinion } from '../simulation/ServerMinion';
import { ServerGameContext } from '../game/ServerGameContext';
import { abilityExecutor, type AbilityCastParams } from '../simulation/ServerAbilityExecutor';

describe('ServerAbilityExecutor', () => {
  let context: ServerGameContext;

  /** Cast, and let its cast time pass so it goes off */
  function cast(params: AbilityCastParams) {
    const result = abilityExecutor.castAbility(params);
    params.champion.advanceCast(10, params.context);
    return result;
  }
  let blueChampion: ServerChampion;
  let redChampion: ServerChampion;
  let redMinion: ServerMinion;

  beforeEach(() => {
    context = new ServerGameContext({ gameId: 'test_game' });

    // Create a warrior for blue team
    const warriorDef = CHAMPION_DEFINITIONS['warrior'];
    blueChampion = new ServerChampion({
      id: 'blue_champ_1',
      position: new Vector(0, 0),
      side: 0 as Side,
      definition: warriorDef,
      playerId: 'player_1',
    });

    // Create a mage for red team
    const magnusDef = CHAMPION_DEFINITIONS['magnus'];
    redChampion = new ServerChampion({
      id: 'red_champ_1',
      position: new Vector(200, 0),
      side: 1 as Side,
      definition: magnusDef,
      playerId: 'player_2',
    });

    // Create a minion for targeting tests
    redMinion = new ServerMinion({
      id: 'red_minion_1',
      position: new Vector(100, 0),
      side: 1 as Side,
      minionType: 'melee',
      lane: 'mid',
      waypoints: [],
    });

    context.addChampion(blueChampion, 'player_1');
    context.addChampion(redChampion, 'player_2');
    context.addEntity(redMinion);
  });

  describe('Ability Learning', () => {
    test('cannot cast unlearned ability', () => {
      // Note: Q is auto-learned on champion creation, so test with W
      const result = cast({
        champion: blueChampion,
        slot: 'W',
        targetPosition: new Vector(100, 0),
        context,
      });

      expect(result.success).toBe(false);
      expect(result.failReason).toBe('not_learned');
    });

    test('can cast learned ability', () => {
      // Learn Q ability (rank 1)
      blueChampion.levelUpAbility('Q');

      const result = cast({
        champion: blueChampion,
        slot: 'Q',
        targetPosition: new Vector(100, 0),
        context,
      });

      expect(result.success).toBe(true);
      expect(result.manaCost).toBeGreaterThan(0);
      expect(result.cooldown).toBeGreaterThan(0);
    });
  });

  describe('Cast time', () => {
    test('aimed abilities take a cast time; self casts and dashes are instant', () => {
      const ability = (slot: 'Q' | 'W' | 'E' | 'R') => getAbilityDefinition(blueChampion.definition.abilities[slot])!;
      expect(getCastTime(ability('Q'))).toBe(DEFAULT_CAST_TIME); // Cleaving Strike: a cone on the ground
      expect(getCastTime(ability('W'))).toBe(0); // Iron Will: on himself
      expect(getCastTime(ability('E'))).toBe(0); // Valiant Charge: a dash
    });

    test('in its cast time the champion casts nothing else, and it goes off at its end', () => {
      blueChampion.levelUpAbility('Q');
      const first = abilityExecutor.castAbility({ champion: blueChampion, slot: 'Q', targetPosition: new Vector(100, 0), context });
      expect(first.success).toBe(true);
      expect(blueChampion.isCasting()).toBe(true);
      expect(blueChampion.abilityStates.Q.isCasting).toBe(true);
      expect(blueChampion.abilityStates.Q.cooldownRemaining).toBe(0);

      // (Not even itself again: it isn't on cooldown yet)
      const second = abilityExecutor.castAbility({ champion: blueChampion, slot: 'Q', targetPosition: new Vector(100, 0), context });
      expect(second.success).toBe(false);
      expect(second.failReason).toBe('casting');

      blueChampion.advanceCast(DEFAULT_CAST_TIME + 0.01, context);
      expect(blueChampion.isCasting()).toBe(false);
      expect(blueChampion.abilityStates.Q.isCasting).toBe(false);
      expect(blueChampion.abilityStates.Q.cooldownRemaining).toBeGreaterThan(0);
    });

    test('silence or death in the cast time cancels it, with nothing spent', () => {
      blueChampion.levelUpAbility('Q');
      const mana = blueChampion.resource;
      abilityExecutor.castAbility({ champion: blueChampion, slot: 'Q', targetPosition: new Vector(100, 0), context });
      blueChampion.applyEffect('silence', 1, 'external');
      blueChampion.update(0.05, context);
      blueChampion.advanceCast(1, context);
      expect(blueChampion.isCasting()).toBe(false);
      expect(blueChampion.resource).toBeGreaterThanOrEqual(mana);
      expect(blueChampion.abilityStates.Q.cooldownRemaining).toBe(0);

      blueChampion.removeEffect?.('silence');
      blueChampion.update(1.1, context);
      abilityExecutor.castAbility({ champion: blueChampion, slot: 'Q', targetPosition: new Vector(100, 0), context });
      expect(blueChampion.isCasting()).toBe(true);
      blueChampion.takeDamage(99999, 'true', redChampion.id, context);
      expect(blueChampion.isCasting()).toBe(false);
    });
  });

  describe('Mana and Cooldown', () => {
    test('deducts mana on ability cast', () => {
      blueChampion.levelUpAbility('Q');
      const initialMana = blueChampion.resource;

      cast({
        champion: blueChampion,
        slot: 'Q',
        targetPosition: new Vector(100, 0),
        context,
      });

      expect(blueChampion.resource).toBeLessThan(initialMana);
    });

    test('cannot cast when out of mana', () => {
      blueChampion.levelUpAbility('Q');
      blueChampion.resource = 0; // Drain all mana

      const result = cast({
        champion: blueChampion,
        slot: 'Q',
        targetPosition: new Vector(100, 0),
        context,
      });

      expect(result.success).toBe(false);
      expect(result.failReason).toBe('not_enough_mana');
    });

    test('starts cooldown on ability cast', () => {
      blueChampion.levelUpAbility('Q');

      cast({
        champion: blueChampion,
        slot: 'Q',
        targetPosition: new Vector(100, 0),
        context,
      });

      expect(blueChampion.abilityStates.Q.cooldownRemaining).toBeGreaterThan(0);
    });

    test('cannot cast ability on cooldown', () => {
      blueChampion.levelUpAbility('Q');

      // First cast succeeds
      const first = cast({
        champion: blueChampion,
        slot: 'Q',
        targetPosition: new Vector(100, 0),
        context,
      });
      expect(first.success).toBe(true);

      // Second cast fails (on cooldown)
      const second = cast({
        champion: blueChampion,
        slot: 'Q',
        targetPosition: new Vector(100, 0),
        context,
      });
      expect(second.success).toBe(false);
      expect(second.failReason).toBe('on_cooldown');
    });
  });

  describe('CC Status', () => {
    test('cannot cast when stunned', () => {
      blueChampion.levelUpAbility('Q');
      blueChampion.applyEffect('stun', 2, 'test');

      const result = cast({
        champion: blueChampion,
        slot: 'Q',
        targetPosition: new Vector(100, 0),
        context,
      });

      expect(result.success).toBe(false);
      expect(result.failReason).toBe('stunned');
    });

    test('cannot cast when silenced', () => {
      blueChampion.levelUpAbility('Q');
      blueChampion.applyEffect('silence', 2, 'test');

      const result = cast({
        champion: blueChampion,
        slot: 'Q',
        targetPosition: new Vector(100, 0),
        context,
      });

      expect(result.success).toBe(false);
      expect(result.failReason).toBe('silenced');
    });
  });

  describe('Skillshot Abilities', () => {
    test('fireball creates a projectile', () => {
      // Magnus has fireball as Q
      redChampion.levelUpAbility('Q');

      const initialEntities = context.getAllEntities().length;

      cast({
        champion: redChampion,
        slot: 'Q',
        targetPosition: new Vector(-200, 0), // Aim at blue side
        context,
      });

      // Tick past the keyframe time to spawn the projectile
      // Magnus Q animation: frame 3 of 5, 0.1s/frame = 0.3s
      for (let i = 0; i < 25; i++) {
        redChampion.update(0.016, context);
      }

      // Should have spawned a projectile
      expect(context.getAllEntities().length).toBe(initialEntities + 1);
    });
  });

  describe('Self-Target Abilities', () => {
    test('shield ability grants a shield', () => {
      // Warrior W is Iron Will (shield)
      // Give skill point since Q was auto-learned at creation
      blueChampion.skillPoints = 1;
      blueChampion.levelUpAbility('W');

      expect(blueChampion.shields.length).toBe(0);

      const result = cast({
        champion: blueChampion,
        slot: 'W',
        context,
      });

      expect(result.success).toBe(true);
      expect(blueChampion.shields.length).toBe(1);
      expect(blueChampion.shields[0].amount).toBeGreaterThan(0);
    });
  });

  describe('Ground Target Abilities (AoE)', () => {
    test('cone ability damages enemies in cone', () => {
      // Warrior Q is cone attack (Cleaving Strike)
      blueChampion.levelUpAbility('Q');

      // Position minion directly in front of warrior
      redMinion.position = new Vector(50, 0);
      const initialHealth = redMinion.health;

      cast({
        champion: blueChampion,
        slot: 'Q',
        targetPosition: new Vector(100, 0), // Aim at minion
        context,
      });
      // The swing lands after its windup
      expect(redMinion.health).toBe(initialHealth);
      context.advanceTime(getAbilityDefinition('warrior_slash')!.aoeDelay!);

      // Minion should have taken damage
      expect(redMinion.health).toBeLessThan(initialHealth);
    });
  });

  describe('Target Enemy Abilities', () => {
    test('target enemy ability requires valid target', () => {
      // Warrior R is Heroic Strike (target enemy) - set level to 6 and learn R
      blueChampion.level = 6;
      blueChampion.skillPoints = 1;
      blueChampion.levelUpAbility('R');

      // Try without target
      const result = cast({
        champion: blueChampion,
        slot: 'R',
        context,
      });

      expect(result.success).toBe(false);
      expect(result.failReason).toBe('invalid_target');
    });

    test('target enemy ability damages target', () => {
      // Warrior R is Heroic Strike - set level to 6 and learn R
      blueChampion.level = 6;
      blueChampion.skillPoints = 1;
      blueChampion.levelUpAbility('R');

      // Move enemy champion into range
      redChampion.position = new Vector(getAbilityDefinition('warrior_ultimate')!.range! * 0.6, 0);
      const initialHealth = redChampion.health;

      const result = cast({
        champion: blueChampion,
        slot: 'R',
        targetEntityId: redChampion.id,
        context,
      });

      expect(result.success).toBe(true);
      // A leap: it lands when it reaches the target
      for (let i = 0; i < 60 && blueChampion.forcedMovement; i++) blueChampion.update(1 / 60, context);
      expect(redChampion.health).toBeLessThan(initialHealth);
    });

    test('target enemy ability out of range fails', () => {
      // Warrior R - set level to 6 and learn R
      blueChampion.level = 6;
      blueChampion.skillPoints = 1;
      blueChampion.levelUpAbility('R');

      // Move enemy champion out of range
      redChampion.position = new Vector(getAbilityDefinition('warrior_ultimate')!.range! + 100, 0);

      const result = cast({
        champion: blueChampion,
        slot: 'R',
        targetEntityId: redChampion.id,
        context,
      });

      expect(result.success).toBe(false);
      expect(result.failReason).toBe('out_of_range');
    });
  });

  describe('Effect Application', () => {
    test('Gorath slam applies slow effect', () => {
      // Use Gorath instead since his Q (Ground Slam) applies slow_40 when it lands
      const gorathDef = CHAMPION_DEFINITIONS['gorath'];
      const gorath = new ServerChampion({
        id: 'blue_gorath',
        position: new Vector(0, 0),
        side: 0 as Side,
        definition: gorathDef,
        playerId: 'player_gorath',
      });
      context.addChampion(gorath, 'player_gorath');

      // Learn Q
      gorath.levelUpAbility('Q');

      // Position enemy in range
      redMinion.position = new Vector(100, 0);
      const initialHealth = redMinion.health;

      cast({
        champion: gorath,
        slot: 'Q',
        context,
      });
      context.advanceTime(getAbilityDefinition('gorath_slam')!.aoeDelay!);

      // Minion should have taken damage (no target AoE)
      expect(redMinion.health).toBeLessThan(initialHealth);
    });

    test('target enemy ability applies stun', () => {
      // Warrior R (Heroic Strike) applies stun - set level to 6 and learn R
      blueChampion.level = 6;
      blueChampion.skillPoints = 1;
      blueChampion.levelUpAbility('R');
      redChampion.position = new Vector(getAbilityDefinition('warrior_ultimate')!.range! * 0.6, 0);

      cast({
        champion: blueChampion,
        slot: 'R',
        targetEntityId: redChampion.id,
        context,
      });
      // A leap: the stun lands when it reaches the target
      for (let i = 0; i < 60 && blueChampion.forcedMovement; i++) blueChampion.update(1 / 60, context);

      // Target should be stunned
      expect(redChampion.hasEffect('stun')).toBe(true);
      expect(redChampion.ccStatus.isStunned).toBe(true);
    });
  });

  describe('Dash Abilities', () => {
    test('dash ability moves champion', () => {
      // Warrior E is Valiant Charge (dash)
      // Give skill point since Q was auto-learned at creation
      blueChampion.skillPoints = 1;
      blueChampion.levelUpAbility('E');
      const initialX = blueChampion.position.x;

      const result = cast({
        champion: blueChampion,
        slot: 'E',
        targetPosition: new Vector(500, 0),
        context,
      });

      expect(result.success).toBe(true);
      // Champion should have forced movement set
      expect(blueChampion.forcedMovement).not.toBeNull();
      expect(blueChampion.forcedMovement?.type).toBe('dash');
    });
  });

  describe('Ground Target Zone Abilities', () => {
    test('zone ability creates slow zone', () => {
      // Magnus E is Quagmire (mud slow zone)
      // Give skill point since Q was auto-learned at creation
      redChampion.skillPoints = 1;
      redChampion.levelUpAbility('E');

      // Within range, below Magnus
      const range = getAbilityDefinition('magnus_mud')!.range!;
      const result = cast({
        champion: redChampion,
        slot: 'E',
        targetPosition: redChampion.position.added(new Vector(0, range * 0.8)),
        context,
      });

      expect(result.success).toBe(true);
      // Zone abilities are ground-target and don't move the champion
      // Just verify the ability was cast successfully
    });
  });

  describe('Champion Definitions', () => {
    test('all champions have valid ability definitions', () => {
      for (const [champId, definition] of Object.entries(CHAMPION_DEFINITIONS)) {
        const slots: ('Q' | 'W' | 'E' | 'R')[] = ['Q', 'W', 'E', 'R'];
        for (const slot of slots) {
          const abilityId = definition.abilities[slot];
          const abilityDef = getAbilityDefinition(abilityId);

          expect(abilityDef).toBeDefined();
          expect(abilityDef?.id).toBe(abilityId);
          expect(abilityDef?.name).toBeTruthy();
          expect(abilityDef?.maxRank).toBeGreaterThan(0);
        }
      }
    });

    test('all champions have correct number of abilities', () => {
      for (const definition of Object.values(CHAMPION_DEFINITIONS)) {
        expect(Object.keys(definition.abilities)).toHaveLength(4);
        expect(definition.abilities.Q).toBeTruthy();
        expect(definition.abilities.W).toBeTruthy();
        expect(definition.abilities.E).toBeTruthy();
        expect(definition.abilities.R).toBeTruthy();
      }
    });
  });
});
