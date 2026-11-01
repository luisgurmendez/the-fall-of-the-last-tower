/**
 * Kael (warrior) ability VFX: steel and azure, blades of light. Registered
 * when this module is imported (see ./index.ts).
 */

import { getAbilityDefinition } from '@siege/shared';
import { registerAbilityVFX } from '../VFXRegistryStore';
import {
  coneWarning,
  embers,
  landsAt,
  light,
  meteor,
  pathCut,
  phase,
  ring,
  scorch,
  shake,
  shockwave,
  slash,
  smoke,
  sparks,
  twinkles,
} from '../recipes';

const STEEL = '#a8d8ff';
const AZURE = '#4f8dff';
const WHITE = '#f2f8ff';
const DUST = '#8a7a66';

const SWING = landsAt('warrior_slash');
const CLEAVE = getAbilityDefinition('warrior_slash')?.aoeRadius ?? 170;

// Q: the cone flashes as he draws back, then a double crescent sweeps it
registerAbilityVFX({
  abilityId: 'warrior_slash',
  phases: [
    phase('draw', 0, 'caster', [
      coneWarning(AZURE, CLEAVE, Math.PI / 2, SWING),
      twinkles(WHITE, 1, [0, 0], { size: { min: 6, max: 7 }, lifetime: { min: SWING, max: SWING } }),
    ], SWING),
    phase('swing', SWING, 'caster', [
      slash(AZURE, CLEAVE * 0.97, Math.PI * 0.55, 0.36, CLEAVE * 0.45),
      slash(WHITE, CLEAVE * 0.87, Math.PI * 0.5, 0.28, CLEAVE * 0.12),
      sparks(STEEL, 14, [160, 340], Math.PI / 2),
      light(AZURE, CLEAVE * 0.85, 0.6, 0.3),
    ], 0.36),
  ],
});

// W: plates of steel circle him, glinting
registerAbilityVFX({
  abilityId: 'warrior_shield',
  phases: [
    phase('raise', 0, 'caster', [
      { type: 'shield_bubble', color: STEEL, radius: 45, duration: 3.0, pulseSpeed: 1.5, style: 'plates' },
      ring(AZURE, 18, 62, 0.35, 4),
      twinkles(WHITE, 6, [40, 120]),
      light(AZURE, 80, 0.6, 0.5),
    ], 3.0),
  ],
});

// E: afterimages and a cut of light along the charge, dust where he lands
registerAbilityVFX({
  abilityId: 'warrior_charge',
  phases: [
    phase('charge', 0, 'caster', [
      { type: 'dash_afterimage', color: AZURE, imageCount: 6, fadeSpeed: 3, duration: 0.3 },
      { type: 'trail', color: STEEL, thickness: 10, duration: 0.45, fadeLength: 14 },
      pathCut(WHITE, 8, 0.45),
      smoke(DUST, 5, [10, 16], [20, 60]),
    ], 0.45),
    phase('impact', 0.3, 'target', [
      smoke(DUST, 10, [12, 20], [40, 120]),
      sparks(WHITE, 14, [160, 340]),
      ring(STEEL, 8, 70, 0.3, 3),
      light(AZURE, 90, 0.7, 0.3),
    ]),
  ],
});

// R: a blade of light falls on the target as he leaps, and splits the ground
registerAbilityVFX({
  abilityId: 'warrior_ultimate',
  phases: [
    phase('leap', 0, 'caster', [
      { type: 'trail', color: AZURE, thickness: 12, duration: 0.5, fadeLength: 16 },
      embers(STEEL, 10, 30),
    ], 0.5),
    phase('blade', 0.05, 'target', [meteor('blade', AZURE, 16, 300, 0.32, WHITE)], 0.32),
    phase('strike', 0.37, 'target', [
      shockwave(AZURE, 20, 130, 0.45, 10),
      ring(WHITE, 10, 100, 0.25, 3),
      scorch(AZURE, 80, 2.0, 0.6),
      sparks(WHITE, 24, [200, 440]),
      sparks(AZURE, 12, [120, 260]),
      smoke('#9a8a70', 10, [16, 26], [50, 140]),
      light(AZURE, 180, 1.2, 0.6),
      { type: 'screen_flash', color: '#e0ecff', duration: 0.12, maxAlpha: 0.12 },
      shake(5, 0.25),
    ]),
  ],
});
