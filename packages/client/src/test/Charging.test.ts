/**
 * Charging an ability (src/core/input/charging.ts): Vile's Black Arrows
 * can't move while charging, so a charge of it holds the champion still
 * (OnlineInputHandler stops it and sends no move orders), unless the press
 * isn't a real charge (the ability isn't ready, or it's the recast). The
 * charge time sent is kept between the minimum and the maximum.
 */
import { describe, it, expect } from 'bun:test';
import { getAbilityDefinition, type AbilityDefinition, type AbilityState } from '@siege/shared';
import { blocksMovement, chargeProgress, chargeTime, startCharge } from '@/core/input/charging';

const ARROWS = getAbilityDefinition('vile_black_arrows')!;
const CHARGE = ARROWS.charge!;

const READY: Partial<AbilityState> = { rank: 1, cooldownRemaining: 0 };

describe('Charging', () => {
  it("Vile's arrows hold him still while they charge", () => {
    expect(CHARGE.canMoveWhileCharging).toBe(false);
    const charge = startCharge('Q', ARROWS, READY, 10)!;
    expect(charge.holdsStill).toBe(true);
    expect(blocksMovement(charge)).toBe(true);
  });

  it('a charge that can move holds nothing', () => {
    const walking: AbilityDefinition = { ...ARROWS, charge: { ...CHARGE, canMoveWhileCharging: true } };
    expect(blocksMovement(startCharge('Q', walking, READY, 10))).toBe(false);
    const unsaid: AbilityDefinition = { ...ARROWS, charge: { ...CHARGE, canMoveWhileCharging: undefined } };
    expect(blocksMovement(startCharge('Q', unsaid, READY, 10))).toBe(false);
  });

  it("on cooldown or not learned, pressing it doesn't hold him", () => {
    expect(blocksMovement(startCharge('Q', ARROWS, { rank: 1, cooldownRemaining: 3 }, 10))).toBe(false);
    expect(blocksMovement(startCharge('Q', ARROWS, { rank: 0, cooldownRemaining: 0 }, 10))).toBe(false);
    expect(blocksMovement(startCharge('Q', ARROWS, undefined, 10))).toBe(false);
  });

  it("the recast (a dash) isn't a charge that holds him", () => {
    const recast = { rank: 1, cooldownRemaining: 8, recastCount: 1, recastWindowRemaining: 2 };
    expect(blocksMovement(startCharge('Q', ARROWS, recast, 10))).toBe(false);
  });

  it("abilities that don't charge don't start one, and nothing holds without a charge", () => {
    expect(startCharge('W', getAbilityDefinition('vile_veil_of_darkness')!, READY, 10)).toBeNull();
    expect(blocksMovement(null)).toBe(false);
  });

  it('the charge time sent stays between its minimum and maximum', () => {
    const charge = startCharge('Q', ARROWS, READY, 10)!;
    expect(chargeTime(charge, 10)).toBe(CHARGE.minChargeTime);
    expect(chargeTime(charge, 10 + 1)).toBeCloseTo(1, 10);
    expect(chargeTime(charge, 10 + 60)).toBe(CHARGE.maxChargeTime);
  });

  it('its progress goes 0 to 1 from the minimum to the maximum', () => {
    const charge = startCharge('Q', ARROWS, READY, 10)!;
    expect(chargeProgress(charge, 10)).toBe(0);
    expect(chargeProgress(charge, 10 + CHARGE.minChargeTime)).toBeCloseTo(0, 10);
    expect(chargeProgress(charge, 10 + (CHARGE.minChargeTime + CHARGE.maxChargeTime) / 2)).toBeCloseTo(0.5, 10);
    expect(chargeProgress(charge, 10 + CHARGE.maxChargeTime + 5)).toBe(1);
  });
});
