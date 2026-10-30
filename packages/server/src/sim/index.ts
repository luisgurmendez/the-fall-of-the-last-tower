/**
 * Agent simulation framework - see docs/architecture/simulation.md.
 */

export { Simulation, type SimulationOptions, type AddChampionOptions } from './Simulation';
export { Recorder, toSimEntity, type SimEntity, type SimFrame, type SimLogEntry } from './Recorder';
export { buildReport, type SimReport } from './Report';
export { defineScenario, runScenario, type Scenario, type ScenarioStep, type ScenarioResult, type Expect } from './Scenario';
export { FrameRenderer, renderSheet, pickFrames, type FrameView, type RenderOptions } from './render/FrameRenderer';
export { Raster, hexColor } from './render/Raster';
export { loadScenario, listScenarios, SCENARIO_DIR } from './scenarios';
