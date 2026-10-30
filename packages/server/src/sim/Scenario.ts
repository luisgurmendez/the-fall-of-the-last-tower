/**
 * Scenario - A repeatable setup + script + checks for a Simulation.
 *
 * Scenario files live in packages/server/scenarios/ and export a scenario as
 * default. Run one with `bun run sim <name>` (writes a report and images) or
 * through the test suite (runs the checks).
 */

import { Simulation, type SimulationOptions } from './Simulation';
import type { SimReport } from './Report';
import type { FrameView } from './render/FrameRenderer';

export interface ScenarioStep {
  /** Game time (seconds) to run this step at */
  at: number;
  /** Logged to the report when the step runs */
  note?: string;
  run: (sim: Simulation) => void;
}

export type Expect = (condition: boolean, message: string) => void;

export interface Scenario {
  name: string;
  description: string;
  /** Simulation options. Defaults: seed 1, everything else as in a real match. */
  options?: SimulationOptions;
  /** Seconds of game time to simulate */
  duration: number;
  setup?: (sim: Simulation) => void;
  steps?: ScenarioStep[];
  /** Stop early when this becomes true */
  until?: (sim: Simulation) => boolean;
  /** Assertions run after the simulation; failures make tests and the CLI fail */
  check?: (sim: Simulation, report: SimReport, expect: Expect) => void;
  /** Default camera for images */
  view?: FrameView;
  /** Frames in the contact sheet (default 8) */
  frames?: number;
}

export function defineScenario(scenario: Scenario): Scenario {
  return scenario;
}

export interface ScenarioResult {
  scenario: Scenario;
  sim: Simulation;
  report: SimReport;
  failures: string[];
}

/**
 * Run a scenario to completion.
 * @param overrides Change options/duration without editing the file
 */
export function runScenario(
  scenario: Scenario,
  overrides: { duration?: number; seed?: number } = {}
): ScenarioResult {
  const sim = new Simulation({ seed: 1, ...scenario.options, ...(overrides.seed !== undefined ? { seed: overrides.seed } : {}) });

  try {
    scenario.setup?.(sim);

    const duration = overrides.duration ?? scenario.duration;
    const steps = [...(scenario.steps ?? [])].sort((a, b) => a.at - b.at);
    let nextStep = 0;

    const runDueSteps = () => {
      while (nextStep < steps.length && steps[nextStep].at <= sim.time + 1e-9) {
        const step = steps[nextStep++];
        if (step.note) sim.note(step.note);
        step.run(sim);
      }
    };

    runDueSteps();
    while (sim.time < duration - 1e-9) {
      sim.tick();
      runDueSteps();
      if (scenario.until?.(sim)) {
        sim.note('stop condition reached');
        break;
      }
    }

    const report = sim.report();
    const failures: string[] = [];
    scenario.check?.(sim, report, (condition, message) => {
      if (!condition) failures.push(message);
    });

    return { scenario, sim, report, failures };
  } finally {
    sim.dispose();
  }
}
