/**
 * sim sandbox - an HTTP server holding one Simulation that an agent can
 * drive step by step (curl it from a shell) and look at as PNG frames.
 *
 *   bun run sim:serve [--port 8090] [--scenario bot-vs-bot-mid]
 *
 * Endpoints (JSON bodies, all optional fields):
 *   POST /reset    { scenario?, options?, champions?: AddChampionOptions[] }
 *                  New simulation. With a scenario, runs its setup (not its steps).
 *   POST /step     { seconds = 1 }          Advance; returns new log lines + champions
 *   POST /command  { playerId, action, x?, y?, targetId?, slot? }
 *                  action: move | attack | stop | cast | level | recall | buy (itemId)
 *   POST /wave     { lane, side? }          Spawn a minion wave
 *   GET  /state    ?near=x,y,radius         Entities (compact) + champions
 *   GET  /frame.png ?x=&y=&size=&px=&trail= Render the current state
 *   GET  /sheet.png ?seconds=20&frames=8    Contact sheet of the last N seconds
 *   GET  /report                            Markdown report so far
 */

import { Simulation, type AddChampionOptions, type SimulationOptions } from './Simulation';
import { loadScenario } from './scenarios';
import { FrameRenderer, renderSheet, pickFrames } from './render/FrameRenderer';
import type { AbilitySlot, LaneId } from '@siege/shared';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const PORT = Number(flag('port') ?? 8090);

let sim = new Simulation({ seed: 1 });
let logCursor = 0;

async function reset(body: { scenario?: string; options?: SimulationOptions; champions?: AddChampionOptions[] }): Promise<string> {
  sim.dispose();
  if (body.scenario) {
    const scenario = await loadScenario(body.scenario);
    sim = new Simulation({ seed: 1, ...scenario.options, ...body.options });
    scenario.setup?.(sim);
  } else {
    sim = new Simulation({ seed: 1, ...body.options });
  }
  for (const champion of body.champions ?? []) sim.addChampion(champion);
  logCursor = 0;
  return `Simulation reset${body.scenario ? ` with scenario ${body.scenario}` : ''}`;
}

function champions() {
  return sim.entities(e => e.kind === 'champion').map(e => {
    const champion = sim.champion(e.playerId!);
    return {
      ...e,
      resource: Math.round(champion.resource),
      gold: Math.round(champion.gold),
      cs: champion.cs,
      kills: champion.kills,
      deaths: champion.deaths,
      skillPoints: champion.skillPoints,
      ranks: champion.abilityRanks,
      cooldowns: Object.fromEntries(Object.entries(champion.abilityCooldowns).map(([k, v]) => [k, Math.round(v * 10) / 10])),
    };
  });
}

function newLog(): string[] {
  const entries = sim.recorder.log.slice(logCursor);
  logCursor = sim.recorder.log.length;
  return entries.map(entry => `[${entry.time.toFixed(1)}s] ${entry.kind} ${entry.text}`);
}

function command(body: { playerId: string; action: string; x?: number; y?: number; targetId?: string; slot?: AbilitySlot; itemId?: string }): boolean {
  const { playerId, action } = body;
  switch (action) {
    case 'move': return sim.move(playerId, body.x!, body.y!);
    case 'attack': return sim.attack(playerId, body.targetId!);
    case 'stop': return sim.stop(playerId);
    case 'cast': return sim.cast(playerId, body.slot!, body.targetId ?? (body.x !== undefined ? { x: body.x, y: body.y! } : undefined));
    case 'level': return sim.levelUp(playerId, body.slot!);
    case 'recall': return sim.recall(playerId);
    case 'buy': return sim.buy(playerId, body.itemId!);
    default: throw new Error(`Unknown action: ${action}`);
  }
}

function png(bytes: Uint8Array): Response {
  return new Response(bytes.slice().buffer as ArrayBuffer, { headers: { 'Content-Type': 'image/png' } });
}

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};

    try {
      switch (`${request.method} ${url.pathname}`) {
        case 'POST /reset':
          return Response.json({ message: await reset(body), time: sim.time, champions: champions() });

        case 'POST /step': {
          sim.run(Number(body.seconds ?? 1));
          return Response.json({ time: Math.round(sim.time * 100) / 100, log: newLog(), champions: champions() });
        }

        case 'POST /command':
          return Response.json({ accepted: command(body), time: sim.time });

        case 'POST /wave':
          sim.spawnWave(body.lane as LaneId, body.side);
          return Response.json({ message: `Spawned ${body.lane} wave`, time: sim.time });

        case 'GET /state': {
          const near = url.searchParams.get('near');
          let entities = sim.entities(e => e.kind !== 'projectile');
          if (near) {
            const [x, y, radius] = near.split(',').map(Number);
            entities = entities.filter(e => Math.hypot(e.x - x, e.y - y) <= radius);
          }
          return Response.json({ time: sim.time, champions: champions(), entities });
        }

        case 'GET /frame.png': {
          const param = (name: string) => url.searchParams.get(name);
          const renderer = new FrameRenderer({
            center: param('x') !== null ? { x: Number(param('x')), y: Number(param('y') ?? 0) } : undefined,
            size: param('size') !== null ? Number(param('size')) : undefined,
            px: Number(param('px') ?? 720),
          });
          const image = renderer.render(sim.frame(), {
            history: sim.recorder.frames,
            trailSeconds: Number(param('trail') ?? 4),
          });
          return png(image.toPNG());
        }

        case 'GET /sheet.png': {
          const seconds = Number(url.searchParams.get('seconds') ?? 20);
          const frames = sim.recorder.frames.filter(f => f.time >= sim.time - seconds);
          const sheet = renderSheet(pickFrames(frames, Number(url.searchParams.get('frames') ?? 8)), sim.recorder.frames, {
            center: url.searchParams.get('x') !== null
              ? { x: Number(url.searchParams.get('x')), y: Number(url.searchParams.get('y') ?? 0) }
              : undefined,
            size: url.searchParams.get('size') !== null ? Number(url.searchParams.get('size')) : undefined,
          });
          return png(sheet.toPNG());
        }

        case 'GET /report':
          return new Response(sim.report().markdown, { headers: { 'Content-Type': 'text/markdown' } });

        default:
          return new Response('Not found. See packages/server/src/sim/serve.ts for endpoints.', { status: 404 });
      }
    } catch (error) {
      return Response.json({ error: String(error) }, { status: 400 });
    }
  },
});

const initialScenario = flag('scenario');
(initialScenario ? reset({ scenario: initialScenario }) : Promise.resolve('')).then(() => {
  console.log(`Simulation sandbox on http://localhost:${server.port}${initialScenario ? ` (scenario: ${initialScenario})` : ''}`);
});
