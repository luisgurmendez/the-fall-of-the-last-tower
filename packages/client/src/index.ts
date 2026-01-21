/**
 * @siege/client
 *
 * Siege MOBA game client networking and prediction.
 * Handles server communication, client-side prediction, and state interpolation.
 */

// High-level game integration
export {
  NetworkedGame,
  type NetworkedGameConfig,
  type NetworkedGameState,
  type NetworkedGameEvents,
  type GameStartData,
} from './NetworkedGame';

// Network
export {
  NetworkClient,
  ConnectionState,
  type NetworkClientConfig,
  type NetworkEventHandlers,
  type ServerMessage,
} from './network';

export {
  StateBuffer,
  type StateBufferConfig,
  type TimestampedSnapshot,
} from './network/StateBuffer';

// Prediction
export {
  Interpolator,
  Reconciler,
  Predictor,
  defaultApplyMovementInput,
  type InterpolatedState,
  type InterpolatorConfig,
  type ReconcilerConfig,
  type ReconciliationResult,
  type PredictorConfig,
  type PredictedEntityState,
  type PredictionStats,
} from './prediction';

// Re-export shared types for convenience
export {
  Vector,
  GameConfig,
  InputType,
  ClientMessageType,
  ServerMessageType,
  type ClientInput,
  type StateUpdate,
  type FullStateSnapshot,
  type EntitySnapshot,
  type ChampionSnapshot,
} from '@siege/shared';

console.log('[Siege Client] Module loaded');
