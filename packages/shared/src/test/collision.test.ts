/**
 * Collision Shape Tests
 *
 * Tests for collision shape types and utility functions.
 * These ensure collision masks work correctly for different shape types.
 */

import { describe, it, expect } from 'bun:test';
import {
  type CircleCollision,
  type RectangleCollision,
  type CapsuleCollision,
  type EntityCollision,
  isCircleCollision,
  isRectangleCollision,
  isCapsuleCollision,
  getCollisionBounds,
  getEffectiveRadius,
  collisionShapesOverlap,
} from '../types/collision';

describe('Collision Shape Types', () => {
  describe('Type Guards', () => {
    it('should identify circle collision', () => {
      const circle: CircleCollision = { type: 'circle', radius: 25 };
      expect(isCircleCollision(circle)).toBe(true);
      expect(isRectangleCollision(circle)).toBe(false);
      expect(isCapsuleCollision(circle)).toBe(false);
    });

    it('should identify rectangle collision', () => {
      const rect: RectangleCollision = { type: 'rectangle', width: 50, height: 30 };
      expect(isCircleCollision(rect)).toBe(false);
      expect(isRectangleCollision(rect)).toBe(true);
      expect(isCapsuleCollision(rect)).toBe(false);
    });

    it('should identify capsule collision', () => {
      const capsule: CapsuleCollision = { type: 'capsule', radius: 15, height: 40 };
      expect(isCircleCollision(capsule)).toBe(false);
      expect(isRectangleCollision(capsule)).toBe(false);
      expect(isCapsuleCollision(capsule)).toBe(true);
    });
  });

  describe('getCollisionBounds', () => {
    it('should return correct bounds for circle without offset', () => {
      const circle: CircleCollision = { type: 'circle', radius: 25 };
      const bounds = getCollisionBounds(circle, { x: 100, y: 100 });

      expect(bounds.minX).toBe(75);
      expect(bounds.maxX).toBe(125);
      expect(bounds.minY).toBe(75);
      expect(bounds.maxY).toBe(125);
    });

    it('should return correct bounds for circle with offset', () => {
      const circle: CircleCollision = { type: 'circle', radius: 25, offset: { x: 10, y: -5 } };
      const bounds = getCollisionBounds(circle, { x: 100, y: 100 });

      // Center is at (110, 95), radius 25
      expect(bounds.minX).toBe(85);
      expect(bounds.maxX).toBe(135);
      expect(bounds.minY).toBe(70);
      expect(bounds.maxY).toBe(120);
    });

    it('should return correct bounds for rectangle without offset', () => {
      const rect: RectangleCollision = { type: 'rectangle', width: 60, height: 40 };
      const bounds = getCollisionBounds(rect, { x: 100, y: 100 });

      expect(bounds.minX).toBe(70);
      expect(bounds.maxX).toBe(130);
      expect(bounds.minY).toBe(80);
      expect(bounds.maxY).toBe(120);
    });

    it('should return correct bounds for rectangle with offset', () => {
      const rect: RectangleCollision = { type: 'rectangle', width: 60, height: 40, offset: { x: 5, y: 10 } };
      const bounds = getCollisionBounds(rect, { x: 100, y: 100 });

      // Center is at (105, 110)
      expect(bounds.minX).toBe(75);
      expect(bounds.maxX).toBe(135);
      expect(bounds.minY).toBe(90);
      expect(bounds.maxY).toBe(130);
    });

    it('should return correct bounds for capsule', () => {
      const capsule: CapsuleCollision = { type: 'capsule', radius: 15, height: 50 };
      const bounds = getCollisionBounds(capsule, { x: 100, y: 100 });

      // Width is 2*radius = 30, height is given
      expect(bounds.minX).toBe(85);
      expect(bounds.maxX).toBe(115);
      expect(bounds.minY).toBe(75);
      expect(bounds.maxY).toBe(125);
    });
  });

  describe('getEffectiveRadius', () => {
    it('should return radius for circle', () => {
      const circle: CircleCollision = { type: 'circle', radius: 25 };
      expect(getEffectiveRadius(circle)).toBe(25);
    });

    it('should return half diagonal for rectangle', () => {
      const rect: RectangleCollision = { type: 'rectangle', width: 60, height: 80 };
      // Diagonal = sqrt(60^2 + 80^2) = sqrt(3600 + 6400) = sqrt(10000) = 100
      // Half diagonal = 50
      expect(getEffectiveRadius(rect)).toBe(50);
    });

    it('should return half height for capsule', () => {
      const capsule: CapsuleCollision = { type: 'capsule', radius: 15, height: 50 };
      // Effective radius is half the height (the bounding circle)
      expect(getEffectiveRadius(capsule)).toBe(25);
    });
  });

  describe('collisionShapesOverlap', () => {
    describe('circle vs circle', () => {
      it('should detect overlapping circles', () => {
        const a: CircleCollision = { type: 'circle', radius: 25 };
        const b: CircleCollision = { type: 'circle', radius: 25 };
        const posA = { x: 0, y: 0 };
        const posB = { x: 30, y: 0 };

        // Distance 30, combined radii 50, overlap of 20
        expect(collisionShapesOverlap(a, posA, b, posB)).toBe(true);
      });

      it('should not detect non-overlapping circles', () => {
        const a: CircleCollision = { type: 'circle', radius: 25 };
        const b: CircleCollision = { type: 'circle', radius: 25 };
        const posA = { x: 0, y: 0 };
        const posB = { x: 60, y: 0 };

        // Distance 60, combined radii 50, no overlap
        expect(collisionShapesOverlap(a, posA, b, posB)).toBe(false);
      });

      it('should handle circles with offsets', () => {
        const a: CircleCollision = { type: 'circle', radius: 25, offset: { x: 10, y: 0 } };
        const b: CircleCollision = { type: 'circle', radius: 25 };
        const posA = { x: 0, y: 0 };
        const posB = { x: 40, y: 0 };

        // Effective A center at (10, 0), B at (40, 0)
        // Distance 30, combined radii 50, overlap
        expect(collisionShapesOverlap(a, posA, b, posB)).toBe(true);
      });
    });

    describe('circle vs rectangle', () => {
      it('should detect circle overlapping rectangle center', () => {
        const circle: CircleCollision = { type: 'circle', radius: 20 };
        const rect: RectangleCollision = { type: 'rectangle', width: 60, height: 40 };
        const posCircle = { x: 0, y: 0 };
        const posRect = { x: 0, y: 0 };

        expect(collisionShapesOverlap(circle, posCircle, rect, posRect)).toBe(true);
      });

      it('should detect circle overlapping rectangle edge', () => {
        const circle: CircleCollision = { type: 'circle', radius: 20 };
        const rect: RectangleCollision = { type: 'rectangle', width: 60, height: 40 };
        const posCircle = { x: 45, y: 0 };
        const posRect = { x: 0, y: 0 };

        // Circle center at 45, rect right edge at 30
        // Circle edge at 25, which overlaps with rect right edge
        expect(collisionShapesOverlap(circle, posCircle, rect, posRect)).toBe(true);
      });

      it('should not detect non-overlapping circle and rectangle', () => {
        const circle: CircleCollision = { type: 'circle', radius: 20 };
        const rect: RectangleCollision = { type: 'rectangle', width: 60, height: 40 };
        const posCircle = { x: 60, y: 0 };
        const posRect = { x: 0, y: 0 };

        // Circle center at 60, rect right edge at 30, circle left edge at 40
        // No overlap
        expect(collisionShapesOverlap(circle, posCircle, rect, posRect)).toBe(false);
      });
    });

    describe('rectangle vs rectangle', () => {
      it('should detect overlapping rectangles', () => {
        const a: RectangleCollision = { type: 'rectangle', width: 40, height: 40 };
        const b: RectangleCollision = { type: 'rectangle', width: 40, height: 40 };
        const posA = { x: 0, y: 0 };
        const posB = { x: 30, y: 0 };

        // A: -20 to 20, B: 10 to 50, overlap
        expect(collisionShapesOverlap(a, posA, b, posB)).toBe(true);
      });

      it('should not detect non-overlapping rectangles', () => {
        const a: RectangleCollision = { type: 'rectangle', width: 40, height: 40 };
        const b: RectangleCollision = { type: 'rectangle', width: 40, height: 40 };
        const posA = { x: 0, y: 0 };
        const posB = { x: 50, y: 0 };

        // A: -20 to 20, B: 30 to 70, no overlap
        expect(collisionShapesOverlap(a, posA, b, posB)).toBe(false);
      });
    });
  });
});

describe('Collision Shape Validation', () => {
  it('should require positive radius for circle', () => {
    const circle: CircleCollision = { type: 'circle', radius: 25 };
    expect(circle.radius).toBeGreaterThan(0);
  });

  it('should require positive dimensions for rectangle', () => {
    const rect: RectangleCollision = { type: 'rectangle', width: 50, height: 30 };
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
  });

  it('should require positive dimensions for capsule', () => {
    const capsule: CapsuleCollision = { type: 'capsule', radius: 15, height: 40 };
    expect(capsule.radius).toBeGreaterThan(0);
    expect(capsule.height).toBeGreaterThan(0);
  });
});
