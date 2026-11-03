# Items and Shop

Items are bought at the fountain, in the shop (P). The server validates every purchase.

## Catalog

`packages/shared/src/config/items.ts` holds `ITEM_CATALOG`: the 83 items the shop sells,
with their category, tier, group, cost, sell value, stats, passives and active. Server and
client read the same catalog:

- **Server:** `packages/server/src/data/items.ts` (`getServerItemById`, `calculateItemStats`).
  `ChampionInventory` buys and sells; `ChampionStats` adds item stats to the champion's;
  `ChampionItemPassives` runs the passives and `ChampionItemActives` the actives.
- **Client:** `src/data/items.ts` turns catalog entries into `ItemDefinition`s for the
  shop (`SHOP_ITEMS`), the HUD's item slots and tooltips (`getItemDefinition`), and passive
  text (`getItemPassive`); `src/data/itemStats.ts` names and formats every item stat and
  describes actives and consumables, for the shop and the HUD alike.

To add an item, add it to `ITEM_CATALOG` (the `item()` and `passive()` helpers fill the
defaults) and give it an icon (below).

### Design

The items are built around counters, so a build answers the enemy's:

| Strategy | Items that do it | Items that answer it |
|----------|------------------|----------------------|
| Sustain: lifesteal, omnivamp, heals | Crimson Fang, Wolfsbane Fang, Bloodroot Sigil, the support items | Wounds: Bramblehook, Witherquill, Witherbloom Orb, Bramble Vest, Spiked Bastion |
| Burst and executes | Nightglass Edge, Shadowstep Cloak, Crown of the Archmage | Hourglass of Stillness, Stormward Veil, Ironheart Talisman (lifelines) |
| Stacking health and armor | Mountainheart, Magmaheart Aegis, Frostguard Plate | Sundering Axe, Giantslayer, Viper's Kiss, Emberheart Codex, Voidpierce Staff, lethality |
| Kiting | Stormstring, Fleetfoot Spurs, Frostwyrm Scepter | Shadowstep, Gust, Swiftstride Greaves, tenacity |
| Crowd control | The champions' kits, Frost Nova | Unchain (Unchained Sash, Freeblade Scimitar), Mystic Treads, Ironbark Elixir |
| Crits | Kingsglass Bow, Stormstring, Wyrmslayer Arbalest | Frostguard Plate (Chill Shell), Ironshod Boots |
| Basic attacks | Marksmen, on-hit items | Bramble Vest and Spiked Bastion (thorns), Bark, Hobnails |
| Grouping and split pushing | Warden's Standard, the support items | Siegebreaker Hammer (Lone Wolf, Demolish) |

### Tiers

| Tier | What | Examples |
|------|------|----------|
| `starter` | One at a time (group `starter`); with a potion they're the 300 starting gold | Forager's Blade (AD), Kindling Wand (AP), Oakbark Buckler (tank), Seedling Sickle (jungle), Pilgrim's Lantern (support) |
| `consumable` | Used with the item's key; sell for 40% | Healing Draught (stacks to 5), Wayfarer's Flask (2 charges, refills at the fountain), Ironbark and Stormfury elixirs (3 minutes, last through death, one at a time) |
| `basic` | Parts | Notched Blade, Ember Shard, Gleaming Lens (crit), Mossweave Band (regen), Mana Pearl, Glowcap Spores (heal and shield power)... |
| `boots` | One pair (group `boots`), upgraded in place from Wanderer's Boots | Swiftstride Greaves, Ironshod Boots, Mystic Treads (tenacity), Fleetfoot Spurs, Spellwalker Sandals (magic pen), Dreamwalker Slippers (haste) |
| `epic` | Built from parts, built into legendaries | Duskhook Dagger (lethality), Bramblehook (Wounds), Hawkeye Scope, Voidglass Shard, Ember Mantle (immolate), Unchained Sash (active)... |
| `legendary` | Finished, one of each (`isUnique`) | 34, by role: fighters and assassins, marksmen, mages, tanks, supports |

Low-health shields are a group too (`lifeline`: Ironheart Talisman).

### Stats

Besides the champion stats (`attackSpeed` is a bonus share, added up across items before
it applies; `health` and `resource` raise the maximums), items give `ItemCombatStats`
(`packages/shared/src/types/champions.ts`), 0 on a champion without them:

| Stat | What |
|------|------|
| `lethality`, `armorPenPercent` | Armor the champion's physical damage ignores (percent first) |
| `magicPen`, `magicPenPercent` | The same for magic resist |
| `critChance`, `critDamage` | Basic attacks crit (`ChampionBasicAttacks`): damage times crit damage (2.0 base); DAMAGE events carry `crit`, and the number pops bigger with a "!" |
| `lifesteal` | Share of basic attack damage dealt that heals |
| `omnivamp` | Share of all damage dealt that heals (a third against minions and monsters) |
| `healShieldPower` | Heals and shields it gives allies are stronger |
| `tenacity` | Crowd control and slows from enemies are shorter (not displacements); several sources combine as 1 - product |

Some passives scale stats in `ChampionStats`: Overflow (ability power from max mana),
Majesty (+30% ability power), stacking items (their stacks times a stat).

### Build trees

An item can list the items it is built from (`buildsFrom`; a part can appear twice).
Its `cost` is the full price. Buying it uses up the parts already in the inventory and
takes their cost off the price, so the player pays for the missing parts plus the
combine cost. A part that isn't owned is looked for inside its own parts, all the way
down. Used-up parts free their slots, so a full inventory can still build an item from
a part it holds.

`packages/shared/src/config/itemTrees.ts` does this for both sides:

- `planItemPurchase(itemId, inventory)`: the price, the slots used up and the tree with
  the owned parts marked. The server charges with it (`ChampionInventory.buy`); the shop
  shows the same price.
- `purchaseBlockReason(itemId, inventory)`: why it can't be bought besides gold and room
  (a unique item owned, another item of its group the purchase doesn't use up, a full
  stack or a second flask); `consumableStackSlot`: the stack a potion joins.
- `getItemTree`, `getItemBuildsInto`, `getItemCombineCost`, `isItemPartOf`.

`packages/shared/src/test/itemTrees.test.ts` checks that every part exists, no item is
in its own tree, no item costs less than its parts, legendaries are built from parts,
boots are grouped, and the purchase rules.

## Passives

Each passive has a name and a `description` for the shop and tooltips, and an
`effectType` with `effectData` that `ChampionItemPassives`
(`packages/server/src/simulation/champion/`) applies. Passives with the same `stackKey`
(default: their id) apply once however many items carry them: the one on the most
expensive item wins (Smolder and Magma share `immolate`).

The champion reports to it:

| Hook | Called from | Passives |
|------|-------------|----------|
| `onBasicAttackHit` | Melee hits and basic attack projectiles | on-hit damage, Opening Cut, Avalanche, Venom, Triple Volley, Starfall, Static, Hymn's on-hit, Momentum, Harvest's slow, lifesteal and Overfed |
| `onDamageDealt` | `ServerEntity` / `ServerChampion.takeDamage`, with the source's damage kind | omnivamp and Bloodlust, Harvest's heal, Wounds, Sunder, Tithe, ability burns (Kindle, Smoldering Pages), Rime |
| `amplifyDamage` | Before resistances | Execution, Giantslayer, Demolish (basic attacks on structures), Harvest (monsters) |
| `reduceIncomingDamage` | The receiving champion, before resistances | Veil (blocks an enemy champion's ability), Bark, Hobnails, Chill Shell |
| `onHitByBasicAttack` | Every basic attack that lands on it | thorns (Prickle, Barbs) and their Wounds |
| `onAllyHealedOrShielded` | `ServerChampion.heal` and `grantShield` from an allied champion | Hymn, Renewal |
| `onTakedown`, `onKill`, `onDeath` | Kills, assists, monster kills, its death | Hoard, Bedrock, Harvest's growth |
| `update` | Every tick | burns, Smolder and Magma (only while in combat, so walking past a camp doesn't pull it), Rally, Lone Wolf, Wanderlust, Veil's marker, Static's charge from walking, Tithe's charges |

**Damage kinds.** `ServerChampion.damageKind` says what the damage it's dealing is: its
basic attacks set `basic` (`withDamageKind`; a basic attack projectile carries
`basicAttack`), damage from its items `item`, and everything else (abilities, their damage
over time, summoner spells) is `ability`. Item damage doesn't set off passives meant for
attacks and abilities, so items don't trigger each other in loops.

**Heals and shields.** `ServerChampion.heal` raises an ally's heal by the healer's heal and
shield power and Verdant, and cuts it by the strongest healing reduction (Wounds 40%,
Scorch 40%). Every shield goes through `ServerChampion.grantShield(amount, duration,
styleId, context, giver)` the same way.

**Assists.** A champion remembers the enemy champions that hurt it in the last 10
seconds; when it dies, those other than the killer get an assist, a share of half the
kill gold, and their items' takedown.

Markers show a passive's state on the champion (data/effects.ts, with names in
`src/data/effectDisplayInfo.ts` and icons in `statusIndicators.ts`): `item_starfall`,
`item_hold_the_line`, `item_static`, `item_veil`, `item_hymn`, `item_rally`,
`item_lone_wolf`, `item_wanderlust`, `item_momentum`; on enemies `wounds`, `item_burn`,
`item_sunder`, `slow_25`. Tests: `ItemPassives.test.ts`, `ItemMechanics.test.ts`.

## Actives and consumables

An item with an `active` is used with its slot's key: **1, 2, 3** (top row) and **6, 7, 8**
(bottom row), since 4 and 5 place wards (`src/core/input/itemKeys.ts`). The client sends
`InputType.USE_ITEM { slot, targetX, targetY }` with the cursor's world position;
`ChampionItemActives.use` checks it and does it:

| Effect | Items |
|--------|-------|
| `potion` | Healing Draught (120 health over 12 s; another adds 12 s), Wayfarer's Flask (health and mana) |
| `elixir` | Ironbark, Stormfury: 3 minutes, one elixir at a time |
| `cleanse` | Unchain (Unchained Sash, Freeblade Scimitar): removes crowd control and slows; usable while stunned |
| `stasis` | Stillness (Hourglass of Stillness): invulnerable and frozen 2.5 s (crowd control type `stasis`) |
| `dash` | Shadowstep (blink 200), Gust (dash 200 and hit where it lands); not while rooted or grounded |
| `shield_allies` | Shelter (Warden's Standard) |
| `frost_nova` | Frost Nova (Frostguard Plate): slows enemies around 55% for 2 s |
| `heal_area` | Sanctuary (Shepherd's Crook): heals allies at a point after 1.5 s, hurts enemies there |

Actives with the same id share a cooldown. It's kept on each item as the game time it's
ready (`EquippedItemState.readyAt`), so the inventory only changes when an active is used;
the HUD shades the slot with the seconds left. A consumable's uses are its `charges`: a
stack of potions lives in one slot, and is gone when drunk up; a flask refills at the
fountain. A stacking item's `stacks` show on its slot too.

Each use is an `ABILITY_CAST` event `item_<active id>` at the target point; Static's
discharge (`item_static`), Veil blocking (`item_veil`) and Sanctuary landing
(`item_sanctuary_land`) send one too. Their VFX are in `src/vfx/items.ts` and their sounds
in `src/audio/abilitySounds.ts` (new ones `item_potion`, `item_elixir`, `item_stasis`,
`item_frost_nova`, `item_static`, `item_veil`; the rest reuse summoner spells' sounds).

## Bots

Bots (`LaneBot`) buy their champion's recommended build (`recommendedBuild` in
`packages/shared/src/config/builds.ts`: by class, or by champion when the class doesn't fit;
the shop shows the same build) in order: a starter and a potion, boots,
then each item, buying one of its missing parts when gold doesn't cover it yet (so a later
item doesn't use up the parts it's saving). A jungle bot starts with the Seedling Sickle and
a support bot with the Pilgrim's Lantern (`getBuild`). With no room for the next item they
sell the starter (then a potion); they don't buy starters again once they own a legendary.
`bots/itemTactics.ts` decides when they use items: a potion under 55% health, an elixir
right away, Stillness about to die with an enemy near, Unchain when stunned or rooted, and
Frost Nova, Shelter, Sanctuary and dashes in a fight.

## Shop UI

`src/ui/shop/ShopUI.ts` drives the shop overlay in `index.html` (styles in `shop.css`):
category tabs (All, Start, AD, AS/Crit, AP, Armor, MR, Health, Boots, Support; a tab can
show several categories, `TAB_CATEGORIES`), the item grid by tier then price (the All tab
heads each tier), the details panel and the six inventory slots. Each item shows at its
price for the current inventory, in green when parts lower it, dimmed when it can't be
bought (a second pair of boots...: the details say why). The details panel shows the
item's build tree with owned parts outlined in green, its stats, active and passives, and
what it builds into (`src/ui/shop/itemTree.ts`); clicking an item there selects it. Items
that suit the local champion's class have a star (`isRecommendedFor` in `src/data/items.ts`).
The All tab starts with the champion's recommended build in order (`ShopUI.markBuild`): what
the inventory has done (the item, or one built from it; the starter and potion once past the
start) is checked off, and the next item to get is outlined as NEXT. Closing the shop keeps
the item picked in the list and where the list was scrolled.
Buying keeps the shop open; gold, inventory, affordability and the buttons refresh from
each server state update (`updateOnlineState`). Buying and selling only work at the
fountain. Beside the inventory, the control ward button buys a control ward (75 gold) to
carry, up to 2, outside the six slots (see [map.md](map.md), Wards). A right-click moves
the champion with the shop open: around it (clicks there reach the game) and on it too
(`InputManager.forwardMouseEvent`), except on an item, which a right-click buys. A left-click
around it closes it (so do Escape, P and its X).

## Icons

Each item's icon is 32x32 pixel art at `public/assets/items/<itemId>.png` (like the
other art in `public/`, it isn't in git; regenerate it with the script below).
`src/ui/itemIcons.ts` loads it for the shop (`createItemIconElement`) and draws it on the
HUD canvas (`drawItemIcon`), at whole multiples of 32 so pixels stay square: 64 px in the
shop grid and details, 32 px in the inventory and HUD slots. An item without art shows
its category's symbol.

The icons are made with [PixelLab](https://api.pixellab.ai/v2/llms.txt) by
`scripts/generate-item-icons.ts`. `ITEM_ICONS` there holds each icon's prompt (what it
shows, not the item's name) and the seed of the version kept. The script needs
`PIXELLAB_API_KEY`, which Bun reads from `.env.local` (git-ignored):

```bash
bun scripts/generate-item-icons.ts --only dagger            # regenerate one icon
bun scripts/generate-item-icons.ts --only dagger --variants 3 --out /tmp/review
# 3 seeds to choose from; copy the one you like and put its seed in ITEM_ICONS
```

Each image costs about $0.007 and takes about 30 seconds; PixelLab allows a few jobs at a time.
