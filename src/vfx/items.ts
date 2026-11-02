/**
 * Item VFX, keyed `item_<active id>` and spawned from the ABILITY_CAST events
 * the server sends when an item is used (ChampionItemActives) or one of its
 * passives goes off (Static's discharge, Veil blocking an ability): at the
 * champion, or for those aimed at a point (`ground_target`) there.
 * Registered when this module is imported (see VFXRegistry.ts).
 */

import { ITEM_CATALOG } from '@siege/shared';
import { registerAbilityVFX } from './VFXRegistryStore';
import {
  bolts,
  embers,
  light,
  petals,
  phase,
  pillar,
  rays,
  ring,
  shockwave,
  sigil,
  smoke,
  sparks,
  swirl,
  twinkles,
  wisps,
} from './recipes';

/** Sanctuary's delay before it lands (the catalog's) */
const SANCTUARY_DELAY = Number(ITEM_CATALOG.find(item => item.active?.id === 'sanctuary')?.active?.effectData.delay ?? 1.5);

// Healing Draught: green motes rising off the champion
registerAbilityVFX({
  abilityId: 'item_draught',
  phases: [
    phase('drink', 0, 'caster', [
      embers('#7bd88f', 10, 26),
      ring('#9be7a8', 10, 36, 0.35, 2),
    ], 0.8),
  ],
});

// Wayfarer's Flask: green and blue motes
registerAbilityVFX({
  abilityId: 'item_flask',
  phases: [
    phase('sip', 0, 'caster', [
      embers('#7bd88f', 8, 24),
      embers('#7cc6ff', 6, 24),
      ring('#a5d8ff', 10, 36, 0.35, 2),
    ], 0.8),
  ],
});

// Ironbark Elixir: bark-brown ring and leaves
registerAbilityVFX({
  abilityId: 'item_ironbark',
  phases: [
    phase('bark', 0, 'caster', [
      ring('#8d6e4a', 14, 60, 0.45, 5),
      petals('#7cb342', 10, [40, 110], 'leaf'),
      light('#a1887f', 60, 0.6, 0.5),
    ], 0.7),
  ],
});

// Stormfury Elixir: crackling red and violet
registerAbilityVFX({
  abilityId: 'item_stormfury',
  phases: [
    phase('fury', 0, 'caster', [
      sparks('#ff5252', 12, [120, 260]),
      sparks('#c084fc', 10, [120, 260]),
      ring('#ff8a80', 10, 55, 0.4, 3),
      light('#ff6e6e', 60, 0.8, 0.5),
    ], 0.6),
  ],
});

// Unchain: chains bursting off in white and cyan
registerAbilityVFX({
  abilityId: 'item_unchain',
  phases: [
    phase('break', 0, 'caster', [
      shockwave('#e0f7ff', 10, 75, 0.35, 6),
      sparks('#ffffff', 10, [180, 320]),
      sparks('#67e8f9', 8, [140, 260]),
      light('#b2ebf2', 60, 0.8, 0.4),
    ], 0.5),
  ],
});

// Stillness: a golden pillar folds over the champion
registerAbilityVFX({
  abilityId: 'item_stillness',
  phases: [
    phase('freeze', 0, 'caster', [
      pillar('#ffd54f', 120, 34, 0.5, '#fff8e1'),
      ring('#ffe082', 50, 24, 0.35, 4),
      twinkles('#fff3c4', 10, [10, 50]),
      light('#ffd54f', 80, 1.0, 2.5),
    ], 2.5),
  ],
});

// Shadowstep: shadow folding in where the champion lands
registerAbilityVFX({
  abilityId: 'item_shadowstep',
  phases: [
    phase('arrive', 0, 'ground_target', [
      smoke('#2a1f3d', 10, [12, 20], [30, 90]),
      rays('#9b6bff', 55, 0.3, 10, true),
      ring('#b388ff', 8, 44, 0.3, 3),
    ], 0.5),
  ],
});

// Gust: a gale where the champion lands, throwing enemies' footing
registerAbilityVFX({
  abilityId: 'item_gust',
  phases: [
    phase('land', 0, 'ground_target', [
      swirl('#b3e5fc', 120, 0.5, 1.4, 3),
      shockwave('#e1f5fe', 20, 150, 0.4, 8),
      wisps('#e1f5fe', 12, [120, 240]),
    ], 0.6),
  ],
});

// Shelter: the standard rings out a golden shield over its allies
registerAbilityVFX({
  abilityId: 'item_shelter',
  phases: [
    phase('rally', 0, 'caster', [
      ring('#ffe082', 30, 500, 0.6, 4),
      rays('#ffd54f', 70, 0.4, 12),
      light('#ffe082', 120, 0.8, 0.6),
    ], 0.7),
  ],
});

// Frost Nova: a ring of ice bursting out
registerAbilityVFX({
  abilityId: 'item_frost_nova',
  phases: [
    phase('nova', 0, 'caster', [
      shockwave('#b3e5fc', 20, 300, 0.5, 14),
      sparks('#e1f5fe', 24, [200, 420]),
      light('#81d4fa', 160, 0.9, 0.6),
    ], 0.7),
  ],
});

// Sanctuary: its circle marks where it will land, then light pours down
registerAbilityVFX({
  abilityId: 'item_sanctuary',
  phases: [
    phase('mark', 0, 'ground_target', [
      sigil('#9be7a8', 220, SANCTUARY_DELAY, 'rgba(155, 231, 168, 0.12)'),
    ], SANCTUARY_DELAY),
  ],
});

registerAbilityVFX({
  abilityId: 'item_sanctuary_land',
  phases: [
    phase('land', 0, 'ground_target', [
      pillar('#c8f7d0', 160, 60, 0.5, '#ffffff'),
      ring('#9be7a8', 40, 220, 0.5, 5),
      petals('#e8f5e9', 16, [60, 160]),
      light('#9be7a8', 200, 1.0, 0.6),
    ], 0.7),
  ],
});

// Static: Stormstring's charge leaps into its target and the enemies near it
registerAbilityVFX({
  abilityId: 'item_static',
  phases: [
    phase('zap', 0, 'ground_target', [
      bolts('#80deea', 4, 0.25, 26, 2.5),
      sparks('#e0f7fa', 14, [160, 320]),
      light('#4dd0e1', 90, 1.0, 0.3),
    ], 0.4),
  ],
});

// Veil: the spell it blocked shatters on a shimmering shell
registerAbilityVFX({
  abilityId: 'item_veil',
  phases: [
    phase('block', 0, 'caster', [
      ring('#b39ddb', 40, 60, 0.35, 5),
      twinkles('#ede7f6', 10, [30, 90]),
      sparks('#d1c4e9', 10, [120, 240]),
    ], 0.5),
  ],
});
