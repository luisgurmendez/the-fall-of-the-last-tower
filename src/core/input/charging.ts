/**
 * Charging an ability (Vile's Black Arrows): held down, it charges; let go,
 * it's cast with how long it charged (OnlineInputHandler sends that).
 *
 * One whose charge can't move (charge.canMoveWhileCharging: false) holds the
 * champion still while it charges: the champion stops when the charge
 * starts, and no move orders are sent until it's let go. Only when the
 * press is a real charge: not when the ability isn't ready (on cooldown,
 * not learned) or the press is its recast.
 */

import { hasChargeBehavior, type AbilityDefinition, type AbilitySlot, type AbilityState } from "@siege/shared";

/** An ability being charged */
export interface ChargeState {
  slot: AbilitySlot;
  /** When it started (seconds) */
  startTime: number;
  minChargeTime: number;
  maxChargeTime: number;
  /** The champion stands still while it charges */
  holdsStill: boolean;
}

/**
 * Start charging the ability in `slot`, if it charges (null otherwise).
 * `ability` is its state in the champion's snapshot.
 */
export function startCharge(
  slot: AbilitySlot,
  definition: AbilityDefinition,
  ability: Partial<AbilityState> | undefined,
  now: number,
): ChargeState | null {
  if (!hasChargeBehavior(definition)) return null;
  const ready = (ability?.rank ?? 0) > 0 && (ability?.cooldownRemaining ?? 0) <= 0;
  const recasting = (ability?.recastCount ?? 0) > 0 && (ability?.recastWindowRemaining ?? 0) > 0;
  return {
    slot,
    startTime: now,
    minChargeTime: definition.charge.minChargeTime,
    maxChargeTime: definition.charge.maxChargeTime,
    holdsStill: definition.charge.canMoveWhileCharging === false && ready && !recasting,
  };
}

/** How long it has charged, between its minimum and maximum */
export function chargeTime(charge: ChargeState, now: number): number {
  return Math.min(charge.maxChargeTime, Math.max(charge.minChargeTime, now - charge.startTime));
}

/** How far along its charge is, 0 to 1 (for the HUD) */
export function chargeProgress(charge: ChargeState, now: number): number {
  const span = charge.maxChargeTime - charge.minChargeTime;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (now - charge.startTime - charge.minChargeTime) / span));
}

/** Whether move orders wait: a charge that holds the champion still is on */
export function blocksMovement(charge: ChargeState | null): boolean {
  return charge?.holdsStill === true;
}
