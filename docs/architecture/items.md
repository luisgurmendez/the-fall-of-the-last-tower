# Items and Shop

Items are bought at the fountain, in the shop (P). The server validates every purchase.

## Catalog

`packages/shared/src/config/items.ts` holds `ITEM_CATALOG`: the 18 items the shop sells,
with their category, cost, sell value, stats and passives. Server and client read the
same catalog:

- **Server:** `packages/server/src/data/items.ts` (`getServerItemById`, `calculateItemStats`).
  `ChampionInventory` buys and sells; `ChampionStats` adds item stats to the champion's.
- **Client:** `src/data/items.ts` turns catalog entries into `ItemDefinition`s for the
  shop (`SHOP_ITEMS`), the HUD's item slots and tooltips (`getItemDefinition`), and passive
  text (`getItemPassive`).

To add an item, add it to `ITEM_CATALOG` and give it an icon (below).

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
- `getItemTree`, `getItemBuildsInto`, `getItemCombineCost`, `isItemPartOf`.

Our own items, three tiers (costs in gold; combine cost in parentheses):

| Item | Stats | Built from | Cost |
|------|-------|------------|------|
| Notched Blade | +10 attack damage | | 350 |
| Ember Shard | +20 ability power | | 435 |
| Quickdraw Gloves | +12% attack speed | | 300 |
| Padded Vest | +15 armor | | 300 |
| Warding Charm | +25 magic resist | | 450 |
| Heartstone | +150 health | | 400 |
| Focus Rune | +10 ability haste | | 400 |
| Wanderer's Boots | +6 movement speed (about 10%) | | 300 |
| Siege Cleaver | +35 attack damage | 2 Notched Blades | 1200 (500) |
| Cinder Rod | +50 ability power | 2 Ember Shards | 1100 (230) |
| Repeater Crossbow | +25% attack speed, Barbed Bolts | 2 Quickdraw Gloves | 1000 (400) |
| Iron Plate | +40 armor | Padded Vest | 800 (500) |
| Spellward Cloak | +50 magic resist | Warding Charm | 900 (450) |
| Bulwark Belt | +350 health | Heartstone | 900 (500) |
| Crimson Fang | +55 attack damage, Feast | Siege Cleaver, Notched Blade | 3000 (1450) |
| Starfall Diadem | +90 ability power, +10 ability haste, Starfall | Cinder Rod, Focus Rune | 3000 (1500) |
| Spiked Bastion | +60 armor, +300 health, Barbs | Iron Plate, Bulwark Belt | 2600 (900) |
| Ironheart Talisman | +40 attack damage, +400 health, Hold the Line | Siege Cleaver, Bulwark Belt | 3100 (1000) |

Champions move at about 60 units/s, so movement speed items are small. Crit chance
exists as a stat but no attack uses it, so no item gives it.

`packages/shared/src/test/itemTrees.test.ts` checks that every part exists, no item is
in its own tree, and no item costs less than its parts.

The practice bot buys its build list in order, skipping items it owns or has already
built into an owned item, at the tree price.

### Passives

Each passive has a name and a `description` for the shop and tooltips, and an
`effectType` with `effectData` that `ChampionItemPassives`
(`packages/server/src/simulation/champion/`) applies:

| effectType | Item (passive) | What it does |
|------------|----------------|--------------|
| `on_hit_damage` | Repeater Crossbow (Barbed Bolts) | Basic attacks deal 12 bonus physical damage |
| `lifesteal` | Crimson Fang (Feast) | Basic attacks heal for 15% of the damage they deal |
| `spellblade` | Starfall Diadem (Starfall) | Casting an ability charges the next basic attack within 10s: +75% AP magic damage; 1.5s cooldown from the hit |
| `thorns` | Spiked Bastion (Barbs) | An enemy (not a tower) that lands a basic attack takes 30 magic damage |
| `shield` | Ironheart Talisman (Hold the Line) | Taking damage below 30% health grants a shield of 30% max health for 5s; 60s cooldown |

A passive applies once however many items carry it. While Starfall is charged and while
Hold the Line's shield is up, the champion also has a marker effect (`item_starfall`,
`item_hold_the_line`; no stats) that shows in the HUD's buff bar and as an aura: stars
circling the champion, and a steel dome over it. The hooks: champion basic attacks
(melee hits and their projectiles) call `onBasicAttackHit`; every basic attack that lands
(`ServerTargetedProjectile`, minion and monster melee hits) calls the target's
`onBasicAttackTaken`, which champions pass to `onHitByBasicAttack`; ability casts call
`onAbilityCast`; `ServerChampion.takeDamage` calls `onDamaged`. Tests:
`packages/server/src/test/ItemPassives.test.ts`.

## Shop UI

`src/ui/shop/ShopUI.ts` drives the shop overlay in `index.html` (styles in `shop.css`):
category tabs, the item grid (each item at its price for the current inventory, in
green when parts lower it), the details panel and the six inventory slots. The details
panel shows the item's build tree with owned parts outlined in green, its stats and
passives, and what it builds into (`src/ui/shop/itemTree.ts`); clicking an item there
selects it. Items that suit the local champion's class have a star (`isRecommendedFor` in
`src/data/items.ts`: mages and supports get ability power, assassins attack damage and
speed, tanks armor, magic resist and health, and so on). Buying keeps the shop open; gold, inventory, affordability and the
buttons refresh from each server state update (`updateOnlineState`). Buying and selling
only work at the fountain. Beside the inventory, the control ward button buys a control
ward (75 gold) to carry, up to 2, outside the six slots (see [map.md](map.md), Wards).

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
