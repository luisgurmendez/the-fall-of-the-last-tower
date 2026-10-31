/**
 * The ground shader's terrain field (src/gpu/ground/terrainField.ts): the
 * distance transform, and the signs of each terrain's distance at known
 * places on the map.
 */
import { describe, it, expect } from 'bun:test';
import { MOBAConfig } from '@siege/shared';
import { buildTerrainField, fieldDistanceAt, squaredDistanceTransform } from '@/gpu/ground/terrainField';

describe('squared distance transform', () => {
  it('measures squared distances to the nearest feature', () => {
    const FAR = 1e20;
    const grid = new Float64Array([FAR, FAR, 0, FAR, FAR, FAR]);
    squaredDistanceTransform(grid, 6, 1);
    expect(Array.from(grid)).toEqual([4, 1, 0, 1, 4, 9]);
  });

  it('works in two dimensions', () => {
    const FAR = 1e20;
    const grid = new Float64Array(9).fill(FAR);
    grid[0] = 0;
    squaredDistanceTransform(grid, 3, 3);
    expect(grid[8]).toBe(8);
    expect(grid[5]).toBe(5);
  });
});

describe('terrain field', () => {
  const field = buildTerrainField();
  const WATER = 0, PATH = 1, ROCK = 2;

  it('covers the map', () => {
    expect(field.width * field.cell).toBe(MOBAConfig.MAP_SIZE.width);
    expect(field.data.length).toBe(field.width * field.height * 4);
  });

  it('has the river and mid lane crossing at the center', () => {
    expect(fieldDistanceAt(field, WATER, 0, 0)).toBeLessThan(0);
    expect(fieldDistanceAt(field, PATH, 0, 0)).toBeLessThan(0);
  });

  it('has water around the map', () => {
    expect(fieldDistanceAt(field, WATER, -1750, 0)).toBeLessThan(0);
    expect(fieldDistanceAt(field, WATER, 0, 1750)).toBeLessThan(0);
  });

  it('has rock inside the walls', () => {
    const wall = MOBAConfig.WALLS.find(w => w.width >= 128 && w.height >= 128)!;
    expect(fieldDistanceAt(field, ROCK, wall.position.x, wall.position.y)).toBeLessThan(0);
  });

  it('has open grass at a jungle camp', () => {
    const camp = MOBAConfig.JUNGLE.CAMPS[0].position;
    expect(fieldDistanceAt(field, WATER, camp.x, camp.y)).toBeGreaterThan(0);
    expect(fieldDistanceAt(field, PATH, camp.x, camp.y)).toBeGreaterThan(0);
    expect(fieldDistanceAt(field, ROCK, camp.x, camp.y)).toBeGreaterThan(0);
  });
});
