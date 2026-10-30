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

Current trees:

| Item | Built from | Combine cost |
|------|------------|--------------|
| B.F. Sword | Long Sword, Long Sword | 600 |
| Bloodthirster | B.F. Sword, Long Sword | 1750 |
| Needlessly Large Rod | Amplifying Tome, Amplifying Tome | 380 |
| Rabadon's Deathcap | Needlessly Large Rod, Amplifying Tome | 1915 |
| Recurve Bow | Dagger, Dagger | 400 |
| Chain Vest | Cloth Armor | 500 |
| Thornmail | Chain Vest, Giant's Belt | 1000 |
| Negatron Cloak | Null-Magic Mantle | 450 |
| Giant's Belt | Ruby Crystal | 500 |
| Sterak's Gage | Giant's Belt, B.F. Sword | 900 |

Long Sword, Amplifying Tome, Dagger, Cloth Armor, Null-Magic Mantle, Ruby Crystal, Sheen
and Boots of Speed are basic items. `packages/shared/src/test/itemTrees.test.ts` checks
that every part exists, no item is in its own tree, and no item costs less than its parts.

The practice bot buys its build list in order, skipping items it owns or has already
built into an owned item, at the tree price.

### Passives

Each passive has a name and a `description` for the shop and tooltips, and an
`effectType` with `effectData` for the server. **The server does not apply item passives
yet** (lifesteal, on-hit damage, thorns, the low-health shield, spellblade): items only
give their stats.

## Shop UI

`src/ui/shop/ShopUI.ts` drives the shop overlay in `index.html` (styles in `shop.css`):
category tabs, the item grid (each item at its price for the current inventory, in
green when parts lower it), the details panel and the six inventory slots. The details
panel shows the item's build tree with owned parts outlined in green, its stats and
passives, and what it builds into (`src/ui/shop/itemTree.ts`); clicking an item there
selects it. Buying keeps the shop open; gold, inventory, affordability and the
buttons refresh from each server state update (`updateOnlineState`). Buying and selling
only work at the fountain.

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
