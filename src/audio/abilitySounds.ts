/**
 * When and where abilities sound (soundCatalog.ts), timed like their VFX
 * (src/vfx/champions/): an impact when the ability takes effect
 * (abilityTiming.ts). An ability with no cues here plays the sound with
 * its own id, if the catalog has one, at the caster as it's cast. A
 * projectile that bursts plays `<abilityId>_impact` where it does, if the
 * catalog has one (gameSounds.ts).
 */

import { MOBAConfig, NOCTHAR_KIT } from "@siege/shared";
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
  // Items used (ChampionItemActives) and passives going off (ChampionItemPassives)
  item_draught: [{ sound: "item_potion" }],
  item_flask: [{ sound: "item_potion" }],
  item_ironbark: [{ sound: "item_elixir" }],
  item_stormfury: [{ sound: "item_elixir" }],
  item_unchain: [{ sound: "summoner_purge" }],
  item_stillness: [{ sound: "item_stasis" }],
  item_shadowstep: [{ sound: "summoner_blink", at: "target" }],
  item_gust: [{ sound: "summoner_haste", at: "target" }],
  item_shelter: [{ sound: "summoner_aegis" }],
  item_frost_nova: [{ sound: "item_frost_nova" }],
  item_sanctuary_land: [{ sound: "summoner_mend", at: "target" }],
  item_static: [{ sound: "item_static", at: "target" }],
  item_veil: [{ sound: "item_veil" }],
  // Crawling through a jungle tunnel: in at one mouth, out at the other
  [MOBAConfig.TUNNELS.ABILITY_ID]: [
    { sound: "jungle_tunnel" },
    { sound: "jungle_tunnel", delay: MOBAConfig.TUNNELS.CRAWL_TIME - 0.15, at: "target" },
  ],
  warrior_slash: [{ sound: "warrior_slash", delay: landsAt("warrior_slash") }],
  // Leaps: the blow when the server says it landed (its trip takes as long as it's far)
  warrior_ultimate: [{ sound: "warrior_ultimate_leap" }],
  warrior_ultimate_land: [{ sound: "warrior_ultimate_strike", at: "target" }],
  magnus_fireball: [{ sound: "magnus_fireball", delay: landsAt("magnus_fireball") }],
  magnus_mud: [{ sound: "magnus_mud", delay: landsAt("magnus_mud"), at: "target" }],
  // The beam shooting up from his staff in the cast time
  magnus_meteor_windup: [{ sound: "magnus_meteor_windup" }],
  magnus_meteor: [
    // The whistle (0.7 s) ends as it hits
    { sound: "magnus_meteor_fall", at: "target", delay: Math.max(0, landsAt("magnus_meteor") - 0.7) },
    { sound: "magnus_meteor_impact", delay: landsAt("magnus_meteor"), at: "target" },
  ],
  elara_heal: [{ sound: "elara_heal", at: "target" }],
  elara_barrier: [{ sound: "elara_barrier", at: "target" }],
  // He hoists the hammer in the cast time, it falls when the slam lands
  gorath_slam_windup: [{ sound: "gorath_slam_windup" }],
  gorath_slam: [{ sound: "gorath_slam", delay: landsAt("gorath_slam") }],
  gorath_taunt_windup: [{ sound: "gorath_taunt_windup" }],
  // He draws breath in the cast time, roars when it lands
  gorath_taunt: [{ sound: "gorath_taunt", delay: landsAt("gorath_taunt") }],
  // The ground starts rumbling as he heaves the hammer back (the cast time)
  gorath_earthquake_windup: [{ sound: "gorath_earthquake_rumble" }],
  gorath_earthquake: [{ sound: "gorath_earthquake", delay: landsAt("gorath_earthquake") }],
  lume_q: [{ sound: "lume_q" }],
  lume_q_arrive: [{ sound: "lume_q_arrive", at: "target" }],
  // Warmth pulses from the orb (the cast's point)
  lume_w: [{ sound: "lume_w_gather", at: "target" }, { sound: "lume_w", delay: landsAt("lume_w"), at: "target" }],
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
  uruk_r: [{ sound: "uruk_r_leap" }],
  uruk_r_land: [{ sound: "uruk_r", at: "target" }],
  elora_w: [{ sound: "elora_w", delay: landsAt("elora_w") }],
  elora_r: [
    { sound: "elora_r" },
    { sound: "elora_r_rain", delay: landsAt("elora_r"), at: "target" },
  ],
  // Kip: his practice arrow as it flies; a leap, then his landing when the
  // server says he landed; a twang with each volley of Show Them All
  kip_q: [{ sound: "elora_attack", delay: landsAt("kip_q") }],
  kip_e: [{ sound: "elora_e" }],
  kip_e_land: [{ sound: "kip_e_land" }],
  kip_r_volley: [{ sound: "elora_attack" }],
  // Nocthar: his claws into the dirt, the hands bursting where it cracked; the
  // wail from the breath before it; a growl with every order (to the colossus
  // too); the rumble building through his ultimate's cast (its windup), the
  // eruption when the colossus rises; its bones ripped and thrown, shattering
  // where they land; its stampede after its windup, then the crash
  nocthar_q_burst: [{ sound: "nocthar_q_burst", at: "target" }],
  nocthar_w_windup: [{ sound: "nocthar_w" }],
  nocthar_w: [],
  nocthar_colossus_w: [{ sound: "nocthar_e" }],
  nocthar_colossus_e: [{ sound: "nocthar_e" }],
  nocthar_colossus_r: [{ sound: "nocthar_e" }],
  nocthar_r_windup: [{ sound: "nocthar_r" }],
  nocthar_r: [],
  nocthar_colossus_w_throw: [{ sound: "nocthar_colossus_w" }],
  nocthar_colossus_w_impact: [{ sound: "nocthar_colossus_w_impact", at: "target" }],
  nocthar_colossus_e_trample: [{ sound: "nocthar_colossus_e", delay: NOCTHAR_KIT.colossusEWindup }],
  caelum_q: [{ sound: "caelum_q", delay: landsAt("caelum_q") }],
  caelum_w: [{ sound: "caelum_w", at: "target" }],
  caelum_e: [{ sound: "caelum_e", delay: landsAt("caelum_e"), at: "target" }],
  // The whole pounce, whoosh to thud (about as long as its leap)
  fenris_e: [{ sound: "fenris_e" }],
  // The swipe lands after the claws are drawn back (its windup snarls first: fenris_w_windup)
  fenris_w: [{ sound: "fenris_w", delay: landsAt("fenris_w") }],
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
