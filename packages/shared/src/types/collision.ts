/**
 * Collision Shape Types
 *
 * Defines collision shapes for entities, separate from their visual sprite size.
 * These shapes are used by both server (for authoritative collision) and client (for debug visualization).
 */

// ============== Base Types ==============

export interface Vector2D {
  x: number;
  y: number;
}

export interface CollisionBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// ============== Collision Shapes ==============

export interface BaseCollisionShape {
  type: 'circle' | 'rectangle' | 'capsule';
  offset?: Vector2D;  // Offset from entity center
}

export interface CircleCollision extends BaseCollisionShape {
  type: 'circle';
  radius: number;
}

export interface RectangleCollision extends BaseCollisionShape {
  type: 'rectangle';
  width: number;
  height: number;
}

export interface CapsuleCollision extends BaseCollisionShape {
  type: 'capsule';
  radius: number;   // Radius of the semicircular caps
  height: number;   // Total height including caps
}

export type EntityCollision = CircleCollision | RectangleCollision | CapsuleCollision;

// ============== Type Guards ==============

export function isCircleCollision(collision: EntityCollision): collision is CircleCollision {
  return collision.type === 'circle';
}

export function isRectangleCollision(collision: EntityCollision): collision is RectangleCollision {
  return collision.type === 'rectangle';
}

export function isCapsuleCollision(collision: EntityCollision): collision is CapsuleCollision {
  return collision.type === 'capsule';
}

// ============== Utility Functions ==============

/**
 * Get the axis-aligned bounding box for a collision shape at a given position.
 */
export function getCollisionBounds(collision: EntityCollision, position: Vector2D): CollisionBounds {
  const offsetX = collision.offset?.x ?? 0;
  const offsetY = collision.offset?.y ?? 0;
  const centerX = position.x + offsetX;
  const centerY = position.y + offsetY;

  switch (collision.type) {
    case 'circle': {
      const r = collision.radius;
      return {
        minX: centerX - r,
        maxX: centerX + r,
        minY: centerY - r,
        maxY: centerY + r,
      };
    }
    case 'rectangle': {
      const halfW = collision.width / 2;
      const halfH = collision.height / 2;
      return {
        minX: centerX - halfW,
        maxX: centerX + halfW,
        minY: centerY - halfH,
        maxY: centerY + halfH,
      };
    }
    case 'capsule': {
      const halfH = collision.height / 2;
      const r = collision.radius;
      return {
        minX: centerX - r,
        maxX: centerX + r,
        minY: centerY - halfH,
        maxY: centerY + halfH,
      };
    }
  }
}

/**
 * Get the effective radius for a collision shape (the radius of its bounding circle).
 * Useful for broad-phase collision detection and spatial grid queries.
 */
export function getEffectiveRadius(collision: EntityCollision): number {
  switch (collision.type) {
    case 'circle':
      return collision.radius;
    case 'rectangle': {
      // Half diagonal of the rectangle
      const halfW = collision.width / 2;
      const halfH = collision.height / 2;
      return Math.sqrt(halfW * halfW + halfH * halfH);
    }
    case 'capsule':
      // Half height (the capsule fits in a circle of this radius)
      return collision.height / 2;
  }
}

/**
 * Get the center of a collision shape at a given entity position.
 */
export function getCollisionCenter(collision: EntityCollision, position: Vector2D): Vector2D {
  return {
    x: position.x + (collision.offset?.x ?? 0),
    y: position.y + (collision.offset?.y ?? 0),
  };
}

// ============== Collision Detection ==============

/**
 * Check if two collision shapes overlap.
 * This is the core collision detection function used by the server.
 */
export function collisionShapesOverlap(
  collisionA: EntityCollision,
  positionA: Vector2D,
  collisionB: EntityCollision,
  positionB: Vector2D
): boolean {
  const centerA = getCollisionCenter(collisionA, positionA);
  const centerB = getCollisionCenter(collisionB, positionB);

  // Circle vs Circle
  if (isCircleCollision(collisionA) && isCircleCollision(collisionB)) {
    return circleVsCircle(centerA, collisionA.radius, centerB, collisionB.radius);
  }

  // Circle vs Rectangle
  if (isCircleCollision(collisionA) && isRectangleCollision(collisionB)) {
    return circleVsRectangle(centerA, collisionA.radius, centerB, collisionB.width, collisionB.height);
  }
  if (isRectangleCollision(collisionA) && isCircleCollision(collisionB)) {
    return circleVsRectangle(centerB, collisionB.radius, centerA, collisionA.width, collisionA.height);
  }

  // Rectangle vs Rectangle
  if (isRectangleCollision(collisionA) && isRectangleCollision(collisionB)) {
    return rectangleVsRectangle(
      centerA, collisionA.width, collisionA.height,
      centerB, collisionB.width, collisionB.height
    );
  }

  // Capsule - treat as circle for now (using effective radius)
  // TODO: Implement proper capsule collision
  if (isCapsuleCollision(collisionA) || isCapsuleCollision(collisionB)) {
    const radiusA = getEffectiveRadius(collisionA);
    const radiusB = getEffectiveRadius(collisionB);
    return circleVsCircle(centerA, radiusA, centerB, radiusB);
  }

  return false;
}

// ============== Shape-Specific Collision ==============

function circleVsCircle(
  centerA: Vector2D, radiusA: number,
  centerB: Vector2D, radiusB: number
): boolean {
  const dx = centerB.x - centerA.x;
  const dy = centerB.y - centerA.y;
  const distSq = dx * dx + dy * dy;
  const radiusSum = radiusA + radiusB;
  return distSq < radiusSum * radiusSum;
}

function circleVsRectangle(
  circleCenter: Vector2D, circleRadius: number,
  rectCenter: Vector2D, rectWidth: number, rectHeight: number
): boolean {
  const halfW = rectWidth / 2;
  const halfH = rectHeight / 2;

  // Find the closest point on the rectangle to the circle center
  const closestX = Math.max(rectCenter.x - halfW, Math.min(circleCenter.x, rectCenter.x + halfW));
  const closestY = Math.max(rectCenter.y - halfH, Math.min(circleCenter.y, rectCenter.y + halfH));

  // Check if the closest point is within the circle
  const dx = circleCenter.x - closestX;
  const dy = circleCenter.y - closestY;
  const distSq = dx * dx + dy * dy;

  return distSq < circleRadius * circleRadius;
}

function rectangleVsRectangle(
  centerA: Vector2D, widthA: number, heightA: number,
  centerB: Vector2D, widthB: number, heightB: number
): boolean {
  const halfWA = widthA / 2;
  const halfHA = heightA / 2;
  const halfWB = widthB / 2;
  const halfHB = heightB / 2;

  // AABB collision check
  return (
    centerA.x - halfWA < centerB.x + halfWB &&
    centerA.x + halfWA > centerB.x - halfWB &&
    centerA.y - halfHA < centerB.y + halfHB &&
    centerA.y + halfHA > centerB.y - halfHB
  );
}

// ============== Separation Calculation ==============

/**
 * Calculate the separation vector needed to resolve collision between two shapes.
 * Returns the vector that shape A should move to separate from shape B.
 */
export function calculateCollisionSeparation(
  collisionA: EntityCollision,
  positionA: Vector2D,
  collisionB: EntityCollision,
  positionB: Vector2D
): Vector2D {
  const centerA = getCollisionCenter(collisionA, positionA);
  const centerB = getCollisionCenter(collisionB, positionB);

  // For now, use circle-based separation for all shapes
  // TODO: Implement proper shape-specific separation
  const radiusA = getEffectiveRadius(collisionA);
  const radiusB = getEffectiveRadius(collisionB);

  const dx = centerA.x - centerB.x;
  const dy = centerA.y - centerB.y;
  const distSq = dx * dx + dy * dy;
  const radiusSum = radiusA + radiusB;

  if (distSq >= radiusSum * radiusSum) {
    // No overlap
    return { x: 0, y: 0 };
  }

  const dist = Math.sqrt(distSq);
  const overlap = radiusSum - dist;

  if (dist === 0) {
    // Same position, push in a random direction
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.cos(angle) * overlap,
      y: Math.sin(angle) * overlap,
    };
  }

  // Normalize direction and scale by overlap
  const nx = dx / dist;
  const ny = dy / dist;

  return {
    x: nx * overlap,
    y: ny * overlap,
  };
}

// ============== Default Collision Shapes ==============

/**
 * Default collision shape for champions.
 */
export const DEFAULT_CHAMPION_COLLISION: CircleCollision = {
  type: 'circle',
  radius: 25,
};

/**
 * Default collision shape for minions.
 */
export const DEFAULT_MINION_COLLISION: CircleCollision = {
  type: 'circle',
  radius: 15,
};

/**
 * Default collision shape for towers.
 */
export const DEFAULT_TOWER_COLLISION: CircleCollision = {
  type: 'circle',
  radius: 48,
};
