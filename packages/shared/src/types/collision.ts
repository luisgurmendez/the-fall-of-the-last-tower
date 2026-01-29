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
 * Calculate circle vs circle separation.
 * Returns vector from A to B, scaled by overlap.
 */
function circleVsCircleSeparation(
  centerA: Vector2D, radiusA: number,
  centerB: Vector2D, radiusB: number
): Vector2D {
  const dx = centerB.x - centerA.x;
  const dy = centerB.y - centerA.y;
  const distSq = dx * dx + dy * dy;
  const radiusSum = radiusA + radiusB;

  if (distSq >= radiusSum * radiusSum) {
    return { x: 0, y: 0 };
  }

  const dist = Math.sqrt(distSq);
  const overlap = radiusSum - dist;

  if (dist === 0) {
    const angle = Math.random() * Math.PI * 2;
    return { x: Math.cos(angle) * overlap, y: Math.sin(angle) * overlap };
  }

  return { x: (dx / dist) * overlap, y: (dy / dist) * overlap };
}

/**
 * Calculate circle vs rectangle separation.
 * Returns vector from circle to rectangle (direction circle should NOT move).
 */
function circleVsRectangleSeparation(
  circleCenter: Vector2D, circleRadius: number,
  rectCenter: Vector2D, rectWidth: number, rectHeight: number
): Vector2D {
  const halfW = rectWidth / 2;
  const halfH = rectHeight / 2;

  // Find the closest point on the rectangle to the circle center
  const closestX = Math.max(rectCenter.x - halfW, Math.min(circleCenter.x, rectCenter.x + halfW));
  const closestY = Math.max(rectCenter.y - halfH, Math.min(circleCenter.y, rectCenter.y + halfH));

  const dx = closestX - circleCenter.x;
  const dy = closestY - circleCenter.y;
  const distSq = dx * dx + dy * dy;

  if (distSq >= circleRadius * circleRadius) {
    return { x: 0, y: 0 };
  }

  const dist = Math.sqrt(distSq);

  // Circle center is inside the rectangle
  if (dist === 0) {
    // Find which edge is closest and push out that way
    const distToLeft = circleCenter.x - (rectCenter.x - halfW);
    const distToRight = (rectCenter.x + halfW) - circleCenter.x;
    const distToTop = circleCenter.y - (rectCenter.y - halfH);
    const distToBottom = (rectCenter.y + halfH) - circleCenter.y;

    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

    // Return vector pointing towards the nearest edge (from circle to rect)
    if (minDist === distToLeft) {
      return { x: -(distToLeft + circleRadius), y: 0 };
    } else if (minDist === distToRight) {
      return { x: distToRight + circleRadius, y: 0 };
    } else if (minDist === distToTop) {
      return { x: 0, y: -(distToTop + circleRadius) };
    } else {
      return { x: 0, y: distToBottom + circleRadius };
    }
  }

  // Normal case: return vector from circle to closest point, scaled by overlap
  const overlap = circleRadius - dist;
  return { x: (dx / dist) * overlap, y: (dy / dist) * overlap };
}

/**
 * Calculate rectangle vs rectangle separation using AABB.
 * Returns the minimum translation vector (from A towards B).
 */
function rectangleVsRectangleSeparation(
  centerA: Vector2D, widthA: number, heightA: number,
  centerB: Vector2D, widthB: number, heightB: number
): Vector2D {
  const halfWA = widthA / 2;
  const halfHA = heightA / 2;
  const halfWB = widthB / 2;
  const halfHB = heightB / 2;

  // Calculate overlap on each axis
  const overlapX = (halfWA + halfWB) - Math.abs(centerA.x - centerB.x);
  const overlapY = (halfHA + halfHB) - Math.abs(centerA.y - centerB.y);

  if (overlapX <= 0 || overlapY <= 0) {
    return { x: 0, y: 0 };
  }

  // Push out along the axis with smallest overlap (minimum translation vector)
  // Direction is from A towards B
  if (overlapX < overlapY) {
    const sign = centerB.x > centerA.x ? 1 : -1;
    return { x: sign * overlapX, y: 0 };
  } else {
    const sign = centerB.y > centerA.y ? 1 : -1;
    return { x: 0, y: sign * overlapY };
  }
}

/**
 * Calculate the separation vector needed to resolve collision between two shapes.
 * Returns the vector from A towards B, scaled by overlap amount.
 * To separate: A moves in negative direction, B moves in positive direction.
 */
export function calculateCollisionSeparation(
  collisionA: EntityCollision,
  positionA: Vector2D,
  collisionB: EntityCollision,
  positionB: Vector2D
): Vector2D {
  const centerA = getCollisionCenter(collisionA, positionA);
  const centerB = getCollisionCenter(collisionB, positionB);

  // Circle vs Circle
  if (isCircleCollision(collisionA) && isCircleCollision(collisionB)) {
    return circleVsCircleSeparation(centerA, collisionA.radius, centerB, collisionB.radius);
  }

  // Circle vs Rectangle
  if (isCircleCollision(collisionA) && isRectangleCollision(collisionB)) {
    return circleVsRectangleSeparation(
      centerA, collisionA.radius,
      centerB, collisionB.width, collisionB.height
    );
  }

  // Rectangle vs Circle (swap and negate)
  if (isRectangleCollision(collisionA) && isCircleCollision(collisionB)) {
    const sep = circleVsRectangleSeparation(
      centerB, collisionB.radius,
      centerA, collisionA.width, collisionA.height
    );
    return { x: -sep.x, y: -sep.y };
  }

  // Rectangle vs Rectangle
  if (isRectangleCollision(collisionA) && isRectangleCollision(collisionB)) {
    return rectangleVsRectangleSeparation(
      centerA, collisionA.width, collisionA.height,
      centerB, collisionB.width, collisionB.height
    );
  }

  // Capsule - fallback to effective radius (bounding circle)
  const radiusA = getEffectiveRadius(collisionA);
  const radiusB = getEffectiveRadius(collisionB);
  return circleVsCircleSeparation(centerA, radiusA, centerB, radiusB);
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
 * Rectangle based on sprite collision area: 88x60 pixels at position (20, 165) in 128x256 sprite.
 * Scaled by 0.8 to world units: 70x48, with Y offset to align with sprite base.
 */
export const DEFAULT_TOWER_COLLISION: RectangleCollision = {
  type: 'rectangle',
  width: 70,
  height: 48,
  offset: { x: 0, y: -19 },
};
