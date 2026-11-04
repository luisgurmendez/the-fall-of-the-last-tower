/**
 * Cast modes (src/core/input/castModes.ts): how a key press turns into a
 * cast. Quick cast casts at the cursor on the press. Quick cast with
 * indicator shows the ability's preview while the key is held and casts on
 * the release. Normal cast shows it on the press and casts on a left-click.
 * Abilities, summoner spells and item actives that aren't aimed (self
 * casts, areas around the caster) cast on the press in every mode. A
 * right-click or Escape drops the one shown.
 */
import { describe, it, expect } from 'bun:test';
import { SUMMONER_SPELLS, getAbilityDefinition, type AbilityDefinition } from '@siege/shared';
import {
  CAST_MODES,
  CastController,
  abilityAims,
  abilityReady,
  itemAims,
  sameCastable,
  summonerAims,
  type Castable,
  type CastMode,
} from '@/core/input/castModes';

const Q: Castable = { kind: 'ability', slot: 'Q' };
const W: Castable = { kind: 'ability', slot: 'W' };
const FLASH: Castable = { kind: 'summoner', slot: 0 };
const ITEM_1: Castable = { kind: 'item', slot: 0 };

const AIMED = { aims: true, ready: true };
const INSTANT = { aims: false, ready: true };
const NOT_READY = { aims: true, ready: false };

const press = (controller: CastController, castable: Castable, mode: CastMode, what = AIMED) =>
  controller.press(castable, { mode, ...what });

describe('The modes', () => {
  it('are quick cast, quick cast with indicator and normal cast, in that order', () => {
    expect(CAST_MODES.map(info => info.mode)).toEqual(['quick', 'quick_indicator', 'normal']);
  });

  it('each has a name and says how it works', () => {
    for (const info of CAST_MODES) {
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.description.length).toBeGreaterThan(0);
    }
  });
});

describe('sameCastable', () => {
  it('the same slot of the same kind', () => {
    expect(sameCastable(Q, { kind: 'ability', slot: 'Q' })).toBe(true);
    expect(sameCastable(FLASH, { kind: 'summoner', slot: 0 })).toBe(true);
  });

  it('other slots or other kinds are different', () => {
    expect(sameCastable(Q, W)).toBe(false);
    expect(sameCastable(FLASH, ITEM_1)).toBe(false);
    expect(sameCastable(FLASH, { kind: 'summoner', slot: 1 })).toBe(false);
    expect(sameCastable(Q, null)).toBe(false);
    expect(sameCastable(null, null)).toBe(false);
  });
});

describe('Quick cast', () => {
  it('casts on the press and shows nothing', () => {
    const controller = new CastController();
    expect(press(controller, Q, 'quick')).toBe('cast');
    expect(controller.getArmed()).toBeNull();
  });

  it("casts even when it isn't ready (the server says no, the HUD flashes), as it always did", () => {
    const controller = new CastController();
    expect(press(controller, Q, 'quick', NOT_READY)).toBe('cast');
  });

  it('the release and clicks do nothing', () => {
    const controller = new CastController();
    press(controller, Q, 'quick');
    expect(controller.release(Q, 'quick')).toBe(false);
    expect(controller.click('quick')).toBeNull();
  });

  it('casts things that aren\'t aimed on the press too', () => {
    const controller = new CastController();
    expect(press(controller, W, 'quick', INSTANT)).toBe('cast');
  });
});

describe('Quick cast with indicator', () => {
  it('the press shows it; the release casts it', () => {
    const controller = new CastController();
    expect(press(controller, Q, 'quick_indicator')).toBe('armed');
    expect(controller.getArmed()).toEqual(Q);
    expect(controller.release(Q, 'quick_indicator')).toBe(true);
    expect(controller.getArmed()).toBeNull();
  });

  it("another key's release doesn't cast it", () => {
    const controller = new CastController();
    press(controller, Q, 'quick_indicator');
    expect(controller.release(W, 'quick_indicator')).toBe(false);
    expect(controller.getArmed()).toEqual(Q);
  });

  it('pressing another aimed one switches to it; the first one\'s release then does nothing', () => {
    const controller = new CastController();
    press(controller, Q, 'quick_indicator');
    expect(press(controller, FLASH, 'quick_indicator')).toBe('armed');
    expect(controller.getArmed()).toEqual(FLASH);
    expect(controller.release(Q, 'quick_indicator')).toBe(false);
    expect(controller.release(FLASH, 'quick_indicator')).toBe(true);
  });

  it('a left-click while it shows casts it at once; the release later does nothing', () => {
    const controller = new CastController();
    press(controller, Q, 'quick_indicator');
    expect(controller.click('quick_indicator')).toEqual(Q);
    expect(controller.getArmed()).toBeNull();
    expect(controller.release(Q, 'quick_indicator')).toBe(false);
  });

  it('cancelling (right-click, Escape) drops it; the release then does nothing', () => {
    const controller = new CastController();
    press(controller, Q, 'quick_indicator');
    expect(controller.cancel()).toBe(true);
    expect(controller.getArmed()).toBeNull();
    expect(controller.release(Q, 'quick_indicator')).toBe(false);
  });

  it("one that isn't aimed casts on the press and leaves the shown one up", () => {
    const controller = new CastController();
    press(controller, Q, 'quick_indicator');
    expect(press(controller, W, 'quick_indicator', INSTANT)).toBe('cast');
    expect(controller.getArmed()).toEqual(Q);
    expect(controller.release(Q, 'quick_indicator')).toBe(true);
  });

  it("one that isn't ready shows nothing (the HUD flashes it) and leaves the shown one up", () => {
    const controller = new CastController();
    expect(press(controller, Q, 'quick_indicator', NOT_READY)).toBe('ignored');
    expect(controller.getArmed()).toBeNull();
    press(controller, W, 'quick_indicator');
    expect(press(controller, Q, 'quick_indicator', NOT_READY)).toBe('ignored');
    expect(controller.getArmed()).toEqual(W);
  });

  it("pressing it again while it's held (a repeat) keeps it up", () => {
    const controller = new CastController();
    press(controller, Q, 'quick_indicator');
    expect(press(controller, Q, 'quick_indicator')).toBe('armed');
    expect(controller.getArmed()).toEqual(Q);
  });

  it('a release with nothing shown does nothing', () => {
    expect(new CastController().release(Q, 'quick_indicator')).toBe(false);
  });
});

describe('Normal cast', () => {
  it('the press shows it; the release does nothing; a left-click casts it', () => {
    const controller = new CastController();
    expect(press(controller, Q, 'normal')).toBe('armed');
    expect(controller.release(Q, 'normal')).toBe(false);
    expect(controller.getArmed()).toEqual(Q);
    expect(controller.click('normal')).toEqual(Q);
    expect(controller.getArmed()).toBeNull();
  });

  it('pressing the same key again puts it away', () => {
    const controller = new CastController();
    press(controller, Q, 'normal');
    expect(press(controller, Q, 'normal')).toBe('disarmed');
    expect(controller.getArmed()).toBeNull();
    expect(controller.click('normal')).toBeNull();
  });

  it('pressing another aimed one switches to it', () => {
    const controller = new CastController();
    press(controller, Q, 'normal');
    expect(press(controller, ITEM_1, 'normal')).toBe('armed');
    expect(controller.click('normal')).toEqual(ITEM_1);
  });

  it('a click with nothing shown is just a click', () => {
    expect(new CastController().click('normal')).toBeNull();
  });

  it('cancelling drops it; cancelling with nothing shown says so', () => {
    const controller = new CastController();
    press(controller, Q, 'normal');
    expect(controller.cancel()).toBe(true);
    expect(controller.cancel()).toBe(false);
    expect(controller.click('normal')).toBeNull();
  });

  it("one that isn't aimed casts on the press and leaves the shown one up", () => {
    const controller = new CastController();
    press(controller, Q, 'normal');
    expect(press(controller, FLASH, 'normal', INSTANT)).toBe('cast');
    expect(controller.getArmed()).toEqual(Q);
  });

  it("one that isn't ready shows nothing", () => {
    const controller = new CastController();
    expect(press(controller, Q, 'normal', NOT_READY)).toBe('ignored');
    expect(controller.getArmed()).toBeNull();
  });

  it('one shown in another mode is dropped when the mode changes (the settings changed)', () => {
    const controller = new CastController();
    press(controller, Q, 'normal');
    expect(controller.click('quick')).toBeNull();
    expect(controller.getArmed()).toBeNull();
  });
});

describe('Which abilities are aimed', () => {
  const ability = (targetType: AbilityDefinition['targetType'], extra: Partial<AbilityDefinition> = {}) =>
    ({ ...getAbilityDefinition('warrior_slash')!, targetType, ...extra }) as AbilityDefinition;

  it('skillshots, ground targets and unit targets are', () => {
    for (const type of ['skillshot', 'ground_target', 'target_enemy', 'target_ally', 'target_unit'] as const) {
      expect(abilityAims(ability(type))).toBe(true);
    }
  });

  it("self casts, areas around the caster, auras and toggles aren't", () => {
    for (const type of ['self', 'no_target', 'aura', 'toggle'] as const) {
      expect(abilityAims(ability(type))).toBe(false);
    }
  });

  it('the real ones: a cone, a shield, a heal on an ally, a taunt around him, a targeted leap', () => {
    expect(abilityAims(getAbilityDefinition('warrior_slash')!)).toBe(true);
    expect(abilityAims(getAbilityDefinition('magnus_shield')!)).toBe(false);
    expect(abilityAims(getAbilityDefinition('elara_heal')!)).toBe(true);
    expect(abilityAims(getAbilityDefinition('gorath_taunt')!)).toBe(false);
    expect(abilityAims(getAbilityDefinition('uruk_r')!)).toBe(true);
  });

  it("Lume's orb: aimed when thrown, not when called back (its recast is a self cast)", () => {
    const orb = getAbilityDefinition('lume_q')!;
    expect(abilityAims(orb)).toBe(true);
    expect(abilityAims(orb, { rank: 1, cooldownRemaining: 0 })).toBe(true);
    expect(abilityAims(orb, { rank: 1, cooldownRemaining: 5, recastCount: 1, recastWindowRemaining: 2 })).toBe(false);
  });

  it('a recast window that has run out is the ability again', () => {
    const orb = getAbilityDefinition('lume_q')!;
    expect(abilityAims(orb, { rank: 1, cooldownRemaining: 5, recastCount: 1, recastWindowRemaining: 0 })).toBe(true);
  });

  it('a recast of the same ability aims like it', () => {
    const recastsItself = ability('skillshot', { recast: 2 });
    expect(abilityAims(recastsItself, { rank: 1, cooldownRemaining: 5, recastCount: 1, recastWindowRemaining: 2 })).toBe(true);
  });
});

describe('Whether an ability is ready', () => {
  it('learned and off cooldown', () => {
    expect(abilityReady({ rank: 1, cooldownRemaining: 0 })).toBe(true);
  });

  it('not learned, on cooldown or unknown: no', () => {
    expect(abilityReady({ rank: 0, cooldownRemaining: 0 })).toBe(false);
    expect(abilityReady({ rank: 2, cooldownRemaining: 0.5 })).toBe(false);
    expect(abilityReady(undefined)).toBe(false);
    expect(abilityReady({})).toBe(false);
  });

  it('its recast is ready while the cooldown runs', () => {
    expect(abilityReady({ rank: 1, cooldownRemaining: 6, recastCount: 1, recastWindowRemaining: 1 })).toBe(true);
  });

  it('with charges, ready while one is left, even with the cooldown running', () => {
    expect(abilityReady({ rank: 1, cooldownRemaining: 3, charges: 1 })).toBe(true);
    expect(abilityReady({ rank: 1, cooldownRemaining: 0, charges: 0 })).toBe(false);
    expect(abilityReady({ rank: 0, cooldownRemaining: 0, charges: 2 })).toBe(false);
  });
});

describe('Which summoner spells are aimed', () => {
  it('the blink, the burn, the weakening and the monster strike are', () => {
    expect(summonerAims(SUMMONER_SPELLS.blink)).toBe(true);
    expect(summonerAims(SUMMONER_SPELLS.scorch)).toBe(true);
    expect(summonerAims(SUMMONER_SPELLS.hinder)).toBe(true);
    expect(summonerAims(SUMMONER_SPELLS.reap)).toBe(true);
  });

  it("haste, the heal, the shield and the cleanse aren't", () => {
    expect(summonerAims(SUMMONER_SPELLS.haste)).toBe(false);
    expect(summonerAims(SUMMONER_SPELLS.mend)).toBe(false);
    expect(summonerAims(SUMMONER_SPELLS.aegis)).toBe(false);
    expect(summonerAims(SUMMONER_SPELLS.purge)).toBe(false);
  });

  it('no spell in the slot: not aimed', () => {
    expect(summonerAims(undefined)).toBe(false);
  });
});

describe('Which item actives are aimed', () => {
  const active = (targeting: 'self' | 'point') => ({
    id: 'x', name: 'X', description: '', cooldown: 10, targeting, effectType: 'dash' as const, effectData: {},
  });

  it('those used at a point are', () => {
    expect(itemAims(active('point'))).toBe(true);
  });

  it('those used on the champion, and items without an active, aren\'t', () => {
    expect(itemAims(active('self'))).toBe(false);
    expect(itemAims(undefined)).toBe(false);
  });
});
