/**
 * Lume ability VFX: warm white light split into prism colors; rays,
 * crystals and beams. Registered when this module is imported (see
 * ./index.ts). The Light Orb is drawn by src/gpu/fx/lightOrb.ts, and the
 * Prismatic Beam (E) by her renderer (src/render/champions/lume.ts).
 */

import { getAbilityDefinition, LUME_ORB_CONFIG } from '@siege/shared';
import { registerAbilityVFX } from '../VFXRegistryStore';
import { abilityImpactTime } from '@/core/state/abilityTiming';
import {
  embers,
  gather,
  landsAt,
  light,
  pathCut,
  phase,
  rays,
  ring,
  shake,
  sparks,
  twinkles,
} from '../recipes';

const LIGHT = '#fff3b0';
const WARM = '#ffd27a';
const WHITE = '#ffffff';
const SOFT = '#fff9e0';
const CYAN = '#9ff3ff';
const PINK = '#ffb0f0';

const ECLIPSE = landsAt('lume_r');
const ECLIPSE_WIDTH = (getAbilityDefinition('lume_r')?.aoeRadius ?? LUME_ORB_CONFIG.rBeamHalfWidth) * 2;

const crystals = (color: string, count: number, speed: [number, number]) =>
  ({ ...sparks(color, count, speed), particleType: 'crystal' as const, size: { min: 3, max: 5 }, lifetime: { min: 0.4, max: 0.7 } });

// Q: she sends the orb off in a spray of light; it lands in a scatter of crystals
registerAbilityVFX({
  abilityId: 'lume_q',
  phases: [
    phase('send', 0, 'caster', [twinkles(LIGHT, 5), sparks(WARM, 8, [180, 340], Math.PI / 4), light(LIGHT, 60, 0.6, 0.25)], 0.3),
    phase('arrive', abilityImpactTime('lume_q'), 'ground_target', [
      ring(WHITE, 5, LUME_ORB_CONFIG.qImpactRadius, 0.3, 3),
      crystals(CYAN, 5, [60, 140]),
      crystals(PINK, 4, [60, 140]),
      twinkles(WHITE, 5, [20, 60]),
    ], 0.7),
  ],
});

// W: a warm pulse of rays rolling out
registerAbilityVFX({
  abilityId: 'lume_w',
  phases: [
    phase('pulse', 0, 'caster', [
      rays(WARM, LUME_ORB_CONFIG.wPulseRadius * 0.85, 0.6, 18, false, 0.6),
      ring(WARM, 10, LUME_ORB_CONFIG.wPulseRadius, 0.5, 3),
      light(WARM, LUME_ORB_CONFIG.wPulseRadius * 0.8, 0.6, 0.5),
      embers(SOFT, 14, LUME_ORB_CONFIG.wPulseRadius * 0.6),
    ], 0.6),
  ],
});

// E: light flares on her as the beam to the orb forms (the beam itself is
// drawn by her renderer while it lasts: it follows her and the orb)
registerAbilityVFX({
  abilityId: 'lume_e',
  phases: [
    phase('flare', 0, 'caster', [
      rays(WHITE, 60, 0.35, 16, false, 1),
      crystals(CYAN, 5, [100, 200]),
      crystals(PINK, 5, [100, 200]),
      light(WHITE, 60, 0.9, 0.35),
    ], 0.4),
  ],
});

// R: light gathers into the orb along the line it will fire, then a huge
// beam blasts down it
registerAbilityVFX({
  abilityId: 'lume_r',
  phases: [
    phase('gather', 0, 'caster', [
      { type: 'beam', color: LIGHT, thickness: 4, duration: ECLIPSE, glowRadius: 6 },
      gather(LIGHT, 16, 110, ECLIPSE, 'circle'),
      rays(WHITE, 90, ECLIPSE, 16, true),
      light(LIGHT, 90, 0.5, ECLIPSE),
    ], ECLIPSE),
    // The beam's glow is 2.5 times its thickness: half as wide as it hits,
    // the bloom spreads it to the edges (any wider and it burns white)
    phase('fire', ECLIPSE, 'caster', [
      { type: 'beam', color: WARM, colorSecondary: LIGHT, thickness: ECLIPSE_WIDTH / 5, duration: 0.55, glowRadius: 20 },
      pathCut(WHITE, 8, 0.35),
      crystals(CYAN, 10, [200, 420]),
      crystals(PINK, 10, [200, 420]),
      light(LIGHT, 90, 0.8, 0.4),
      shake(4, 0.3),
    ], 0.6),
  ],
});
