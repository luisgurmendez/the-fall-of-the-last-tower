/**
 * Lume ability VFX: warm white light split into prism colors; rays,
 * crystals and the one pillar of light. Registered when this module is
 * imported (see ./index.ts). The Light Orb is drawn by
 * src/gpu/fx/lightOrb.ts.
 */

import { getAbilityDefinition, LUME_ORB_CONFIG } from '@siege/shared';
import { registerAbilityVFX } from '../VFXRegistryStore';
import { abilityImpactTime } from '@/core/state/abilityTiming';
import {
  embers,
  landsAt,
  light,
  phase,
  pillar,
  rays,
  ring,
  scorch,
  shake,
  shockwave,
  sparks,
  spikes,
  twinkles,
  warning,
} from '../recipes';

const LIGHT = '#fff3b0';
const WARM = '#ffd27a';
const WHITE = '#ffffff';
const SOFT = '#fff9e0';
const CYAN = '#9ff3ff';
const PINK = '#ffb0f0';

const BEACON = landsAt('lume_r');
const BEACON_RADIUS = getAbilityDefinition('lume_r')?.aoeRadius ?? 400;

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

// E: she steps in a streak of light and flashes, dazzling everyone near
registerAbilityVFX({
  abilityId: 'lume_e',
  phases: [
    phase('step', 0, 'caster', [
      { type: 'dash_afterimage', color: LIGHT, imageCount: 5, fadeSpeed: 3.5, duration: 0.25 },
      { type: 'trail', color: LIGHT, thickness: 9, duration: 0.35, fadeLength: 12 },
    ], 0.35),
    phase('dazzle', 0.2, 'caster', [
      rays(WHITE, LUME_ORB_CONFIG.eBlindRadius * 1.2, 0.45, 24, false, 1),
      crystals(CYAN, 6, [120, 240]),
      crystals(PINK, 6, [120, 240]),
      twinkles(WHITE, 8, [80, 200]),
      light(WHITE, LUME_ORB_CONFIG.eBlindRadius, 1.1, 0.35),
      { type: 'screen_flash', color: '#ffffff', duration: 0.08, maxAlpha: 0.1 },
    ], 0.45),
  ],
});

// R: a warning at the orb while light gathers into it, then a beam crashes
// down and crystals burst out of the ground
registerAbilityVFX({
  abilityId: 'lume_r',
  phases: [
    phase('mark', 0, 'target', [
      warning(LIGHT, BEACON_RADIUS, BEACON),
      rays(WHITE, BEACON_RADIUS * 0.7, BEACON, 16, true),
      light(LIGHT, BEACON_RADIUS * 0.6, 0.4, BEACON),
    ], BEACON),
    phase('fall', BEACON - 0.12, 'target', [pillar(WHITE, 520, 30, 0.5, LIGHT)], 0.5),
    phase('impact', BEACON, 'target', [
      spikes('crystal', CYAN, 10, BEACON_RADIUS * 0.6, 'ring', [26, 44], 1.3),
      spikes('crystal', PINK, 8, BEACON_RADIUS * 0.75, 'area', [20, 36], 1.2),
      shockwave(LIGHT, 20, BEACON_RADIUS, 0.5, 14),
      twinkles(WHITE, 20, [80, 240]),
      sparks(LIGHT, 24, [200, 420]),
      scorch(LIGHT, BEACON_RADIUS * 0.6, 2.0, 0.6),
      light(LIGHT, BEACON_RADIUS * 0.8, 1.5, 1.0),
      { type: 'screen_flash', color: '#fffbe0', duration: 0.2, maxAlpha: 0.18 },
      shake(4, 0.3),
    ], 1.3),
    phase('afterglow', BEACON + 0.1, 'target', [embers(SOFT, 26, BEACON_RADIUS, { lifetime: { min: 0.8, max: 1.6 } })], 1.6),
  ],
});
