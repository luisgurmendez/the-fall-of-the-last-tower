/**
 * Generates the shop's item icons with PixelLab (https://api.pixellab.ai/v2).
 *
 * Each item gets a 32x32 pixel art icon with a transparent background, saved
 * as public/assets/items/<itemId>.png. The prompts describe what the icon shows,
 * not the item's name, so the art stays our own.
 *
 * Usage (from the repo root; Bun loads PIXELLAB_API_KEY from .env.local):
 *   bun scripts/generate-item-icons.ts                      # every item
 *   bun scripts/generate-item-icons.ts --only dagger,sheen  # some items
 *   bun scripts/generate-item-icons.ts --variants 3 --out /tmp/review
 *     # 3 seeds per item (from its kept seed up), saved as <itemId>.<seed>.png
 *     # to pick from; put the seed you keep in ITEM_ICONS
 *
 * Each image costs about $0.007 and takes about 30 seconds.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generatePixenImage, runPool } from './lib/pixellab';

const STYLE = 'fantasy RPG inventory item icon, centered, clean readable silhouette';

/** What each item's icon shows, and the seed of the version we kept */
export const ITEM_ICONS: Record<string, { prompt: string; seed: number }> = {
  notched_blade: { seed: 7, prompt: 'a short steel sword with a notched chipped blade and a leather-wrapped grip, diagonal' },
  ember_shard: { seed: 8, prompt: 'a glowing orange ember crystal shard with small sparks' },
  quickdraw_gloves: { seed: 7, prompt: 'a pair of brown leather archer gloves with metal studs' },
  padded_vest: { seed: 8, prompt: 'a simple quilted padded cloth vest, beige' },
  warding_charm: { seed: 8, prompt: 'a round silver amulet with a glowing blue protective rune' },
  heartstone: { seed: 7, prompt: 'a red heart-shaped gemstone glowing softly' },
  focus_rune: { seed: 8, prompt: 'a flat grey runestone with a glowing teal spiral rune' },
  wanderers_boots: { seed: 8, prompt: 'a pair of worn brown leather travel boots' },
  siege_cleaver: { seed: 8, prompt: 'a heavy broad steel cleaver blade with an iron-banded handle, diagonal' },
  cinder_rod: { seed: 8, prompt: 'a short charred wooden rod topped with a burning ember, diagonal' },
  repeater_crossbow: { seed: 8, prompt: 'a compact wooden crossbow with a bolt magazine on top, diagonal' },
  iron_plate: { seed: 8, prompt: 'an iron breastplate with rivets' },
  spellward_cloak: { seed: 8, prompt: 'an empty folded deep blue cloak with glowing silver runes on the hem, no person' },
  bulwark_belt: { seed: 7, prompt: 'a thick wide leather belt with iron plates and a big buckle' },
  crimson_fang: { seed: 8, prompt: 'a curved crimson sword shaped like a fang, dripping red, diagonal' },
  starfall_diadem: { seed: 7, prompt: 'a golden diadem crown set with a glowing star-shaped gem, sparkles' },
  spiked_bastion: { seed: 7, prompt: 'a heavy dark iron breastplate covered in sharp spikes' },
  ironheart_talisman: { seed: 8, prompt: 'an iron talisman pendant with a glowing red heart gem in the center' },
  forager_blade: { seed: 7, prompt: 'a small hunting knife with a bone handle and a leaf-shaped blade, diagonal' },
  kindling_wand: { seed: 7, prompt: 'a short twig wand with a tiny flame flickering at its tip, diagonal' },
  oakbark_buckler: { seed: 7, prompt: 'a small round wooden shield made of oak bark with a mossy rim' },
  seedling_sickle: { seed: 7, prompt: 'a small curved sickle with a green sprout growing from its wooden handle, diagonal' },
  pilgrim_lantern: { seed: 7, prompt: 'a small brass lantern with a warm golden flame inside and a ribbon on the handle' },
  healing_draught: { seed: 7, prompt: 'a small round glass bottle filled with glowing red potion and a cork stopper' },
  wayfarer_flask: { seed: 7, prompt: 'a leather-wrapped travel flask with a green glowing liquid and a strap' },
  ironbark_elixir: { seed: 7, prompt: 'a tall glass vial filled with brown bark-colored liquid with a tiny leaf floating, cork stopper' },
  stormfury_elixir: { seed: 7, prompt: 'a tall glass vial with swirling crimson and violet liquid crackling with small lightning, cork stopper' },
  gleaming_lens: { seed: 7, prompt: 'a round polished glass lens in a thin brass rim, glinting with a star sparkle' },
  mossweave_band: { seed: 7, prompt: 'a woven bracelet of green moss and vines with tiny white flowers' },
  mana_pearl: { seed: 7, prompt: 'a large luminous blue pearl glowing softly' },
  glowcap_spores: { seed: 7, prompt: 'a small cluster of glowing teal mushrooms with floating spores' },
  swiftstride_greaves: { seed: 7, prompt: 'a pair of light leather boots with small white feather wings at the ankles' },
  ironshod_boots: { seed: 7, prompt: 'a pair of heavy iron-plated boots with riveted toe caps' },
  mystic_treads: { seed: 7, prompt: 'a pair of deep purple cloth boots with glowing silver rune stitching' },
  fleetfoot_spurs: { seed: 7, prompt: 'a pair of tan riding boots with shiny golden spurs' },
  spellwalker_sandals: { seed: 7, prompt: 'a pair of blue sandals with glowing violet magic gems on the straps' },
  dreamwalker_slippers: { seed: 7, prompt: 'a pair of soft midnight blue slippers with tiny crescent moons and stars' },
  duskhook_dagger: { seed: 7, prompt: 'a dark curved hooked dagger with a purple tinted blade, diagonal' },
  huntsmans_edge: { seed: 7, prompt: 'a long hunting knife with an antler handle and a green gem in the pommel, diagonal' },
  leechfang: { seed: 7, prompt: 'a short dagger with a red serrated blade dripping a drop of blood, diagonal' },
  bramblehook: { seed: 7, prompt: 'a short sword wrapped in thorny brambles along the blade, diagonal' },
  skirmishers_hatchet: { seed: 7, prompt: 'a small throwing hatchet with a red wrapped handle, diagonal' },
  hawkeye_scope: { seed: 7, prompt: 'a brass spyglass scope with a glowing amber lens' },
  lunar_prism: { seed: 7, prompt: 'a pale blue crystal prism with a crescent moon glowing inside' },
  voidglass_shard: { seed: 7, prompt: 'a jagged black glass shard glowing with violet light' },
  witherquill: { seed: 7, prompt: 'a black feather quill pen with a withered tip dripping dark green ink, diagonal' },
  tide_pearl: { seed: 7, prompt: 'a blue pearl set in a seashell with water swirling around it' },
  sandglass_bracer: { seed: 7, prompt: 'a bronze arm bracer with a small hourglass set in the middle' },
  bramble_vest: { seed: 7, prompt: 'a leather vest covered in thorny bramble vines' },
  unchained_sash: { seed: 7, prompt: 'a pale blue silk sash with a broken silver chain link' },
  ember_mantle: { seed: 7, prompt: 'an empty folded red cloak with glowing ember sparks on the edges, no person' },
  bloodroot_sigil: { seed: 7, prompt: 'a wooden disc carved with a red glowing root symbol' },
  moonpetal_charm: { seed: 7, prompt: 'a silver charm shaped like a pale glowing flower petal on a thin chain' },
  nightglass_edge: { seed: 7, prompt: 'a slender black glass sword with a cold violet glowing edge, diagonal' },
  shadowstep_cloak: { seed: 7, prompt: 'an empty folded dark hooded cloak trailing wisps of purple shadow, no person' },
  sundering_axe: { seed: 7, prompt: 'a large double-bladed battle axe with cracked dark steel and red runes, diagonal' },
  mountain_maul: { seed: 7, prompt: 'a huge stone-headed war hammer with a granite block head, diagonal' },
  siegebreaker_hammer: { seed: 7, prompt: 'a heavy iron siege hammer with a spiked head and orange glowing cracks, diagonal' },
  wolfsbane_fang: { seed: 7, prompt: 'a jagged sword shaped like a wolf fang with a dark red glow and fur on the hilt, diagonal' },
  kingsglass_bow: { seed: 7, prompt: 'an ornate golden longbow with a crystal set in the grip, vertical' },
  stormstring: { seed: 7, prompt: 'a sleek blue bow with a crackling lightning bowstring, vertical' },
  wyrmslayer_arbalest: { seed: 7, prompt: 'a large heavy crossbow decorated with a dragon skull, diagonal' },
  vipers_kiss: { seed: 7, prompt: 'a small green crossbow shaped like a snake with dripping venom bolts, diagonal' },
  thunder_repeater: { seed: 7, prompt: 'a repeating crossbow with three bolts loaded and sparking lightning, diagonal' },
  freeblade_scimitar: { seed: 7, prompt: 'a curved silver scimitar with a broken chain hanging from the hilt, diagonal' },
  emberheart_codex: { seed: 7, prompt: 'a thick spellbook with a glowing ember heart on its cover and small flames' },
  frostwyrm_scepter: { seed: 7, prompt: 'an icy blue scepter topped with a frozen dragon head, diagonal' },
  archmage_crown: { seed: 7, prompt: 'a tall ornate purple and gold wizard crown with glowing gems' },
  voidpierce_staff: { seed: 7, prompt: 'a long black staff topped with a sharp violet void crystal spike, diagonal' },
  witherbloom_orb: { seed: 7, prompt: 'a dark green orb with a withered black flower glowing inside' },
  hourglass_of_stillness: { seed: 7, prompt: 'a golden hourglass with glowing sand frozen in the middle' },
  soulbinder_tome: { seed: 7, prompt: 'a dark leather tome bound with chains and glowing blue souls swirling' },
  tempest_codex: { seed: 7, prompt: 'an open spellbook with a small swirling storm cloud and lightning above the pages' },
  stormwing_sigil: { seed: 7, prompt: 'a silver sigil shaped like spread bird wings with a blue wind swirl' },
  magmaheart_aegis: { seed: 7, prompt: 'a heavy round shield with a molten lava core glowing in the center' },
  frostguard_plate: { seed: 7, prompt: 'an icy blue breastplate with frost crystals on the shoulders' },
  stormward_veil: { seed: 7, prompt: 'an empty shimmering violet cloak with a glowing protective rune, no person' },
  grovekeepers_bark: { seed: 7, prompt: 'a breastplate made of living tree bark with green leaves sprouting' },
  wardens_standard: { seed: 7, prompt: 'a small war banner on a pole with a golden shield emblem, vertical' },
  mountainheart: { seed: 7, prompt: 'a large grey stone heart with a glowing amber crystal vein' },
  dawnsong_censer: { seed: 7, prompt: 'a golden incense censer on a chain glowing with warm sunrise light' },
  tidemother_chalice: { seed: 7, prompt: 'a silver chalice overflowing with glowing blue water' },
  shepherds_crook: { seed: 7, prompt: 'a wooden shepherd crook staff wrapped in green vines with a white flower, vertical' },
};

interface Options {
  only: string[] | null;
  variants: number;
  outDir: string;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { only: null, variants: 1, outDir: 'public/assets/items' };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i + 1];
    if (argv[i] === '--only') { options.only = value.split(','); i++; }
    else if (argv[i] === '--variants') { options.variants = Number(value); i++; }
    else if (argv[i] === '--out') { options.outDir = value; i++; }
  }
  return options;
}

async function main(): Promise<void> {
  const apiKey = process.env.PIXELLAB_API_KEY;
  if (!apiKey) throw new Error('Set PIXELLAB_API_KEY (for example in .env.local)');
  const options = parseArgs(process.argv.slice(2));
  const itemIds = options.only ?? Object.keys(ITEM_ICONS);
  mkdirSync(options.outDir, { recursive: true });

  const jobs = itemIds.flatMap(itemId => {
    const icon = ITEM_ICONS[itemId];
    if (!icon) throw new Error(`No prompt for item "${itemId}"`);
    return Array.from({ length: options.variants }, (_, i) => ({ itemId, prompt: icon.prompt, seed: icon.seed + i }));
  });

  let spent = 0;
  await runPool(jobs, async job => {
    try {
      const { png, usd } = await generatePixenImage(apiKey, { description: `${STYLE}: ${job.prompt}`, size: 32, seed: job.seed });
      const name = options.variants > 1 ? `${job.itemId}.${job.seed}.png` : `${job.itemId}.png`;
      writeFileSync(join(options.outDir, name), png);
      spent += usd;
      console.log(`ok   ${name}`);
    } catch (error) {
      console.error(`fail ${job.itemId} (seed ${job.seed}): ${(error as Error).message}`);
    }
  });
  console.log(`${jobs.length} images, $${spent.toFixed(3)}`);
}

await main();
