/**
 * When and where abilities sound (soundCatalog.ts), timed like their VFX
 * (src/vfx/champions/). An ability with no cues here plays the sound with
 * its own id, if the catalog has one, at the caster as it's cast. A
 * projectile that bursts plays `<abilityId>_impact` where it does, if the
 * catalog has one (gameSounds.ts).
 */

import { getAbilityDefinition } from "@siege/shared";
import type { SoundKey } from "./soundCatalog";

export interface AbilityCue {
  sound: SoundKey;
  /** Seconds after the cast (default 0) */
  delay?: number;
  /** At the caster (default), or where it's aimed (or the unit it's cast on) */
  at?: "caster" | "target";
}

/** Seconds from the cast until the ability's area lands on the server (its aoeDelay) */
function landsAt(abilityId: string): number {
  return getAbilityDefinition(abilityId)?.aoeDelay ?? 0;
}

/** About when a projectile leaves the hand, as the VFX throws it */
const THROW = 0.2;
/** When Kael's blade of light lands on his target (its VFX's strike) */
const HEROIC_STRIKE_LANDS = 0.37;
/** When Lume's orb lands where it was sent (its VFX's arrive) */
const ORB_ARRIVES = 0.2;

export const ABILITY_CUES: Record<string, AbilityCue[]> = {
  warrior_slash: [{ sound: "warrior_slash", delay: landsAt("warrior_slash") }],
  warrior_ultimate: [
    { sound: "warrior_ultimate_leap" },
    { sound: "warrior_ultimate_strike", delay: HEROIC_STRIKE_LANDS, at: "target" },
  ],
  magnus_fireball: [{ sound: "magnus_fireball", delay: THROW }],
  magnus_mud: [{ sound: "magnus_mud", delay: landsAt("magnus_mud"), at: "target" }],
  magnus_meteor: [
    { sound: "magnus_meteor_fall", at: "target" },
    { sound: "magnus_meteor_impact", delay: landsAt("magnus_meteor"), at: "target" },
  ],
  elara_heal: [{ sound: "elara_heal", at: "target" }],
  elara_barrier: [{ sound: "elara_barrier", at: "target" }],
  gorath_slam: [{ sound: "gorath_slam", delay: landsAt("gorath_slam") }],
  gorath_earthquake: [
    { sound: "gorath_earthquake_rumble" },
    { sound: "gorath_earthquake", delay: landsAt("gorath_earthquake") },
  ],
  lume_q: [
    { sound: "lume_q" },
    { sound: "lume_q_arrive", delay: ORB_ARRIVES, at: "target" },
  ],
  lume_r: [
    { sound: "lume_r_charge", at: "target" },
    { sound: "lume_r", delay: landsAt("lume_r"), at: "target" },
  ],
  vex_shuriken: [{ sound: "vex_shuriken", delay: THROW }],
  vile_black_arrows: [{ sound: "vile_black_arrows", delay: THROW }],
  vile_roots_of_vilix: [{ sound: "vile_roots_of_vilix", at: "target" }],
  vile_trap_trigger: [{ sound: "vile_trap_trigger", at: "target" }],
};
