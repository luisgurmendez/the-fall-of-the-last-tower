/**
 * Game event types and payload definitions.
 * Provides type-safe event names and data structures.
 */

import Vector from "@/physics/vector";

// Event name constants
export const GameEvents = {
  // Unit events
  UNIT_SPAWNED: 'unit:spawned',
  UNIT_DIED: 'unit:died',
  UNIT_DAMAGED: 'unit:damaged',
  UNIT_ATTACKED: 'unit:attacked',
  UNIT_SELECTED: 'unit:selected',
  UNIT_DESELECTED: 'unit:deselected',

  // Wave events
  WAVE_STARTED: 'wave:started',
  WAVE_COMPLETED: 'wave:completed',

  // Castle events
  CASTLE_DAMAGED: 'castle:damaged',
  CASTLE_DESTROYED: 'castle:destroyed',

  // Game state events
  GAME_STARTED: 'game:started',
  GAME_PAUSED: 'game:paused',
  GAME_RESUMED: 'game:resumed',
  GAME_OVER: 'game:over',
  GAME_RESTARTED: 'game:restarted',

  // Economy events
  MONEY_CHANGED: 'economy:money_changed',
  UNIT_PURCHASED: 'economy:unit_purchased',

  // Player input events
  PLAYER_COMMAND_MOVE: 'player:command_move',
  PLAYER_COMMAND_ATTACK: 'player:command_attack',
} as const;

// Event payload types
export interface UnitSpawnedEvent {
  unitId: string;
  unitType: 'swordsman' | 'archer';
  side: 0 | 1;
  position: Vector;
}

export interface UnitDiedEvent {
  unitId: string;
  unitType: 'swordsman' | 'archer';
  side: 0 | 1;
  position: Vector;
  killedBy?: string;
}

export interface UnitDamagedEvent {
  unitId: string;
  damage: number;
  remainingHealth: number;
  attackerId?: string;
}

export interface WaveStartedEvent {
  waveNumber: number;
  swordsmenCount: number;
  archerCount: number;
}

export interface WaveCompletedEvent {
  waveNumber: number;
}

export interface CastleDamagedEvent {
  damage: number;
  remainingHealth: number;
  healthPercentage: number;
}

export interface CastleDestroyedEvent {
  finalWave: number;
}

export interface GameOverEvent {
  reason: 'castle_destroyed' | 'player_quit';
  finalWave: number;
  finalScore?: number;
}

export interface MoneyChangedEvent {
  previousAmount: number;
  newAmount: number;
  change: number;
  reason: 'passive_income' | 'kill_reward' | 'unit_purchased' | 'other';
}

export interface UnitPurchasedEvent {
  unitType: 'swordsman' | 'archer';
  cost: number;
}

export interface PlayerCommandMoveEvent {
  targetPosition: Vector;
  selectedUnitIds: string[];
}

export interface PlayerCommandAttackEvent {
  targetId: string;
  selectedUnitIds: string[];
}

// Type-safe event map for better type inference
export type GameEventMap = {
  [GameEvents.UNIT_SPAWNED]: UnitSpawnedEvent;
  [GameEvents.UNIT_DIED]: UnitDiedEvent;
  [GameEvents.UNIT_DAMAGED]: UnitDamagedEvent;
  [GameEvents.WAVE_STARTED]: WaveStartedEvent;
  [GameEvents.WAVE_COMPLETED]: WaveCompletedEvent;
  [GameEvents.CASTLE_DAMAGED]: CastleDamagedEvent;
  [GameEvents.CASTLE_DESTROYED]: CastleDestroyedEvent;
  [GameEvents.GAME_OVER]: GameOverEvent;
  [GameEvents.MONEY_CHANGED]: MoneyChangedEvent;
  [GameEvents.UNIT_PURCHASED]: UnitPurchasedEvent;
  [GameEvents.PLAYER_COMMAND_MOVE]: PlayerCommandMoveEvent;
  [GameEvents.PLAYER_COMMAND_ATTACK]: PlayerCommandAttackEvent;
  [GameEvents.GAME_STARTED]: void;
  [GameEvents.GAME_PAUSED]: void;
  [GameEvents.GAME_RESUMED]: void;
  [GameEvents.GAME_RESTARTED]: void;
  [GameEvents.UNIT_SELECTED]: { unitId: string };
  [GameEvents.UNIT_DESELECTED]: { unitId: string };
  [GameEvents.UNIT_ATTACKED]: { attackerId: string; targetId: string; damage: number };
};
