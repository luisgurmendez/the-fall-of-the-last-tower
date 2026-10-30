/**
 * Runs every scenario in packages/server/scenarios/ and its checks.
 * Use `bun run sim <name>` to see the report and images for one of them.
 */
import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { listScenarios, loadScenario, runScenario } from '../sim';

describe('scenarios', () => {
  for (const name of listScenarios()) {
    test(name, async () => {
      const scenario = await loadScenario(name);
      const result = runScenario(scenario);
      expect(result.failures).toEqual([]);
    }, 30_000);
  }
});
