/**
 * Events module exports.
 */

export { EventEmitter } from './EventEmitter';
export { GameEvents } from './GameEvents';
export { default as GameEventBus, getGameEventBus, resetGameEventBus } from './gameEventBus';
export type {
  UnitSpawnedEvent,
  UnitDiedEvent,
  UnitDamagedEvent,
  WaveStartedEvent,
  WaveCompletedEvent,
  CastleDamagedEvent,
  CastleDestroyedEvent,
  GameOverEvent,
  MoneyChangedEvent,
  UnitPurchasedEvent,
  PlayerCommandMoveEvent,
  PlayerCommandAttackEvent,
  GameEventMap,
} from './GameEvents';
