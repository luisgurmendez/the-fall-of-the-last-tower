/**
 * Client-side prediction and interpolation exports.
 */

export { Interpolator, type InterpolatedState, type InterpolatorConfig } from './Interpolator';
export {
  Reconciler,
  defaultApplyMovementInput,
  type ReconcilerConfig,
  type ReconciliationResult,
} from './Reconciler';
export {
  Predictor,
  type PredictorConfig,
  type PredictedEntityState,
  type PredictionStats,
} from './Predictor';
