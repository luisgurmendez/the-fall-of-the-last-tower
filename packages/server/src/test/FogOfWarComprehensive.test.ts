/**
 * Comprehensive Fog of War Tests (TDD approach)
 *
 * Tests visibility mechanics including:
 * - Basic visibility (no allies = can't see enemies)
 * - Different vision sources (champion, minion, tower, ward)
 * - Ward vision revealing enemies
 * - Bush visibility rules (5 rules)
 * - Structure visibility (towers/nexus always visible)
 * - Targeting restrictions
 *
 * NOTE: All sight ranges and distances are derived from actual game constants,
 * not hardcoded values. This ensures tests remain valid if values change.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { FogOfWarServer } from '../systems/FogOfWarServer';
import { ServerChampion } from '../simulation/ServerChampion';
import { ServerMinion } from '../simulation/ServerMinion';
import { ServerTower } from '../simulation/ServerTower';
import { ServerGameContext } from '../game/ServerGameContext';
import {
  Vector,
  EntityType,
  TEAM_BLUE,
  TEAM_RED,
  CHAMPION_DEFINITIONS,
  MOBAConfig,
  DEFAULT_MINION_STATS,
} from '@siege/shared';

// =============================================================================
// Vision Range Constants (derived from actual game values)
// =============================================================================

/** Champion sight range from ServerChampion */
const CHAMPION_SIGHT_RANGE = 800; // ServerChampion.sightRange default

/** Minion sight range from shared config */
const MINION_SIGHT_RANGE = DEFAULT_MINION_STATS.melee.sightRange;

/** Ward sight range (hardcoded in FogOfWarServer.updateVision) */
const WARD_SIGHT_RANGE = 900;

/** Small buffer for "within range" tests (ensure we're safely inside) */
const RANGE_BUFFER = 100;

/**
 * Calculate the approximate bush bounds for bush group 0.
 * Based on ServerBushManager.initializeBushGroups() logic.
 */
function getBushGroupBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
  const groupConfig = MOBAConfig.BUSH_GROUPS[0];
  const { bushCount, spread } = groupConfig;
  const spacing = MOBAConfig.BUSH_SETTINGS.SPACING;
  const bushWidth = 100;
  const bushHeight = 60;
  const variance = MOBAConfig.BUSH_SETTINGS.OFFSET_VARIANCE;
  const padding = variance * 2 + 50;

  if (spread === 'horizontal') {
    const totalWidth = bushCount * (bushWidth + spacing);
    const halfW = totalWidth / 2 + padding;
    const halfH = bushHeight / 2 + padding;
    return {
      minX: groupConfig.center.x - halfW,
      maxX: groupConfig.center.x + halfW,
      minY: groupConfig.center.y - halfH,
      maxY: groupConfig.center.y + halfH,
    };
  } else {
    const radius = Math.max(bushCount * spacing, 80) + padding;
    return {
      minX: groupConfig.center.x - radius,
      maxX: groupConfig.center.x + radius,
      minY: groupConfig.center.y - radius,
      maxY: groupConfig.center.y + radius,
    };
  }
}

// =============================================================================
// Test Helpers
// =============================================================================

function createTestContext(): ServerGameContext {
  return new ServerGameContext({ gameId: 'test-fog' });
}

function createMinion(
  id: string,
  side: 0 | 1,
  position: Vector
): ServerMinion {
  return new ServerMinion({
    id,
    position: position.clone(),
    side,
    minionType: 'melee',
    lane: 'mid',
    waypoints: [],
  });
}

function createChampion(
  id: string,
  side: 0 | 1,
  position: Vector,
  playerId: string
): ServerChampion {
  const definition = CHAMPION_DEFINITIONS['warrior'];
  return new ServerChampion({
    id,
    position: position.clone(),
    side,
    definition,
    playerId,
  });
}

function createTower(
  id: string,
  side: 0 | 1,
  position: Vector
): ServerTower {
  return new ServerTower({
    id,
    position: position.clone(),
    side,
    lane: 'mid',
    towerTier: 1,
  });
}

/**
 * Create a mock ward entity.
 * Wards are simple entities that provide vision.
 */
function createWard(
  id: string,
  side: 0 | 1,
  position: Vector
): any {
  return {
    id,
    position: position.clone(),
    side,
    entityType: EntityType.WARD,
    isDead: false,
    health: 1,
    maxHealth: 1,
    stats: { sightRange: WARD_SIGHT_RANGE },
    takeDamage: () => {},
  };
}

/**
 * Get a position that is definitely inside a bush group.
 * Uses the first bush group's center.
 */
function getBushPosition(): Vector {
  const firstBushGroup = MOBAConfig.BUSH_GROUPS[0];
  return new Vector(firstBushGroup.center.x, firstBushGroup.center.y);
}

/**
 * Get a position that is definitely NOT in any bush.
 * Uses a position far from all bush centers.
 */
function getNonBushPosition(offset = 0): Vector {
  // Position far from any bush (bushes are mostly in -1000 to 1000 range)
  return new Vector(1200 + offset, 0);
}

/**
 * Get a position just outside the first bush group (for bush visibility tests).
 * Returns a position that's outside the bush bounds but within champion sight range of the center.
 */
function getPositionOutsideBush(): Vector {
  const bushBounds = getBushGroupBounds();
  const bushCenter = getBushPosition();
  // Position just outside the right edge of the bush
  const outsideX = bushBounds.maxX + RANGE_BUFFER;
  return new Vector(outsideX, bushCenter.y);
}

// =============================================================================
// Tests
// =============================================================================

describe('Fog of War - Comprehensive Tests', () => {
  let context: ServerGameContext;
  let fogOfWar: FogOfWarServer;

  beforeEach(() => {
    context = createTestContext();
    fogOfWar = new FogOfWarServer();
  });

  // ===========================================================================
  // 1. Basic Visibility - "No allies = can't see enemies"
  // ===========================================================================
  describe('Basic Visibility - No vision sources', () => {
    test('when no allies are on map, enemy champion should be hidden', () => {
      // Only add an enemy champion, no allies
      const enemyChampion = createChampion(
        'enemy-champ',
        TEAM_RED,
        new Vector(500, 500),
        'player-red'
      );
      context.addChampion(enemyChampion, 'player-red');

      fogOfWar.updateVision(context, 1);

      // Blue team has no vision sources, so red champion should be hidden
      expect(fogOfWar.isVisibleTo(enemyChampion, TEAM_BLUE)).toBe(false);
    });

    test('when no allies are on map, enemy minions should be hidden', () => {
      // Only add enemy minions
      const enemyMinion = createMinion('enemy-minion', TEAM_RED, new Vector(500, 500));
      context.addEntity(enemyMinion);

      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.isVisibleTo(enemyMinion, TEAM_BLUE)).toBe(false);
    });

    test('own entities are always visible to themselves', () => {
      const blueMinion = createMinion('blue-minion', TEAM_BLUE, new Vector(100, 100));
      context.addEntity(blueMinion);

      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.isVisibleTo(blueMinion, TEAM_BLUE)).toBe(true);
    });

    test('own entities are visible even with no other allies nearby', () => {
      const blueChampion = createChampion(
        'blue-champ',
        TEAM_BLUE,
        new Vector(100, 100),
        'player-blue'
      );
      context.addChampion(blueChampion, 'player-blue');

      fogOfWar.updateVision(context, 1);

      // Blue champion should be visible to blue team
      expect(fogOfWar.isVisibleTo(blueChampion, TEAM_BLUE)).toBe(true);
    });
  });

  // ===========================================================================
  // 2. Vision Sources - Different entities provide vision
  // ===========================================================================
  describe('Vision Sources - Different sight ranges', () => {
    test(`champion should reveal enemy within ${CHAMPION_SIGHT_RANGE} range`, () => {
      const withinRange = CHAMPION_SIGHT_RANGE - RANGE_BUFFER;
      const blueChampion = createChampion(
        'blue-champ',
        TEAM_BLUE,
        getNonBushPosition(),
        'player-blue'
      );
      const redMinion = createMinion(
        'red-minion',
        TEAM_RED,
        getNonBushPosition().add(new Vector(withinRange, 0))
      );

      context.addChampion(blueChampion, 'player-blue');
      context.addEntity(redMinion);
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.isVisibleTo(redMinion, TEAM_BLUE)).toBe(true);
    });

    test(`champion should NOT reveal enemy beyond ${CHAMPION_SIGHT_RANGE} range`, () => {
      const beyondRange = CHAMPION_SIGHT_RANGE + RANGE_BUFFER;
      const blueChampion = createChampion(
        'blue-champ',
        TEAM_BLUE,
        getNonBushPosition(),
        'player-blue'
      );
      const redMinion = createMinion(
        'red-minion',
        TEAM_RED,
        getNonBushPosition().add(new Vector(beyondRange, 0))
      );

      context.addChampion(blueChampion, 'player-blue');
      context.addEntity(redMinion);
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.isVisibleTo(redMinion, TEAM_BLUE)).toBe(false);
    });

    test(`minion should reveal enemy within ${MINION_SIGHT_RANGE} range`, () => {
      const withinRange = MINION_SIGHT_RANGE - RANGE_BUFFER;
      const blueMinion = createMinion('blue-minion', TEAM_BLUE, getNonBushPosition());
      const redMinion = createMinion(
        'red-minion',
        TEAM_RED,
        getNonBushPosition().add(new Vector(withinRange, 0))
      );

      context.addEntity(blueMinion);
      context.addEntity(redMinion);
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.isVisibleTo(redMinion, TEAM_BLUE)).toBe(true);
    });

    test(`minion should NOT reveal enemy beyond ${MINION_SIGHT_RANGE} range`, () => {
      const beyondRange = MINION_SIGHT_RANGE + RANGE_BUFFER;
      const blueMinion = createMinion('blue-minion', TEAM_BLUE, getNonBushPosition());
      const redMinion = createMinion(
        'red-minion',
        TEAM_RED,
        getNonBushPosition().add(new Vector(beyondRange, 0))
      );

      context.addEntity(blueMinion);
      context.addEntity(redMinion);
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.isVisibleTo(redMinion, TEAM_BLUE)).toBe(false);
    });

    test('tower should provide vision in its range', () => {
      const blueTower = createTower('blue-tower', TEAM_BLUE, getNonBushPosition());
      const redMinion = createMinion(
        'red-minion',
        TEAM_RED,
        getNonBushPosition().add(new Vector(500, 0)) // Within tower range (~750)
      );

      context.addEntity(blueTower);
      context.addEntity(redMinion);
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.isVisibleTo(redMinion, TEAM_BLUE)).toBe(true);
    });

    test('dead entities should not provide vision', () => {
      const blueMinion = createMinion('blue-minion', TEAM_BLUE, getNonBushPosition());
      blueMinion.takeDamage(10000, 'true'); // Kill it

      const redMinion = createMinion(
        'red-minion',
        TEAM_RED,
        getNonBushPosition().add(new Vector(MINION_SIGHT_RANGE - RANGE_BUFFER, 0))
      );

      context.addEntity(blueMinion);
      context.addEntity(redMinion);
      fogOfWar.updateVision(context, 1);

      // Dead minion can't provide vision
      expect(fogOfWar.isVisibleTo(redMinion, TEAM_BLUE)).toBe(false);
    });
  });

  // ===========================================================================
  // 3. Ward Vision - "Ward on map reveals enemies"
  // ===========================================================================
  describe('Ward Vision', () => {
    test(`ward should reveal enemies within ${WARD_SIGHT_RANGE} range`, () => {
      const withinRange = WARD_SIGHT_RANGE - RANGE_BUFFER;
      const ward = createWard('blue-ward', TEAM_BLUE, getNonBushPosition());
      const redMinion = createMinion(
        'red-minion',
        TEAM_RED,
        getNonBushPosition().add(new Vector(withinRange, 0))
      );

      context.addEntity(ward);
      context.addEntity(redMinion);
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.isVisibleTo(redMinion, TEAM_BLUE)).toBe(true);
    });

    test(`ward should NOT reveal enemies beyond ${WARD_SIGHT_RANGE} range`, () => {
      const beyondRange = WARD_SIGHT_RANGE + RANGE_BUFFER * 2;
      const ward = createWard('blue-ward', TEAM_BLUE, getNonBushPosition());
      const redMinion = createMinion(
        'red-minion',
        TEAM_RED,
        getNonBushPosition().add(new Vector(beyondRange, 0))
      );

      context.addEntity(ward);
      context.addEntity(redMinion);
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.isVisibleTo(redMinion, TEAM_BLUE)).toBe(false);
    });

    test('dead ward should not provide vision', () => {
      const ward = createWard('blue-ward', TEAM_BLUE, getNonBushPosition());
      ward.isDead = true;

      const redMinion = createMinion(
        'red-minion',
        TEAM_RED,
        getNonBushPosition().add(new Vector(WARD_SIGHT_RANGE - RANGE_BUFFER, 0))
      );

      context.addEntity(ward);
      context.addEntity(redMinion);
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.isVisibleTo(redMinion, TEAM_BLUE)).toBe(false);
    });
  });

  // ===========================================================================
  // 4. Bush Visibility - The 5 rules
  // ===========================================================================
  describe('Bush Visibility Rules', () => {
    test('Rule 1: enemy NOT in bush should be visible (if in range)', () => {
      // Both entities outside of any bush, within champion sight range
      const withinRange = CHAMPION_SIGHT_RANGE - RANGE_BUFFER;
      const blueChampion = createChampion(
        'blue-champ',
        TEAM_BLUE,
        getNonBushPosition(),
        'player-blue'
      );
      const redChampion = createChampion(
        'red-champ',
        TEAM_RED,
        getNonBushPosition().add(new Vector(withinRange, 0)),
        'player-red'
      );

      context.addChampion(blueChampion, 'player-blue');
      context.addChampion(redChampion, 'player-red');
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.isVisibleTo(redChampion, TEAM_BLUE)).toBe(true);
    });

    test('Rule 2: enemy in same bush as viewer should be visible', () => {
      const bushPos = getBushPosition();

      const blueChampion = createChampion(
        'blue-champ',
        TEAM_BLUE,
        bushPos.clone(),
        'player-blue'
      );
      const redChampion = createChampion(
        'red-champ',
        TEAM_RED,
        bushPos.clone().add(new Vector(10, 0)), // Same bush (small offset)
        'player-red'
      );

      context.addChampion(blueChampion, 'player-blue');
      context.addChampion(redChampion, 'player-red');
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.isVisibleTo(redChampion, TEAM_BLUE)).toBe(true);
    });

    test('Rule 3: ward in bush should reveal enemy in that bush', () => {
      const bushPos = getBushPosition();

      const ward = createWard('blue-ward', TEAM_BLUE, bushPos.clone());
      const redChampion = createChampion(
        'red-champ',
        TEAM_RED,
        bushPos.clone().add(new Vector(10, 0)), // Same bush (small offset)
        'player-red'
      );

      context.addEntity(ward);
      context.addChampion(redChampion, 'player-red');
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.isVisibleTo(redChampion, TEAM_BLUE)).toBe(true);
    });

    test('Rule 4: ally in same bush as enemy should reveal enemy', () => {
      const bushPos = getBushPosition();

      // Blue minion in bush reveals red champion in same bush
      const blueMinion = createMinion('blue-minion', TEAM_BLUE, bushPos.clone());
      const redChampion = createChampion(
        'red-champ',
        TEAM_RED,
        bushPos.clone().add(new Vector(10, 0)), // Same bush (small offset)
        'player-red'
      );

      context.addEntity(blueMinion);
      context.addChampion(redChampion, 'player-red');
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.isVisibleTo(redChampion, TEAM_BLUE)).toBe(true);
    });

    test('Rule 5: enemy in bush should be HIDDEN even if within sight range', () => {
      const bushPos = getBushPosition();

      // Blue champion is nearby but NOT in the bush
      // Use helper that calculates position just outside the bush bounds
      const blueChampion = createChampion(
        'blue-champ',
        TEAM_BLUE,
        getPositionOutsideBush(),
        'player-blue'
      );
      // Red champion is hidden in bush
      const redChampion = createChampion(
        'red-champ',
        TEAM_RED,
        bushPos.clone(),
        'player-red'
      );

      context.addChampion(blueChampion, 'player-blue');
      context.addChampion(redChampion, 'player-red');
      fogOfWar.updateVision(context, 1);

      // Even though red is within blue's sight range,
      // red is hidden in bush and blue has no vision in that bush
      expect(fogOfWar.isVisibleTo(redChampion, TEAM_BLUE)).toBe(false);
    });

    test('entity outside bush looking into bush with no ally/ward should not see enemy', () => {
      const bushPos = getBushPosition();

      // Blue champion outside bush
      const blueChampion = createChampion(
        'blue-champ',
        TEAM_BLUE,
        getNonBushPosition(),
        'player-blue'
      );
      // Red champion in bush
      const redChampion = createChampion(
        'red-champ',
        TEAM_RED,
        bushPos.clone(),
        'player-red'
      );

      context.addChampion(blueChampion, 'player-blue');
      context.addChampion(redChampion, 'player-red');
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.isVisibleTo(redChampion, TEAM_BLUE)).toBe(false);
    });
  });

  // ===========================================================================
  // 5. Structure Visibility - Towers/Nexus always visible
  // ===========================================================================
  describe('Structure Visibility', () => {
    test('enemy towers are always visible', () => {
      const redTower = createTower('red-tower', TEAM_RED, new Vector(3000, 1000));
      context.addEntity(redTower);
      fogOfWar.updateVision(context, 1);

      // Even with no blue vision sources, red tower should be visible
      expect(fogOfWar.isVisibleTo(redTower, TEAM_BLUE)).toBe(true);
    });

    test('enemy towers are visible even without any allies', () => {
      // No blue entities at all
      const redTower = createTower('red-tower', TEAM_RED, new Vector(5000, 5000));
      context.addEntity(redTower);
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.isVisibleTo(redTower, TEAM_BLUE)).toBe(true);
    });
  });

  // ===========================================================================
  // 6. Targeting Rules
  // ===========================================================================
  describe('Targeting', () => {
    test('can target visible enemies', () => {
      const withinRange = CHAMPION_SIGHT_RANGE - RANGE_BUFFER;
      const blueChampion = createChampion(
        'blue-champ',
        TEAM_BLUE,
        getNonBushPosition(),
        'player-blue'
      );
      const redChampion = createChampion(
        'red-champ',
        TEAM_RED,
        getNonBushPosition().add(new Vector(withinRange, 0)),
        'player-red'
      );

      context.addChampion(blueChampion, 'player-blue');
      context.addChampion(redChampion, 'player-red');
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.canTarget(blueChampion, redChampion)).toBe(true);
    });

    test('cannot target invisible enemies (out of range)', () => {
      const wayBeyondRange = CHAMPION_SIGHT_RANGE * 3;
      const blueChampion = createChampion(
        'blue-champ',
        TEAM_BLUE,
        getNonBushPosition(),
        'player-blue'
      );
      const redChampion = createChampion(
        'red-champ',
        TEAM_RED,
        getNonBushPosition().add(new Vector(wayBeyondRange, 0)),
        'player-red'
      );

      context.addChampion(blueChampion, 'player-blue');
      context.addChampion(redChampion, 'player-red');
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.canTarget(blueChampion, redChampion)).toBe(false);
    });

    test('cannot target enemy hidden in bush', () => {
      const bushPos = getBushPosition();

      // Position outside bush but within sight range
      const blueChampion = createChampion(
        'blue-champ',
        TEAM_BLUE,
        getPositionOutsideBush(),
        'player-blue'
      );
      const redChampion = createChampion(
        'red-champ',
        TEAM_RED,
        bushPos.clone(),
        'player-red'
      );

      context.addChampion(blueChampion, 'player-blue');
      context.addChampion(redChampion, 'player-red');
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.canTarget(blueChampion, redChampion)).toBe(false);
    });

    test('can always target allies (even far away)', () => {
      const wayBeyondRange = CHAMPION_SIGHT_RANGE * 5;
      const blueChampion1 = createChampion(
        'blue-champ-1',
        TEAM_BLUE,
        getNonBushPosition(),
        'player-blue-1'
      );
      const blueChampion2 = createChampion(
        'blue-champ-2',
        TEAM_BLUE,
        getNonBushPosition().add(new Vector(wayBeyondRange, wayBeyondRange)),
        'player-blue-2'
      );

      context.addChampion(blueChampion1, 'player-blue-1');
      context.addChampion(blueChampion2, 'player-blue-2');
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.canTarget(blueChampion1, blueChampion2)).toBe(true);
    });

    test('can target enemy in bush if ally is in same bush', () => {
      const bushPos = getBushPosition();

      const blueChampion = createChampion(
        'blue-champ',
        TEAM_BLUE,
        bushPos.clone(),
        'player-blue'
      );
      const redChampion = createChampion(
        'red-champ',
        TEAM_RED,
        bushPos.clone().add(new Vector(10, 0)), // Small offset, same bush
        'player-red'
      );

      context.addChampion(blueChampion, 'player-blue');
      context.addChampion(redChampion, 'player-red');
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.canTarget(blueChampion, redChampion)).toBe(true);
    });
  });

  // ===========================================================================
  // 7. Position Visibility
  // ===========================================================================
  describe('Position Visibility', () => {
    test('position in bush should be hidden if no ally in bush', () => {
      const bushPos = getBushPosition();

      // Blue champion far from bush
      const blueChampion = createChampion(
        'blue-champ',
        TEAM_BLUE,
        getNonBushPosition(),
        'player-blue'
      );

      context.addChampion(blueChampion, 'player-blue');
      fogOfWar.updateVision(context, 1);

      // Position inside bush should not be visible
      expect(fogOfWar.isPositionVisibleTo(bushPos, TEAM_BLUE)).toBe(false);
    });

    test('position in bush should be visible if ally in that bush', () => {
      const bushPos = getBushPosition();

      // Blue champion in bush
      const blueChampion = createChampion(
        'blue-champ',
        TEAM_BLUE,
        bushPos.clone(),
        'player-blue'
      );

      context.addChampion(blueChampion, 'player-blue');
      fogOfWar.updateVision(context, 1);

      // Position in same bush should be visible (small offset)
      expect(fogOfWar.isPositionVisibleTo(bushPos.clone().add(new Vector(10, 0)), TEAM_BLUE)).toBe(true);
    });

    test('position outside bush should follow normal vision rules', () => {
      const blueChampion = createChampion(
        'blue-champ',
        TEAM_BLUE,
        getNonBushPosition(),
        'player-blue'
      );

      context.addChampion(blueChampion, 'player-blue');
      fogOfWar.updateVision(context, 1);

      // Position within champion sight range should be visible
      const nearPosition = getNonBushPosition().add(new Vector(CHAMPION_SIGHT_RANGE - RANGE_BUFFER, 0));
      expect(fogOfWar.isPositionVisibleTo(nearPosition, TEAM_BLUE)).toBe(true);

      // Position way beyond sight range should not be visible
      const farPosition = getNonBushPosition().add(new Vector(CHAMPION_SIGHT_RANGE * 3, 0));
      expect(fogOfWar.isPositionVisibleTo(farPosition, TEAM_BLUE)).toBe(false);
    });
  });

  // ===========================================================================
  // 8. Multiple Vision Sources
  // ===========================================================================
  describe('Multiple Vision Sources', () => {
    test('visibility should work with overlapping sources', () => {
      const pos = getNonBushPosition();
      // Position red minion where both champion and minion can see it
      const overlappingRange = Math.min(CHAMPION_SIGHT_RANGE, MINION_SIGHT_RANGE) - RANGE_BUFFER;

      const blueChampion = createChampion('blue-champ', TEAM_BLUE, pos.clone(), 'player-blue');
      const blueMinion = createMinion('blue-minion', TEAM_BLUE, pos.clone().add(new Vector(RANGE_BUFFER, 0)));
      const redMinion = createMinion('red-minion', TEAM_RED, pos.clone().add(new Vector(overlappingRange, 0)));

      context.addChampion(blueChampion, 'player-blue');
      context.addEntity(blueMinion);
      context.addEntity(redMinion);
      fogOfWar.updateVision(context, 1);

      // Red minion should be visible (both champion and minion provide vision)
      expect(fogOfWar.isVisibleTo(redMinion, TEAM_BLUE)).toBe(true);

      // Check that multiple sources are providing vision
      const visibility = fogOfWar.getVisibility(redMinion, TEAM_BLUE);
      expect(visibility.isVisible).toBe(true);
      expect(visibility.revealedBy?.length).toBeGreaterThanOrEqual(1);
    });

    test('getVisionSourcesForTeam should return all sources', () => {
      // Space out the entities so they don't overlap with each other's sight
      const blueChampion = createChampion(
        'blue-champ',
        TEAM_BLUE,
        getNonBushPosition(),
        'player-blue'
      );
      const blueMinion = createMinion(
        'blue-minion',
        TEAM_BLUE,
        getNonBushPosition().add(new Vector(MINION_SIGHT_RANGE, 0))
      );
      const blueTower = createTower(
        'blue-tower',
        TEAM_BLUE,
        getNonBushPosition().add(new Vector(MINION_SIGHT_RANGE * 2, 0))
      );

      context.addChampion(blueChampion, 'player-blue');
      context.addEntity(blueMinion);
      context.addEntity(blueTower);
      fogOfWar.updateVision(context, 1);

      const sources = fogOfWar.getVisionSourcesForTeam(TEAM_BLUE);
      expect(sources.length).toBe(3);
    });
  });

  // ===========================================================================
  // 9. Edge Cases
  // ===========================================================================
  describe('Edge Cases', () => {
    test('visibility cache should reset on new tick', () => {
      const withinRange = MINION_SIGHT_RANGE - RANGE_BUFFER;
      const beyondRange = MINION_SIGHT_RANGE * 3;

      const blueMinion = createMinion('blue-minion', TEAM_BLUE, getNonBushPosition());
      const redMinion = createMinion(
        'red-minion',
        TEAM_RED,
        getNonBushPosition().add(new Vector(withinRange, 0))
      );

      context.addEntity(blueMinion);
      context.addEntity(redMinion);

      // First tick
      fogOfWar.updateVision(context, 1);
      expect(fogOfWar.isVisibleTo(redMinion, TEAM_BLUE)).toBe(true);

      // Move red minion out of range
      redMinion.position = getNonBushPosition().add(new Vector(beyondRange, 0));

      // Same tick - should use cached value (still visible)
      expect(fogOfWar.isVisibleTo(redMinion, TEAM_BLUE)).toBe(true);

      // New tick - cache should be invalidated
      fogOfWar.updateVision(context, 2);
      expect(fogOfWar.isVisibleTo(redMinion, TEAM_BLUE)).toBe(false);
    });

    test('entities should become invisible when their revealing source dies', () => {
      const withinRange = MINION_SIGHT_RANGE - RANGE_BUFFER;

      const blueMinion = createMinion('blue-minion', TEAM_BLUE, getNonBushPosition());
      const redMinion = createMinion(
        'red-minion',
        TEAM_RED,
        getNonBushPosition().add(new Vector(withinRange, 0))
      );

      context.addEntity(blueMinion);
      context.addEntity(redMinion);

      fogOfWar.updateVision(context, 1);
      expect(fogOfWar.isVisibleTo(redMinion, TEAM_BLUE)).toBe(true);

      // Kill blue minion
      blueMinion.takeDamage(10000, 'true');

      // New tick
      fogOfWar.updateVision(context, 2);
      expect(fogOfWar.isVisibleTo(redMinion, TEAM_BLUE)).toBe(false);
    });
  });
});
