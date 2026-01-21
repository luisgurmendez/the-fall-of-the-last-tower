/**
 * Ward System Types
 *
 * Wards are placeable vision objects that reveal fog of war.
 * Similar to League of Legends trinkets.
 */

import type { TeamId } from '@/core/Team';

/**
 * Ward types available in the game.
 */
export type WardType = 'stealth' | 'control' | 'farsight';

/**
 * Definition for a ward type.
 */
export interface WardDefinition {
  /** Unique identifier for this ward type */
  id: WardType;
  /** Display name */
  name: string;
  /** Duration in seconds (0 = permanent until destroyed) */
  duration: number;
  /** Sight range in world units */
  sightRange: number;
  /** Health points (how much damage to destroy) */
  health: number;
  /** Whether the ward is invisible to enemies */
  isStealthed: boolean;
  /** Whether this ward reveals enemy wards */
  revealsWards: boolean;
  /** Visual size for rendering */
  renderSize: number;
  /** Color when visible */
  color: string;
}

/**
 * Predefined ward definitions.
 */
export const WARD_DEFINITIONS: Record<WardType, WardDefinition> = {
  /**
   * Stealth Ward (Yellow Trinket equivalent)
   * - Invisible to enemies
   * - Medium duration
   * - Standard vision range
   */
  stealth: {
    id: 'stealth',
    name: 'Stealth Ward',
    duration: 90, // 90 seconds
    sightRange: 280, // Reduced sight range
    health: 3,
    isStealthed: true,
    revealsWards: false,
    renderSize: 12,
    color: '#44FF44',
  },

  /**
   * Control Ward (Pink Ward equivalent)
   * - Visible to enemies
   * - Permanent until destroyed
   * - Reveals enemy wards
   */
  control: {
    id: 'control',
    name: 'Control Ward',
    duration: 0, // Permanent
    sightRange: 250, // Reduced sight range
    health: 4,
    isStealthed: false,
    revealsWards: true,
    renderSize: 14,
    color: '#FF44FF',
  },

  /**
   * Farsight Ward (Blue Trinket equivalent)
   * - Visible to enemies
   * - Very short duration but can be placed from far away
   * - Extended vision range
   */
  farsight: {
    id: 'farsight',
    name: 'Farsight Ward',
    duration: 60, // 60 seconds
    sightRange: 350, // Reduced sight range
    health: 1,
    isStealthed: false,
    revealsWards: false,
    renderSize: 10,
    color: '#4444FF',
  },
};

/**
 * Trinket definition for ward placement.
 */
export interface TrinketDefinition {
  /** Trinket identifier */
  id: string;
  /** Display name */
  name: string;
  /** What type of ward it places */
  wardType: WardType;
  /** Maximum charges */
  maxCharges: number;
  /** Time to regenerate one charge (seconds) */
  rechargeTime: number;
  /** Placement range (0 = at champion position) */
  placementRange: number;
  /** Cooldown after placing (seconds) */
  cooldown: number;
}

/**
 * Predefined trinkets.
 */
export const TRINKET_DEFINITIONS: Record<string, TrinketDefinition> = {
  /**
   * Stealth Ward Trinket (Yellow Trinket)
   */
  stealth_trinket: {
    id: 'stealth_trinket',
    name: 'Stealth Ward',
    wardType: 'stealth',
    maxCharges: 2,
    rechargeTime: 120, // 2 minutes per charge
    placementRange: 100, // Must be close to place
    cooldown: 1,
  },

  /**
   * Farsight Trinket (Blue Trinket)
   */
  farsight_trinket: {
    id: 'farsight_trinket',
    name: 'Farsight Alteration',
    wardType: 'farsight',
    maxCharges: 1,
    rechargeTime: 90,
    placementRange: 800, // Can place from far away
    cooldown: 1,
  },
};
