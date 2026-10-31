/**
 * Report - A readable summary of a simulation run.
 */

import { EntityType } from '@siege/shared';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { Simulation } from './Simulation';
import type { SimLogEntry } from './Recorder';

export interface ChampionSummary {
  playerId: string;
  championId: string;
  side: string;
  level: number;
  hp: string;
  position: string;
  gold: number;
  cs: number;
  kills: number;
  deaths: number;
  alive: boolean;
}

export interface SimReport {
  time: number;
  champions: ChampionSummary[];
  units: Record<string, number>;
  towers: { blue: number; red: number };
  /** Inhibitors standing (destroyed ones rebuild) */
  inhibitors: { blue: number; red: number };
  deaths: SimLogEntry[];
  log: SimLogEntry[];
  /** Everything above as markdown */
  markdown: string;
}

const SIDES = ['blue', 'red', 'neutral'];

function stripIds(text: string): string {
  return text.replace(/ sim_e\d+/g, '');
}

export function buildReport(sim: Simulation): SimReport {
  const context = sim.context;
  const recorder = sim.recorder;

  const champions: ChampionSummary[] = context.getAllChampions().map((champion: ServerChampion) => ({
    playerId: champion.playerId,
    championId: champion.definition.id,
    side: SIDES[champion.side],
    level: champion.level,
    hp: `${Math.round(champion.health)}/${Math.round(champion.maxHealth)}`,
    position: `(${Math.round(champion.position.x)}, ${Math.round(champion.position.y)})`,
    gold: Math.round(champion.gold),
    cs: champion.cs,
    kills: champion.kills,
    deaths: champion.deaths,
    alive: !champion.isDead,
  }));

  const units: Record<string, number> = {};
  const towers = { blue: 0, red: 0 };
  const inhibitors = { blue: 0, red: 0 };
  for (const entity of context.getAllEntities()) {
    if (entity.isDead) continue;
    if (entity.entityType === EntityType.MINION) {
      const key = `${SIDES[entity.side]} minions`;
      units[key] = (units[key] ?? 0) + 1;
    } else if (entity.entityType === EntityType.JUNGLE_CAMP) {
      units['jungle creatures'] = (units['jungle creatures'] ?? 0) + 1;
    } else if (entity.entityType === EntityType.TOWER) {
      if (entity.side === 0) towers.blue++;
      else towers.red++;
    } else if (entity.entityType === EntityType.INHIBITOR) {
      if (entity.side === 0) inhibitors.blue++;
      else inhibitors.red++;
    }
  }

  const deaths = recorder.log.filter(entry => entry.kind === 'death');

  const lines: string[] = [];
  lines.push(`# Simulation report (t = ${sim.time.toFixed(1)}s)`, '');

  lines.push('## Champions', '');
  lines.push('| player | champion | side | lvl | hp | position | gold | cs | k/d | alive |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const c of champions) {
    lines.push(`| ${c.playerId} | ${c.championId} | ${c.side} | ${c.level} | ${c.hp} | ${c.position} | ${c.gold} | ${c.cs} | ${c.kills}/${c.deaths} | ${c.alive ? 'yes' : 'no'} |`);
  }
  lines.push('');

  lines.push('## World', '');
  lines.push(`- Towers standing: blue ${towers.blue}, red ${towers.red}`);
  lines.push(`- Inhibitors standing: blue ${inhibitors.blue}, red ${inhibitors.red}`);
  for (const [key, count] of Object.entries(units)) lines.push(`- ${key}: ${count}`);
  lines.push('');

  const deathCounts = new Map<string, number>();
  for (const death of deaths) {
    // Group "blue melee minion sim_e42 died at (x, y) - killed by red caster minion sim_e50"
    // into "blue melee minion died - killed by red caster minion"
    const text = stripIds(death.text).replace(/ at \([^)]*\)/g, '');
    deathCounts.set(text, (deathCounts.get(text) ?? 0) + 1);
  }
  if (deathCounts.size > 0) {
    lines.push('## Deaths (grouped)', '');
    for (const [text, count] of [...deathCounts.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${count}x ${text}`);
    }
    lines.push('');
  }

  if (recorder.damage.size > 0) {
    lines.push('## Damage dealt', '');
    // Group per unit type (all blue melee minions together)
    const grouped = new Map<string, Map<string, number>>();
    for (const [source, byKind] of recorder.damage) {
      const key = stripIds(source);
      const group = grouped.get(key) ?? new Map<string, number>();
      for (const [kind, amount] of byKind) group.set(kind, (group.get(kind) ?? 0) + amount);
      grouped.set(key, group);
    }
    const rows = [...grouped.entries()]
      .map(([source, byKind]) => ({ source, total: [...byKind.values()].reduce((a, b) => a + b, 0), byKind }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
    for (const row of rows) {
      const parts = [...row.byKind.entries()].map(([kind, amount]) => `${kind} ${Math.round(amount)}`).join(', ');
      lines.push(`- ${row.source}: ${Math.round(row.total)} (${parts})`);
    }
    lines.push('');
  }

  lines.push('## Log', '', '```');
  lines.push(recorder.formatLog(['note', 'spawn', 'death', 'cast', 'level', 'recall', 'respawn']) || '(empty)');
  lines.push('```');

  return {
    time: sim.time,
    champions,
    units,
    towers,
    inhibitors,
    deaths,
    log: recorder.log,
    markdown: lines.join('\n'),
  };
}
