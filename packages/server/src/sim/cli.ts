/**
 * sim CLI - run a scenario headlessly and write what happened to disk.
 *
 *   bun run sim list
 *   bun run sim <scenario> [--duration 60] [--seed 2] [--frames 8]
 *                          [--center x,y] [--size 1200] [--px 360] [--out dir]
 *
 * Writes <out>/report.md, log.txt, sheet.png (frames over time), final.png
 * and timeline.json, then prints the report. Exits with 1 if checks fail.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runScenario } from './Scenario';
import { listScenarios, loadScenario } from './scenarios';
import { FrameRenderer, renderSheet, pickFrames, type FrameView } from './render/FrameRenderer';

function parseArgs(argv: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const [key, inline] = arg.slice(2).split('=');
      flags[key] = inline ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true');
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

async function main(): Promise<void> {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const target = positional[0];

  if (!target || target === 'list') {
    console.log('Scenarios (packages/server/scenarios):');
    for (const name of listScenarios()) {
      const scenario = await loadScenario(name);
      console.log(`  ${name.padEnd(28)} ${scenario.description}`);
    }
    console.log('\nRun: bun run sim <scenario> [--duration s] [--seed n] [--frames n] [--center x,y] [--size units] [--px n]');
    return;
  }

  const scenario = await loadScenario(target);
  const started = performance.now();
  const result = runScenario(scenario, {
    duration: flags.duration ? Number(flags.duration) : undefined,
    seed: flags.seed ? Number(flags.seed) : undefined,
  });
  const elapsed = (performance.now() - started) / 1000;

  const view: FrameView = { ...scenario.view };
  if (flags.center) {
    const [x, y] = flags.center.split(',').map(Number);
    view.center = { x, y };
  }
  if (flags.size) view.size = Number(flags.size);

  const outDir = resolve(flags.out ?? join(import.meta.dir, '../../sim-output', scenario.name));
  mkdirSync(outDir, { recursive: true });

  const frames = result.sim.recorder.frames;
  const map = result.sim.context.mapConfig;
  const sheet = renderSheet(pickFrames(frames, Number(flags.frames ?? scenario.frames ?? 8)), frames, {
    ...view,
    map,
    cellPx: Number(flags.px ?? 360),
    title: scenario.name,
  });
  writeFileSync(join(outDir, 'sheet.png'), sheet.toPNG());

  const finalFrame = frames[frames.length - 1] ?? result.sim.frame();
  const final = new FrameRenderer({ ...view, map, px: 900 }).render(finalFrame, { history: frames, title: `${scenario.name} (final)` });
  writeFileSync(join(outDir, 'final.png'), final.toPNG());

  writeFileSync(join(outDir, 'report.md'), result.report.markdown + formatFailures(result.failures));
  writeFileSync(join(outDir, 'log.txt'), result.sim.recorder.formatLog());
  // One frame per second keeps the timeline small enough to read
  writeFileSync(join(outDir, 'timeline.json'), JSON.stringify(
    frames.filter((frame, i) => i === 0 || Math.floor(frame.time) !== Math.floor(frames[i - 1].time)),
    null, 0
  ));

  console.log(result.report.markdown);
  console.log(formatFailures(result.failures));
  console.log(`Simulated ${result.sim.time.toFixed(1)}s in ${elapsed.toFixed(2)}s`);
  console.log(`Output: ${outDir}/{report.md,log.txt,sheet.png,final.png,timeline.json}`);

  if (result.failures.length > 0) process.exit(1);
}

function formatFailures(failures: string[]): string {
  if (failures.length === 0) return '\n## Checks\n\nAll checks passed.\n';
  return `\n## Checks\n\n${failures.map(f => `- FAILED: ${f}`).join('\n')}\n`;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
