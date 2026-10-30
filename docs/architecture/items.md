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

### Passives

Each passive has a name and a `description` for the shop and tooltips, and an
`effectType` with `effectData` for the server. **The server does not apply item passives
yet** (lifesteal, on-hit damage, thorns, the low-health shield, spellblade): items only
give their stats.

## Shop UI

`src/ui/shop/ShopUI.ts` drives the shop overlay in `index.html` (styles in `shop.css`):
category tabs, the item grid, the details panel (stats and passives) and the six
inventory slots. Buying keeps the shop open; gold, inventory, affordability and the
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
