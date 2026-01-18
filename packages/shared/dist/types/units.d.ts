/**
 * Common type definitions for game units.
 * Shared between client and server.
 */
import type { Vector } from '../math/Vector';
import type { Shape } from '../math/shapes';
/**
 * Team/side identifier.
 * 0 = Blue team (ally from blue perspective)
 * 1 = Red team (enemy from blue perspective)
 */
export type Side = 0 | 1;
/**
 * Team identifiers for clarity.
 */
export declare const TEAM_BLUE: Side;
export declare const TEAM_RED: Side;
/**
 * Unit type identifiers.
 */
export type UnitType = 'champion' | 'minion_melee' | 'minion_caster' | 'minion_siege' | 'minion_super' | 'tower' | 'inhibitor' | 'nexus' | 'jungle_camp' | 'dragon' | 'baron';
/**
 * Damage types in the game.
 */
export type DamageType = 'physical' | 'magic' | 'true' | 'pure';
/**
 * Interface for objects that can be targeted.
 */
export interface Targetable {
    readonly id: string;
    readonly position: Vector;
    readonly collisionMask: Shape;
}
/**
 * Interface for objects that can take damage.
 */
export interface Damageable {
    health: number;
    maxHealth: number;
    takeDamage(damage: number, type: DamageType): void;
}
/**
 * Interface for objects that belong to a team.
 */
export interface Sided {
    readonly side: Side;
}
/**
 * Combined interface for something that can be attacked.
 */
export interface AttackTarget extends Targetable, Damageable, Sided {
}
/**
 * Point in 2D space.
 */
export interface Point {
    x: number;
    y: number;
}
/**
 * Rectangle dimensions.
 */
export interface Dimensions {
    width: number;
    height: number;
}
/**
 * Bounding box.
 */
export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}
/**
 * Type guard to check if an object has a side property.
 */
export declare function isSided(obj: unknown): obj is Sided;
/**
 * Type guard to check if an object is targetable.
 */
export declare function isTargetable(obj: unknown): obj is Targetable;
/**
 * Type guard to check if an object is damageable.
 */
export declare function isDamageable(obj: unknown): obj is Damageable;
/**
 * Get the opposite side.
 */
export declare function oppositeSide(side: Side): Side;
//# sourceMappingURL=units.d.ts.map