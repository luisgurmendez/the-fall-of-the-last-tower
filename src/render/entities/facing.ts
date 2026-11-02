/**
 * Which way an entity faces, for sprites drawn in four directions: up or
 * down the screen once what it faces is clearly more above or below it than
 * beside it, sideways (left or right) otherwise. Diagonals keep the side
 * view, which reads best, and a turned entity only turns back sideways past
 * a lower ratio, so a target near the diagonal doesn't flip it back and forth.
 */

export type VerticalFacing = "north" | "south";

/** It turns up or down when what it faces is this many times farther above or below it than beside it... */
const TURN_RATIO = 1.25;
/** ...and back sideways when that drops below this */
const TURN_BACK_RATIO = 0.9;

/** Its facing toward something `dx`, `dy` away (screen y grows down), given its facing now */
export function verticalFacing(dx: number, dy: number, current: VerticalFacing | null): VerticalFacing | null {
  const ratio = current ? TURN_BACK_RATIO : TURN_RATIO;
  if (Math.abs(dy) <= Math.abs(dx) * ratio) return null;
  return dy < 0 ? "north" : "south";
}
