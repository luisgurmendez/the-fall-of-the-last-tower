/**
 * Every champion ability's timings and numbers, read from their definitions
 * (packages/shared/src/champions/definitions/): how long it takes to cast,
 * how long until it takes effect (an area's warning, a projectile's or a
 * dash's speed and the time to cross its range), how long its effects last,
 * and its cooldown, cost, range and size. Writes a Markdown table, and the
 * rows as JSON for a page.
 *
 * Timings a champion's server handler keeps in code (a kit constant, not the
 * definition) aren't here: the table says "handler" where a column is empty
 * for an ability whose behavior is custom.
 *
 * Usage (from the repo root): bun scripts/ability-timings.ts [--md out.md] [--json out.json]
 */

import { writeFileSync } from 'node:fs';
import { getAllChampionDefinitions, getAbilityDefinition, getPassiveDefinition, getCastTime, dodgeOf, DODGE_RULES, type AbilityDefinition, type PassiveAbilityDefinition } from '@siege/shared';

const SLOTS = ['Q', 'W', 'E', 'R'] as const;

export interface TimingRow {
  champion: string;
  slot: string;
  ability: string;
  id: string;
  /** How it's aimed: a skillshot, an area, a target... */
  aim: string;
  /** Seconds standing still before it goes off (cast time), or charging, or channelling */
  cast: string;
  /** Until it takes effect: an area's warning, a projectile or a dash's speed and time across its range */
  delay: string;
  /** How long its effects last (each one) */
  lasts: string;
  /** How dodgeable it is: warning / time to walk out (abilities/dodge.ts), against its rule */
  dodge: string;
  cooldown: string;
  cost: string;
  range: string;
  size: string;
  other: string;
}

const s = (seconds: number) => `${Math.round(seconds * 100) / 100} s`;
const list = (values: number[] | undefined, unit = '') => {
  if (!values || values.length === 0 || values.every(v => v === 0)) return '';
  const same = values.every(v => v === values[0]);
  return (same ? String(values[0]) : values.join('/')) + unit;
};

function aimOf(a: AbilityDefinition): string {
  const shape = a.shape && a.shape !== 'circle' ? ` (${a.shape})` : '';
  switch (a.targetType) {
    case 'skillshot': return `skillshot${shape}`;
    case 'ground_target': return `ground${a.aoeRadius ? ' area' : ''}${shape}`;
    case 'target_enemy': return 'enemy target';
    case 'target_ally': return 'ally target';
    case 'self': return a.aoeRadius ? 'around self' : 'self';
    case 'no_target': return a.aoeRadius ? 'around self' : 'no target';
    default: return a.targetType ?? a.type;
  }
}

function castOf(a: AbilityDefinition): string {
  const parts: string[] = [];
  // As the server reads it: its own, or the default by its kind (0.25 s for aimed ones)
  const cast = getCastTime(a);
  if (cast) parts.push(a.castTime === undefined ? `${s(cast)} (default)` : s(cast));
  if (a.charge) parts.push(`charge ${s(a.charge.minChargeTime)}-${s(a.charge.maxChargeTime)}`);
  if (a.channel) parts.push(`channel ${s(a.channel.duration)}${a.channel.canMove ? ' (moving)' : ''}`);
  return parts.join(', ') || 'instant';
}

function delayOf(a: AbilityDefinition): string {
  const parts: string[] = [];
  if (a.aoeDelay) parts.push(`lands after ${s(a.aoeDelay)}`);
  if (a.projectileSpeed) {
    const across = a.range ? ` (${s(a.range / a.projectileSpeed)} at max range)` : '';
    parts.push(`projectile ${a.projectileSpeed}/s${across}`);
  }
  if (a.dash) parts.push(`dash ${a.dash.speed}/s over ${a.dash.distance} (${s(a.dash.distance / a.dash.speed)})`);
  if (a.teleport) parts.push('teleport');
  return parts.join(', ');
}

function lastsOf(a: AbilityDefinition): string {
  const parts: string[] = [];
  if (a.appliesEffects?.length) parts.push(`${a.appliesEffects.join(', ')}${a.effectDuration ? ` ${s(a.effectDuration)}` : ''}`);
  else if (a.effectDuration) parts.push(`effects ${s(a.effectDuration)}`);
  if (a.shield) parts.push(`shield ${s(a.shield.duration)}`);
  if (a.aoeDuration) parts.push(`area ${s(a.aoeDuration)}${a.aoeTickRate ? ` (ticks every ${s(a.aoeTickRate)})` : ''}`);
  if (a.zoneDuration) parts.push(`zone ${s(a.zoneDuration)}${a.zoneTickRate ? ` (ticks every ${s(a.zoneTickRate)})` : ''}`);
  if (a.statTransform) parts.push(`buff ${s(a.statTransform.duration)}`);
  if (a.transform?.duration) parts.push(`form ${s(a.transform.duration)}`);
  if (a.trap) parts.push(`trap ${s(a.trap.duration)}, roots ${s(a.trap.rootDuration)}`);
  if (a.postEffects) parts.push(`after: ${a.postEffects.effects.join(', ')} ${s(a.postEffects.duration)}`);
  if (a.recastWindow) parts.push(`recast within ${s(a.recastWindow)}`);
  return parts.join('; ');
}

function otherOf(a: AbilityDefinition): string {
  const parts: string[] = [];
  if (a.ammo) {
    const ammo = typeof a.ammo === 'number' ? { maxCharges: a.ammo, rechargeTime: [] as number[] } : a.ammo;
    parts.push(`${ammo.maxCharges} charges${ammo.rechargeTime.length ? `, one back every ${list(ammo.rechargeTime, ' s')}` : ''}`);
  }
  if (a.toggle) parts.push('toggle');
  if (a.piercing) parts.push('piercing');
  if (a.stopsOnWall) parts.push('stops at walls');
  if (a.damage) parts.push(`${a.damage.type} damage`);
  if (a.heal) parts.push('heals');
  return parts.join(', ');
}

function sizeOf(a: AbilityDefinition): string {
  const parts: string[] = [];
  if (a.aoeRadius) parts.push(`radius ${a.aoeRadius}`);
  if (a.width) parts.push(`width ${a.width}`);
  if (a.projectileRadius) parts.push(`projectile radius ${a.projectileRadius}`);
  if (a.coneAngle) parts.push(`cone ${Math.round((a.coneAngle * 180) / Math.PI)}°`);
  return parts.join(', ');
}

/** A passive's row: what sets it off, how often, its stacks and what it gives for how long */
function passiveRow(champion: string, p: PassiveAbilityDefinition): TimingRow {
  const triggers = [p.trigger, ...(p.additionalTriggers ?? [])].join(', ');
  const lasts: string[] = [];
  if (p.appliesEffects?.length) lasts.push(`${p.appliesEffects.join(', ')}${p.effectDuration ? ` ${s(p.effectDuration)}` : ''}`);
  if (p.shield) lasts.push(`shield ${s(p.shield.duration)}`);
  if (p.stackDuration) lasts.push(`stacks last ${s(p.stackDuration)}`);
  const other: string[] = [];
  if (p.maxStacks) other.push(`up to ${p.maxStacks} ${p.stackName ?? 'stacks'}${p.requiredStacks ? `, goes off at ${p.requiredStacks}` : ''}`);
  if (p.healthThreshold) other.push(`below ${Math.round(p.healthThreshold * 100)}% health`);
  if (p.auraRadius) other.push(`aura ${p.auraRadius}`);
  if (p.damage) other.push('damage');
  if (p.heal) other.push('heals');
  return {
    champion, slot: 'P', ability: p.name, id: p.id,
    aim: `passive (${triggers})`,
    cast: '—',
    delay: p.intervalSeconds ? `every ${s(p.intervalSeconds)}` : '',
    lasts: lasts.join('; '),
    dodge: '',
    cooldown: p.internalCooldown ? s(p.internalCooldown) : '',
    cost: '', range: '', size: p.auraRadius ? `radius ${p.auraRadius}` : '',
    other: other.join(', '),
  };
}

/**
 * Timings a server handler keeps in code (the definition doesn't carry them),
 * read from the handlers on 2026-11-04: they fill the columns the definition
 * leaves empty. Update them when a handler changes.
 */
const HANDLER_TIMINGS: Record<string, Partial<Pick<TimingRow, 'delay' | 'lasts' | 'other'>>> = {
    "elara_resurrection": {
      "other": "heals and cleanses at once (not knockups, knockbacks, suppression)"
    },
    "vile_roots_of_vilix": {
      "delay": "the trap arms 1 s after it's placed",
      "lasts": "trap 120 s; root 1 s",
      "other": "1 s between traps"
    },
    "lume_q": {
      "delay": "orb 700/s",
      "lasts": "orb stays 4 s, then returns at 700/s; recall (recast) within 10 s; the returning orb slows 30% for 1.5 s"
    },
    "lume_w": {
      "other": "one pulse at the orb"
    },
    "lume_e": {
      "lasts": "beam 2.5 s; slow_30 while in it; allies in it speed_20 1 s",
      "other": "needs the orb"
    },
    "uruk_e": {
      "delay": "frost burst when the shield breaks or ends (up to 2.5 s)",
      "lasts": "burst slow 30% 1.5 s"
    },
    "oitboil_q": {
      "other": "heat +20; heat falls 15/s after 4.5 s without casting"
    },
    "oitboil_r": {
      "delay": "4 pulses over 0.74 s",
      "lasts": "pours 1 s (rooted), then exhausted (silenced, disarmed) 1.5 s",
      "other": "heat +40; a stun or death stops it"
    },
    "fenris_q": {
      "other": "feral (under 40% health): heals twice as much"
    },
    "calamitus_q": {
      "lasts": "lava pool 4 s (burns every 0.5 s)"
    },
    "protobot_e": {
      "lasts": "knockup 1 s; a shield on himself 2 s"
    },
    "hop_q": {
      "lasts": "armor_reduction (-10 armor) 4 s"
    },
    "hop_r": {
      "delay": "the target flies back 380 at 1000/s (0.38 s)",
      "lasts": "target stunned 0.48 s; champions it crashes into knocked up 1 s"
    },
    "zhakrul_w": {
      "lasts": "cloud 4 s (ticks every 1 s, +25% each in a row); slow 30% lingers 1 s; venom 3 s"
    },
    "zhakrul_e": {
      "delay": "burrows 650/s up to 320 (0.49 s), bursts where it comes up",
      "lasts": "knockup 1 s",
      "other": "goes under walls"
    },
    "zhakrul_r": {
      "delay": "damage in 6 ticks, every 0.5 s",
      "lasts": "stun 1.25 s; damage over 3 s; 3 venom doses 3 s"
    },
    "kip_w": {
      "lasts": "slow 40% 1/1.25/1.5/1.75/2 s on marked enemies within 650"
    },
    "kip_e": {
      "delay": "dash 750/s up to 200 (0.27 s), a burst where it lands",
      "lasts": "mark 4 s",
      "other": "a wall stops the dash"
    },
    "kip_r": {
      "delay": "a volley per mark, every 0.15 s; arrows 1100/s",
      "other": "a stun, silence or death stops the rest"
    },
    "nocthar_e": {
      "lasts": "charge 3 s (+30% speed, +20-40% damage), back every 10-6 s",
      "other": "Hollows past 380 drop the order"
    },
    "nocthar_colossus_w": {
      "delay": "the colossus winds up 0.4 s, the bones fly 0.5 s: they land 0.9 s after the cast",
      "lasts": "slow 40% 1.5 s",
      "other": "costs the colossus 10% of its max health"
    },
    "nocthar_colossus_e": {
      "delay": "the colossus winds up 0.35 s, then charges 210 in 0.4 s",
      "lasts": "enemies carried, then knocked up 0.5 s",
      "other": "costs the colossus 10% of its max health"
    },
    "nocthar_colossus_r": {
      "other": "an order, at once"
    }
  };

export function abilityRows(): TimingRow[] {
  const rows: TimingRow[] = [];
  for (const champion of getAllChampionDefinitions()) {
    const passive = getPassiveDefinition(champion.passive);
    if (passive) rows.push(passiveRow(champion.name, passive));
    const slots: [string, string][] = SLOTS.map(slot => [slot, champion.abilities[slot]]);
    const swapLabel = champion.swapLabel ?? 'swapped';
    for (const slot of SLOTS) {
      const swapped = champion.swapAbilities?.[slot];
      if (swapped) slots.push([`${slot} (${swapLabel.toLowerCase()})`, swapped]);
    }
    for (const [slot, id] of slots) {
      const a = getAbilityDefinition(id);
      if (!a) continue;
      const delay = delayOf(a);
      const lasts = lastsOf(a);
      const code = HANDLER_TIMINGS[id] ?? {};
      rows.push({
        champion: champion.name,
        slot,
        ability: a.name,
        id,
        aim: aimOf(a),
        cast: castOf(a),
        delay: joinCode(delay || (a.aoeRadius || a.damage ? 'at once' : ''), code.delay, delay === ''),
        lasts: joinCode(lasts, code.lasts, lasts === ''),
        dodge: dodgeText(a, slot),
        cooldown: list(a.cooldown, ' s'),
        cost: list(a.manaCost),
        range: a.range ? String(a.range) : '',
        size: sizeOf(a),
        other: joinCode(otherOf(a), code.other, false),
      });
    }
  }
  return rows;
}

/** "1.2 (ground area, needs 1)", "exempt: <why>", or "" for what isn't dodged */
function dodgeText(a: AbilityDefinition, slot: string): string {
  if (a.dodgeExempt) return `exempt: ${a.dodgeExempt}`;
  const dodge = dodgeOf(a);
  if (!dodge) return '';
  const rule = DODGE_RULES[dodge.kind][slot.startsWith('R') ? 'ultimate' : 'basic'];
  return `${dodge.ratio.toFixed(2)} (${dodge.kind.replace('_', ' ')}, needs ${rule})`;
}

/** A definition's value with the handler's after it (marked "(code)"), or the handler's in its place */
function joinCode(own: string, fromHandler: string | undefined, replace: boolean): string {
  if (!fromHandler) return own;
  const marked = `${fromHandler} (code)`;
  return replace || !own || own === 'at once' ? marked : `${own}; ${marked}`;
}

const COLUMNS: [keyof TimingRow, string][] = [
  ['champion', 'Champion'], ['slot', 'Slot'], ['ability', 'Ability'], ['aim', 'Aim'], ['cast', 'Cast time'],
  ['delay', 'Until it takes effect'], ['lasts', 'How long it lasts'], ['dodge', 'Dodge'], ['cooldown', 'Cooldown'], ['cost', 'Cost'],
  ['range', 'Range'], ['size', 'Size'], ['other', 'Other'],
];

export function markdownTable(rows: TimingRow[]): string {
  const escape = (text: string) => text.replace(/\|/g, '\\|') || '—';
  const head = `| ${COLUMNS.map(([, title]) => title).join(' | ')} |\n|${COLUMNS.map(() => '---').join('|')}|`;
  return [head, ...rows.map(row => `| ${COLUMNS.map(([key]) => escape(row[key])).join(' | ')} |`)].join('\n');
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const option = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  const rows = abilityRows();
  const md = option('--md');
  const json = option('--json');
  if (md) writeFileSync(md, markdownTable(rows) + '\n');
  if (json) writeFileSync(json, JSON.stringify(rows, null, 2));
  if (!md && !json) console.log(markdownTable(rows));
  console.error(`${rows.length} abilities`);
}
