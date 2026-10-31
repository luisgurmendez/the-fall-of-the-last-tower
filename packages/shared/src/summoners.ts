/**
 * Summoner spells: two spells a player picks before the match, apart from
 * their champion's abilities, cast with D and F on long cooldowns. Our own
 * set, covering the classic roles (a blink, haste, a heal, a shield, a burn,
 * a weakening, a cleanse and a monster strike); distances follow the map's
 * scale (0.4 of the classic MOBA's).
 *
 * The server casts them (ChampionSummoners); the client shows them in
 * champion select, the HUD and the loading screen.
 */

export type SummonerSpellId = 'blink' | 'haste' | 'mend' | 'aegis' | 'scorch' | 'hinder' | 'purge' | 'reap';

/** What a summoner spell is aimed at */
export type SummonerTarget =
  /** Cast on the caster */
  | 'self'
  /** Cast toward a point (Blink: as far as its range goes) */
  | 'position'
  /** Cast on an enemy champion */
  | 'enemy_champion'
  /** Cast on a jungle monster or minion */
  | 'monster';

export interface SummonerSpellDefinition {
  id: SummonerSpellId;
  name: string;
  /** Tooltip text: what it does, with its numbers */
  description: string;
  /** Seconds */
  cooldown: number;
  target: SummonerTarget;
  /** How far it reaches (world units), for aimed spells */
  range?: number;
  /** Main color of its effects and icon accents */
  color: string;
}

export const SUMMONER_SPELLS: Record<SummonerSpellId, SummonerSpellDefinition> = {
  blink: {
    id: 'blink',
    name: 'Blink',
    description: 'Vanish and reappear up to 160 units toward the cursor, over walls if there is room past them.',
    cooldown: 180,
    target: 'position',
    range: 160,
    color: '#c9a7ff',
  },
  haste: {
    id: 'haste',
    name: 'Haste',
    description: 'Gain 35% movement speed for 8 seconds.',
    cooldown: 150,
    target: 'self',
    color: '#7fe3ff',
  },
  mend: {
    id: 'mend',
    name: 'Mend',
    description: 'Heal yourself and the most wounded allied champion within 340 for 80 + 15 per level, and both gain 30% movement speed for 1 second.',
    cooldown: 150,
    target: 'self',
    range: 340,
    color: '#7dffa1',
  },
  aegis: {
    id: 'aegis',
    name: 'Aegis',
    description: 'Shield yourself from 100 + 20 per level damage for 2.5 seconds.',
    cooldown: 150,
    target: 'self',
    color: '#ffe08a',
  },
  scorch: {
    id: 'scorch',
    name: 'Scorch',
    description: 'Set an enemy champion within 240 alight: 50 + 20 per level true damage over 5 seconds, and its healing is cut by 40%.',
    cooldown: 150,
    target: 'enemy_champion',
    range: 240,
    color: '#ff8a3d',
  },
  hinder: {
    id: 'hinder',
    name: 'Hinder',
    description: 'Weigh down an enemy champion within 260: 30% slower and 35% less attack damage and ability power for 2.5 seconds.',
    cooldown: 150,
    target: 'enemy_champion',
    range: 260,
    color: '#b48cff',
  },
  purge: {
    id: 'purge',
    name: 'Purge',
    description: 'Shake off every stun, root, slow and other debuff on you.',
    cooldown: 150,
    target: 'self',
    color: '#ffffff',
  },
  reap: {
    id: 'reap',
    name: 'Reap',
    description: 'Strike a jungle monster or minion within 200 for 450 + 25 per level true damage.',
    cooldown: 60,
    target: 'monster',
    range: 200,
    color: '#ffd23d',
  },
};

export const SUMMONER_SPELL_IDS = Object.keys(SUMMONER_SPELLS) as SummonerSpellId[];

/** What a player gets without picking */
export const DEFAULT_SUMMONER_SPELLS: [SummonerSpellId, SummonerSpellId] = ['blink', 'haste'];

export function isSummonerSpellId(id: unknown): id is SummonerSpellId {
  return typeof id === 'string' && id in SUMMONER_SPELLS;
}

/**
 * A valid pair of summoner spells from untrusted input: two different known
 * spells, or the defaults.
 */
export function parseSummonerSpells(value: unknown): [SummonerSpellId, SummonerSpellId] {
  if (Array.isArray(value) && value.length === 2 && isSummonerSpellId(value[0]) && isSummonerSpellId(value[1]) && value[0] !== value[1]) {
    return [value[0], value[1]];
  }
  return [...DEFAULT_SUMMONER_SPELLS];
}
