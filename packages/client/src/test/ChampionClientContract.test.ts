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
import { CHAMPION_DEFINITIONS } from '@siege/shared';
import { CHAMPION_RENDERERS, getChampionRenderer } from '@/render/champions';
import { getAbilityVFX, getAllRegisteredVFX } from '@/vfx/VFXRegistry';

interface NoVFX {
  /** Why the ability plays no VFX when cast */
  reason: string;
  /** Key the ability's VFX is registered under instead, if there is one */
  registeredAs?: string;
}

const UNREACHABLE_KEY =
  'KNOWN GAP: VFX exists but is registered under a key no cast event sends';

/**
 * Abilities that play no VFX when cast, with the reason.
 *
 * KNOWN GAPS: every entry below has VFX written for it in src/vfx/champions/,
 * but registered under a different key (registeredAs) than the ability ID the
 * server sends, so in game these abilities show no VFX at all. To fix one,
 * rename the registered abilityId to the ability ID (a visible change, so
 * check it in game) and delete the entry here; the stale-entry test below
 * fails until you do.
 */
const ABILITIES_WITHOUT_VFX: Record<string, NoVFX> = {
  // Warrior: W Iron Will, R Heroic Strike
  warrior_shield: { reason: UNREACHABLE_KEY, registeredAs: 'warrior_iron_will' },
  warrior_ultimate: { reason: UNREACHABLE_KEY, registeredAs: 'warrior_heroic_strike' },
  // Magnus: W Arcane Barrier, E Quagmire, R Inferno Zone
  magnus_shield: { reason: UNREACHABLE_KEY, registeredAs: 'magnus_barrier' },
  magnus_mud: { reason: UNREACHABLE_KEY, registeredAs: 'magnus_quagmire' },
  magnus_meteor: { reason: UNREACHABLE_KEY, registeredAs: 'magnus_inferno' },
  // Elara: E Swift Grace, R Divine Intervention
  elara_speed: { reason: UNREACHABLE_KEY, registeredAs: 'elara_swift_grace' },
  elara_resurrection: { reason: UNREACHABLE_KEY, registeredAs: 'elara_divine_intervention' },
  // Vile: all four abilities
  vile_black_arrows: { reason: UNREACHABLE_KEY, registeredAs: 'vile_arrow' },
  vile_veil_of_darkness: { reason: UNREACHABLE_KEY, registeredAs: 'vile_veil' },
  vile_roots_of_vilix: { reason: UNREACHABLE_KEY, registeredAs: 'vile_trap' },
  vile_restoration_of_vilix: { reason: UNREACHABLE_KEY, registeredAs: 'vile_restoration' },
  // Lume: Q Send the Light, W Warmth, E Dazzle Step (R is registered as lume_r)
  lume_q: { reason: UNREACHABLE_KEY, registeredAs: 'lume_send_light' },
  lume_w: { reason: UNREACHABLE_KEY, registeredAs: 'lume_warmth' },
  lume_e: { reason: UNREACHABLE_KEY, registeredAs: 'lume_dazzle_step' },
};

/**
 * ABILITY_CAST events the server sends that aren't a plain cast: recasts use
 * `<abilityId>_recast` (handled below) and Vile's traps send these.
 */
const OTHER_CAST_EVENT_IDS = ['vile_trap_trigger', 'vile_trap_explosion'];

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

  it('registers no VFX that no cast event can reach, other than the known gaps', () => {
    const reachable = new Set([
      ...ALL_ABILITY_IDS,
      ...ALL_ABILITY_IDS.map((abilityId) => `${abilityId}_recast`),
      ...OTHER_CAST_EVENT_IDS,
      ...Object.values(ABILITIES_WITHOUT_VFX).flatMap((gap) =>
        gap.registeredAs ? [gap.registeredAs] : []
      ),
    ]);
    expect(getAllRegisteredVFX().filter((key) => !reachable.has(key))).toEqual([]);
  });
});
