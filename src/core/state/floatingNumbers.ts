/**
 * Floating combat text (state side): the damage, gold and XP numbers waiting
 * to be drawn. Game events add them; src/render/overlays/floatingNumbers.ts
 * draws them, rising and fading above the entity.
 */

/**
 * Floating damage number for visual feedback.
 */
export interface DamageNumber {
  /** Entity that received damage */
  entityId: string;
  /** World position where damage occurred */
  x: number;
  y: number;
  /** Amount of damage dealt to health */
  amount: number;
  /** Amount absorbed by shield */
  shieldAbsorbed: number;
  /** Type of damage */
  damageType: 'physical' | 'magic' | 'true' | 'pure';
  /** When the damage occurred (ms) */
  startTime: number;
  /** Duration to display (ms) */
  duration: number;
}

/**
 * Floating gold number for visual feedback.
 */
export interface GoldNumber {
  /** Entity that earned gold */
  entityId: string;
  /** World position where gold was earned */
  x: number;
  y: number;
  /** Amount of gold earned */
  amount: number;
  /** When the gold was earned (ms) */
  startTime: number;
  /** Duration to display (ms) */
  duration: number;
}

/**
 * Floating XP number for visual feedback.
 */
export interface XpNumber {
  /** Entity that earned XP */
  entityId: string;
  /** World position where XP was earned */
  x: number;
  y: number;
  /** Amount of XP earned */
  amount: number;
  /** When the XP was earned (ms) */
  startTime: number;
  /** Duration to display (ms) */
  duration: number;
}

const DAMAGE_NUMBER_DURATION = 1000; // ms
const GOLD_NUMBER_DURATION = 1200; // ms (slightly longer than damage)
const XP_NUMBER_DURATION = 1200; // ms

/**
 * Active floating numbers, oldest first.
 */
export class FloatingNumbers {
  private damageNumbers: DamageNumber[] = [];
  private goldNumbers: GoldNumber[] = [];
  private xpNumbers: XpNumber[] = [];

  addDamage(damageNumber: Omit<DamageNumber, 'duration'>): void {
    this.damageNumbers.push({ ...damageNumber, duration: DAMAGE_NUMBER_DURATION });
  }

  addGold(goldNumber: Omit<GoldNumber, 'duration'>): void {
    this.goldNumbers.push({ ...goldNumber, duration: GOLD_NUMBER_DURATION });
  }

  addXp(xpNumber: Omit<XpNumber, 'duration'>): void {
    this.xpNumbers.push({ ...xpNumber, duration: XP_NUMBER_DURATION });
  }

  /**
   * Get all active damage numbers and remove expired ones.
   */
  getDamageNumbers(): DamageNumber[] {
    const now = Date.now();

    // Remove expired damage numbers
    this.damageNumbers = this.damageNumbers.filter(
      (dn) => now - dn.startTime < dn.duration
    );

    return this.damageNumbers;
  }

  /**
   * Get progress (0-1) for a damage number animation.
   */
  getDamageNumberProgress(damageNumber: DamageNumber): number {
    const elapsed = Date.now() - damageNumber.startTime;
    return Math.min(1, elapsed / damageNumber.duration);
  }

  /**
   * Get all active gold numbers and remove expired ones.
   */
  getGoldNumbers(): GoldNumber[] {
    const now = Date.now();

    // Remove expired gold numbers
    this.goldNumbers = this.goldNumbers.filter(
      (gn) => now - gn.startTime < gn.duration
    );

    return this.goldNumbers;
  }

  /**
   * Get progress (0-1) for a gold number animation.
   */
  getGoldNumberProgress(goldNumber: GoldNumber): number {
    const elapsed = Date.now() - goldNumber.startTime;
    return Math.min(1, elapsed / goldNumber.duration);
  }

  /**
   * Get all active XP numbers and remove expired ones.
   */
  getXpNumbers(): XpNumber[] {
    const now = Date.now();

    // Remove expired XP numbers
    this.xpNumbers = this.xpNumbers.filter(
      (xn) => now - xn.startTime < xn.duration
    );

    return this.xpNumbers;
  }

  /**
   * Get progress (0-1) for an XP number animation.
   */
  getXpNumberProgress(xpNumber: XpNumber): number {
    const elapsed = Date.now() - xpNumber.startTime;
    return Math.min(1, elapsed / xpNumber.duration);
  }
}
