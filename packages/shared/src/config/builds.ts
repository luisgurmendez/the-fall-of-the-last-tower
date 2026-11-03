/**
 * Recommended builds: what to buy, in order, by class (and for champions
 * their class doesn't describe). A starter and a potion with the starting
 * gold, boots, then the legendary items, parts on the way. The shop shows the
 * local champion's as its recommended items; bots buy by it (LaneBot).
 */

import type { ChampionClass } from '../types';
import { getItemCatalogEntry } from './items';
import { isItemPartOf } from './itemTrees';

const CLASS_BUILDS: Record<ChampionClass, string[]> = {
  warrior: ['forager_blade', 'healing_draught', 'wanderers_boots', 'leechfang', 'ironshod_boots', 'siege_cleaver',
    'crimson_fang', 'huntsmans_edge', 'sundering_axe', 'mountain_maul', 'spiked_bastion'],
  assassin: ['forager_blade', 'healing_draught', 'wanderers_boots', 'duskhook_dagger', 'nightglass_edge',
    'swiftstride_greaves', 'huntsmans_edge', 'shadowstep_cloak', 'bramblehook', 'wolfsbane_fang'],
  marksman: ['forager_blade', 'healing_draught', 'wanderers_boots', 'gleaming_lens', 'siege_cleaver', 'kingsglass_bow',
    'fleetfoot_spurs', 'hawkeye_scope', 'stormstring', 'wyrmslayer_arbalest', 'freeblade_scimitar'],
  mage: ['kindling_wand', 'healing_draught', 'wanderers_boots', 'ember_shard', 'cinder_rod', 'lunar_prism', 'starfall_diadem',
    'spellwalker_sandals', 'sandglass_bracer', 'hourglass_of_stillness', 'voidpierce_staff', 'archmage_crown'],
  support: ['pilgrim_lantern', 'healing_draught', 'wanderers_boots', 'glowcap_spores', 'moonpetal_charm', 'dawnsong_censer',
    'dreamwalker_slippers', 'tidemother_chalice', 'wardens_standard', 'shepherds_crook'],
  tank: ['oakbark_buckler', 'healing_draught', 'wanderers_boots', 'heartstone', 'ember_mantle', 'mystic_treads',
    'magmaheart_aegis', 'bulwark_belt', 'spiked_bastion', 'stormward_veil', 'frostguard_plate'],
};

/** Champions their class doesn't describe: Zhak'rul fights up close on ability power */
const CHAMPION_BUILDS: Partial<Record<string, string[]>> = {
  zhakrul: ['kindling_wand', 'healing_draught', 'wanderers_boots', 'ember_shard', 'bulwark_belt', 'frostwyrm_scepter',
    'mystic_treads', 'emberheart_codex', 'spiked_bastion', 'stormward_veil'],
};

/** A champion's recommended build: its own, else its class's */
export function recommendedBuild(championId: string, championClass: ChampionClass): string[] {
  return CHAMPION_BUILDS[championId] ?? CLASS_BUILDS[championClass] ?? CLASS_BUILDS.warrior;
}

/** A build with another starter (the jungle's sickle, the support's lantern) */
export function withStarter(build: string[], starter: string): string[] {
  return build.map(itemId => getItemCatalogEntry(itemId)?.tier === 'starter' ? starter : itemId);
}

/** Whether an inventory has an item of a build done: the item, or one built from it */
export function isBuildItemDone(itemId: string, inventory: readonly (string | null | undefined)[]): boolean {
  return inventory.some(owned => !!owned && (owned === itemId || isItemPartOf(itemId, owned)));
}
