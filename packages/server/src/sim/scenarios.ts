/**
 * Scenario discovery: files in packages/server/scenarios/ export a Scenario as default.
 */

import { readdirSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import type { Scenario } from './Scenario';

export const SCENARIO_DIR = resolve(import.meta.dir, '../../scenarios');

export function listScenarios(): string[] {
  if (!existsSync(SCENARIO_DIR)) return [];
  return readdirSync(SCENARIO_DIR)
    .filter(file => file.endsWith('.ts') && !file.startsWith('_'))
    .map(file => basename(file, '.ts'))
    .sort();
}

/**
 * Load a scenario by name (file in the scenarios folder) or by path.
 */
export async function loadScenario(nameOrPath: string): Promise<Scenario> {
  const path = existsSync(nameOrPath) ? resolve(nameOrPath) : join(SCENARIO_DIR, `${nameOrPath.replace(/\.ts$/, '')}.ts`);
  if (!existsSync(path)) {
    throw new Error(`Scenario not found: ${nameOrPath}. Available: ${listScenarios().join(', ')}`);
  }
  const module = await import(path);
  const scenario = module.default as Scenario | undefined;
  if (!scenario || typeof scenario.duration !== 'number') {
    throw new Error(`${path} must export a scenario as default (use defineScenario)`);
  }
  return scenario;
}
