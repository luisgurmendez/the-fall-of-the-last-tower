/**
 * Ability Registry - Definitions for all champion abilities.
 *
 * This registry contains the static data for all abilities,
 * shared between client and server.
 *
 * Ability definitions are now organized with their champions
 * in the champions/definitions/ folder.
 */

import type { AbilityDefinition } from '../types/abilities';

// Import ability definitions from champion files
import {
  WarriorAbilities,
  WarriorSlash,
  WarriorShield,
  WarriorCharge,
  WarriorUltimate,
  MagnusAbilities,
  MagnusFireball,
  MagnusShield,
  MagnusMudGround,
  MagnusMeteor,
  ElaraAbilities,
  ElaraHeal,
  ElaraBarrier,
  ElaraSpeed,
  ElaraResurrection,
  VexAbilities,
  VexShuriken,
  VexShroud,
  VexDash,
  VexNinjaMode,
  GorathAbilities,
  GorathSlam,
  GorathFortify,
  GorathTaunt,
  GorathEarthquake,
  VileAbilities,
  VileBlackArrows,
  VileVeilOfDarkness,
  VileRootsOfVilix,
  VileRestorationOfVilix,
  LumeAbilities,
  LumeQ,
  LumeW,
  LumeE,
  LumeR,
  UrukAbilities,
  UrukThrust,
  UrukSpearCharge,
  UrukSilverScales,
  UrukFatalStrike,
  OitboilAbilities,
  OitboilSparkSpray,
  OitboilBlueFire,
  OitboilAfterburner,
  OitboilFlamethrower,
  EloraAbilities,
  EloraPoisonArrow,
  EloraPinningArrow,
  EloraDexterity,
  EloraArrowBarrage,
  CaelumAbilities,
  CaelumRayOfLight,
  CaelumEmbolden,
  CaelumWhisperingRoots,
  CaelumMartyr,
  FenrisAbilities,
  FenrisViciousBite,
  FenrisSavageClaw,
  FenrisPounce,
  FenrisBloodthirst,
  CalamitusAbilities,
  CalamitusLavaFlow,
  CalamitusMagmaLandslide,
  CalamitusObsidianSkin,
  CalamitusEruption,
  ProtobotAbilities,
  ProtobotMagnetism,
  ProtobotHypercharge,
  ProtobotRocketPunch,
  ProtobotOverload,
  HopAbilities,
  HopRodentFangs,
  HopCarrotBreak,
  HopBunnyHop,
  HopSavageKick,
} from '../champions/definitions';

// Re-export individual abilities for backward compatibility
export {
  // Warrior
  WarriorSlash,
  WarriorShield,
  WarriorCharge,
  WarriorUltimate,
  // Magnus
  MagnusFireball,
  MagnusShield,
  MagnusMudGround,
  MagnusMeteor,
  // Elara
  ElaraHeal,
  ElaraBarrier,
  ElaraSpeed,
  ElaraResurrection,
  // Vex
  VexShuriken,
  VexShroud,
  VexDash,
  VexNinjaMode,
  // Gorath
  GorathSlam,
  GorathFortify,
  GorathTaunt,
  GorathEarthquake,
  // Vile
  VileBlackArrows,
  VileVeilOfDarkness,
  VileRootsOfVilix,
  VileRestorationOfVilix,
  // Lume
  LumeQ,
  LumeW,
  LumeE,
  LumeR,
  // Urûk
  UrukThrust,
  UrukSpearCharge,
  UrukSilverScales,
  UrukFatalStrike,
  // Oitboil
  OitboilSparkSpray,
  OitboilBlueFire,
  OitboilAfterburner,
  OitboilFlamethrower,
  // Elora
  EloraPoisonArrow,
  EloraPinningArrow,
  EloraDexterity,
  EloraArrowBarrage,
  // Caelum
  CaelumRayOfLight,
  CaelumEmbolden,
  CaelumWhisperingRoots,
  CaelumMartyr,
  // Fenris
  FenrisViciousBite,
  FenrisSavageClaw,
  FenrisPounce,
  FenrisBloodthirst,
  // Calamitus
  CalamitusLavaFlow,
  CalamitusMagmaLandslide,
  CalamitusObsidianSkin,
  CalamitusEruption,
  // Protobot 45
  ProtobotMagnetism,
  ProtobotHypercharge,
  ProtobotRocketPunch,
  ProtobotOverload,
  // Hop-To-Eat
  HopRodentFangs,
  HopCarrotBreak,
  HopBunnyHop,
  HopSavageKick,
};

// =============================================================================
// Registry
// =============================================================================

/**
 * All ability definitions.
 */
export const ABILITY_DEFINITIONS: Record<string, AbilityDefinition> = {
  ...WarriorAbilities,
  ...MagnusAbilities,
  ...ElaraAbilities,
  ...VexAbilities,
  ...GorathAbilities,
  ...VileAbilities,
  ...LumeAbilities,
  ...UrukAbilities,
  ...OitboilAbilities,
  ...EloraAbilities,
  ...CaelumAbilities,
  ...FenrisAbilities,
  ...CalamitusAbilities,
  ...ProtobotAbilities,
  ...HopAbilities,
};

/**
 * Get an ability definition by ID.
 */
export function getAbilityDefinition(id: string): AbilityDefinition | undefined {
  return ABILITY_DEFINITIONS[id];
}

/**
 * Get all ability IDs.
 */
export function getAllAbilityIds(): string[] {
  return Object.keys(ABILITY_DEFINITIONS);
}

/**
 * Get ability definitions for a champion.
 */
export function getChampionAbilities(championId: string): AbilityDefinition[] {
  const prefix = `${championId}_`;
  return Object.values(ABILITY_DEFINITIONS).filter(
    (ability) => ability.id.startsWith(prefix)
  );
}
