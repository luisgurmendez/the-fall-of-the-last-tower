/**
 * When and where abilities sound (soundCatalog.ts), timed like their VFX
 * (src/vfx/champions/): an impact when the ability takes effect
 * (abilityTiming.ts). An ability with no cues here plays the sound with
 * its own id, if the catalog has one, at the caster as it's cast. A
 * projectile that bursts plays `<abilityId>_impact` where it does, if the
 * catalog has one (gameSounds.ts).
 */

import { MOBAConfig } from "@siege/shared";
import { abilityImpactTime } from "@/core/state/abilityTiming";
import type { SoundKey } from "./soundCatalog";

export interface AbilityCue {
  sound: SoundKey;
  /** Seconds after the cast (default 0) */
  delay?: number;
  /** At the caster (default), or where it's aimed (or the unit it's cast on) */
  at?: "caster" | "target";
}

/** Seconds from the cast until the ability takes effect (an area landing, a projectile thrown...) */
const landsAt = abilityImpactTime;

/** Seconds a jungle monster's special attack winds up before it lands */
function windup(creatureType: keyof typeof MOBAConfig.JUNGLE.SPECIAL_ATTACKS): number {
  return MOBAConfig.JUNGLE.SPECIAL_ATTACKS[creatureType].windup;
}


export const ABILITY_CUES: Record<string, AbilityCue[]> = {
  warrior_slash: [{ sound: "warrior_slash", delay: landsAt("warrior_slash") }],
  warrior_ultimate: [
    { sound: "warrior_ultimate_leap" },
    { sound: "warrior_ultimate_strike", delay: landsAt("warrior_ultimate"), at: "target" },
  ],
  magnus_fireball: [{ sound: "magnus_fireball", delay: landsAt("magnus_fireball") }],
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
    { sound: "lume_q_arrive", delay: landsAt("lume_q"), at: "target" },
  ],
  // Eclipse fires from the orb by her: heard there, not at the beam's far end
  lume_r: [
    { sound: "lume_r_charge" },
    { sound: "lume_r", delay: landsAt("lume_r") },
  ],
  vex_shuriken: [{ sound: "vex_shuriken", delay: landsAt("vex_shuriken") }],
  vile_black_arrows: [{ sound: "vile_black_arrows", delay: landsAt("vile_black_arrows") }],
  vile_roots_of_vilix: [{ sound: "vile_roots_of_vilix", at: "target" }],
  vile_trap_trigger: [{ sound: "vile_trap_trigger", at: "target" }],
  uruk_q: [{ sound: "uruk_q", delay: landsAt("uruk_q") }],
  uruk_r: [
    { sound: "uruk_r_leap" },
    { sound: "uruk_r", delay: landsAt("uruk_r"), at: "target" },
  ],
  elora_w: [{ sound: "elora_w", delay: landsAt("elora_w") }],
  elora_r: [
    { sound: "elora_r" },
    { sound: "elora_r_rain", delay: landsAt("elora_r"), at: "target" },
  ],
  caelum_q: [{ sound: "caelum_q", delay: landsAt("caelum_q") }],
  caelum_w: [{ sound: "caelum_w", at: "target" }],
  caelum_e: [{ sound: "caelum_e", delay: landsAt("caelum_e"), at: "target" }],
  fenris_e: [{ sound: "fenris_e" }],
  calamitus_r: [
    { sound: "calamitus_r_rumble" },
    { sound: "calamitus_r", delay: landsAt("calamitus_r") },
  ],
  protobot_e: [{ sound: "protobot_e", at: "target" }],
  hop_r_crash: [{ sound: "hop_r_crash", at: "target" }],
  zhakrul_q: [{ sound: "zhakrul_q", delay: landsAt("zhakrul_q") }],
  zhakrul_r: [{ sound: "zhakrul_r", at: "target" }],
  // Jungle monsters' special attacks: a wind-up, then the hit (cut short if the monster dies first)
  jungle_slam_blue: [{ sound: "jungle_slam_blue_windup" }, { sound: "jungle_slam_blue", delay: windup("blue_buff") }],
  jungle_slam_red: [{ sound: "jungle_slam_red_windup" }, { sound: "jungle_slam_red", delay: windup("red_buff") }],
  dragon_breath: [{ sound: "dragon_breath_windup" }, { sound: "dragon_breath", delay: windup("dragon") }],
  rootwyrm_eruption: [{ sound: "rootwyrm_eruption_windup" }, { sound: "rootwyrm_eruption", delay: windup("rootwyrm") }],
};
