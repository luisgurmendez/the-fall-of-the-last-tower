/**
 * Champion client contract.
 *
 * Every champion in CHAMPION_DEFINITIONS must be wired into the canvas client
 * (the repo-root src/): it needs an entry in the champion renderer registry
 * (src/render/champions/), and each of its abilities needs VFX
 * (src/vfx/champions/) or an explicit reason it has none.
 *
 * The test lives in this workspace so `npm run test:packages` runs it; the
 * `@/` imports resolve to the repo-root src/ through the root tsconfig.json.
 *
 * How a cast finds its VFX: the server's ABILITY_CAST event carries the
 * ability's definition ID (champion.definition.abilities[slot], e.g. 'lume_q';
 * see ServerAbilityExecutor.castAbility), and OnlineStateManager passes it
 * unchanged to VFXManager.spawnAbilityVFX, which calls getAbilityVFX(abilityId).
 * There is no alias table, so VFX registered under any other key never plays.
 */

import { describe, it, expect } from 'bun:test';
import { CHAMPION_DEFINITIONS, MOBAConfig, SUMMONER_SPELL_IDS } from '@siege/shared';
import { CHAMPION_RENDERERS, getChampionRenderer } from '@/render/champions';
import { getAbilityVFX, getAllRegisteredVFX } from '@/vfx/VFXRegistry';
import { WORLD_VFX } from '@/vfx/world';

interface NoVFX {
  /** Why the ability plays no VFX when cast */
  reason: string;
  /** Key the ability's VFX is registered under instead, if there is one */
  registeredAs?: string;
}

/**
 * Abilities that play no VFX when cast, with the reason. VFX are registered
 * under the ability ID the server sends in ABILITY_CAST events.
 */
const ABILITIES_WITHOUT_VFX: Record<string, NoVFX> = {};

/**
 * ABILITY_CAST events the server sends that aren't a plain cast: recasts use
 * `<abilityId>_recast` (handled below), Vile's traps send these, Urûk's
 * scales send one when they burst (UrukHooks), Oitboil one when he
 * overheats (OitboilHooks), and so do the jungle monsters' special attacks.
 */
const OTHER_CAST_EVENT_IDS = [
  'vile_trap_trigger',
  'vile_trap_explosion',
  'uruk_e_burst',
  'oitboil_overheat',
  'caelum_lightweave',
  'caelum_r_given',
  'fenris_r_feast',
  'calamitus_lava_erupt',
  'protobot_q_pull',
  'protobot_r_pulse',
  'hop_hop',
  'hop_r_crash',
  ...Object.values(MOBAConfig.JUNGLE.SPECIAL_ATTACKS).map((attack) => attack.abilityId),
];

/** Basic attack projectiles other than <championId>_auto (EloraHooks.basicAttackProjectileType), which have impacts */
const OTHER_ATTACK_PROJECTILES = ['elora_poison_auto', 'elora_weak_auto'];

const ALL_ABILITY_IDS = Object.values(CHAMPION_DEFINITIONS).flatMap((definition) =>
  Object.values(definition.abilities)
);

describe('Champion client contract', () => {
  for (const [championId, definition] of Object.entries(CHAMPION_DEFINITIONS)) {
    describe(championId, () => {
      it('has a champion renderer entry', () => {
        expect(getChampionRenderer(championId)).toBeDefined();
      });

      it('prefixes its projectile and status icon keys with its id', () => {
        // Projectile renderers from all champions are merged into one lookup,
        // so an unprefixed key could shadow another champion's or a generic one
        const entry = getChampionRenderer(championId);
        const keys = [
          ...Object.keys(entry?.projectiles ?? {}),
          ...Object.keys(entry?.markVisuals ?? {}),
        ];
        expect(keys.filter((key) => !key.startsWith(`${championId}_`))).toEqual([]);
      });

      it('has VFX for every ability, or a listed reason it has none', () => {
        const unexplained = Object.entries(definition.abilities)
          .filter(([, abilityId]) => !getAbilityVFX(abilityId) && !ABILITIES_WITHOUT_VFX[abilityId])
          .map(([slot, abilityId]) => `${slot}: ${abilityId}`);
        expect(unexplained).toEqual([]);
      });
    });
  }

  it('has no renderer entries for champions that do not exist', () => {
    const unknown = Object.keys(CHAMPION_RENDERERS).filter(
      (championId) => !(championId in CHAMPION_DEFINITIONS)
    );
    expect(unknown).toEqual([]);
  });

  it('lists only abilities that exist and still have no VFX', () => {
    const stale = Object.keys(ABILITIES_WITHOUT_VFX).filter(
      (abilityId) => !ALL_ABILITY_IDS.includes(abilityId) || getAbilityVFX(abilityId)
    );
    expect(stale).toEqual([]);
  });

  it('points every known gap at VFX that is actually registered', () => {
    const wrong = Object.entries(ABILITIES_WITHOUT_VFX)
      .filter(([, gap]) => gap.registeredAs !== undefined && !getAbilityVFX(gap.registeredAs))
      .map(([abilityId, gap]) => `${abilityId} -> ${gap.registeredAs}`);
    expect(wrong).toEqual([]);
  });

  it('registers no VFX that nothing spawns', () => {
    const reachable = new Set<string>([
      ...ALL_ABILITY_IDS,
      ...ALL_ABILITY_IDS.map((abilityId) => `${abilityId}_recast`),
      ...OTHER_CAST_EVENT_IDS,
      // Spawned where a skillshot's projectile is destroyed (state/entityVFX.ts)
      ...ALL_ABILITY_IDS.map((abilityId) => `${abilityId}_impact`),
      ...OTHER_ATTACK_PROJECTILES.map((projectile) => `${projectile}_impact`),
      // Spawned by OnlineStateManager for hits, deaths, level ups, ...
      ...Object.values(WORLD_VFX),
      // Spawned on SUMMONER_CAST events (state/gameEvents.ts)
      ...SUMMONER_SPELL_IDS.map((spellId) => `summoner_${spellId}`),
      ...Object.values(ABILITIES_WITHOUT_VFX).flatMap((gap) =>
        gap.registeredAs ? [gap.registeredAs] : []
      ),
    ]);
    expect(getAllRegisteredVFX().filter((key) => !reachable.has(key))).toEqual([]);
  });
});
