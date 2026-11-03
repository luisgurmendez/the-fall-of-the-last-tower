/**
 * ShopUI - Controller for the HTML shop overlay.
 * Online mode only - sends buy/sell requests to server.
 */

import GameContext from "@/core/gameContext";
import type { ChampionClass, ItemDefinition, ItemSlot, ItemCategory } from "@siege/shared";
import type { NetworkClient } from "@siege/client";
import { createItemIconElement } from "@/ui/itemIcons";
import { SHOP_ITEMS, getItemDefinition, getItemPassive, isRecommendedFor } from "@/data/items";
import { describeConsumable, getItemActive, listItemStats } from "@/data/itemStats";
import { ITEM_KEYS } from "@/core/input/itemKeys";
import { InputManager } from "@/core/input/InputManager";
import { renderItemTree, renderBuildsInto } from "@/ui/shop/itemTree";
import { getAudio } from "@/audio/AudioManager";
import {
  CONTROL_WARD_ITEM_ID,
  GameConfig,
  getItemCatalogEntry,
  planItemPurchase,
  purchaseBlockReason,
  type ItemTier,
  type PurchaseBlock,
} from "@siege/shared";

type ShopCategory = ItemCategory | "all";

/** The categories each tab shows (the tab's data-category in index.html) */
const TAB_CATEGORIES: Partial<Record<ShopCategory, ItemCategory[]>> = {
  starter: ["starter", "consumable"],
  attack_speed: ["attack_speed", "critical"],
  ability_power: ["ability_power", "mana"],
  utility: ["utility", "support"],
};

/** Tiers in the order the grid lists them, with the "All" tab's headings */
const TIERS: { tier: ItemTier; title: string }[] = [
  { tier: "starter", title: "Starters" },
  { tier: "consumable", title: "Potions & elixirs" },
  { tier: "basic", title: "Basic" },
  { tier: "boots", title: "Boots" },
  { tier: "epic", title: "Epic" },
  { tier: "legendary", title: "Legendary" },
];
const TIER_ORDER = new Map(TIERS.map(({ tier }, index) => [tier, index]));

const tierOf = (item: ItemDefinition): ItemTier => getItemCatalogEntry(item.id)?.tier ?? "basic";

/** A tab's items, by tier then price */
function getItemsByCategory(category: ShopCategory): ItemDefinition[] {
  const categories = TAB_CATEGORIES[category] ?? [category];
  return SHOP_ITEMS
    .filter(item => category === "all" || categories.includes(item.category))
    .sort((a, b) => (TIER_ORDER.get(tierOf(a))! - TIER_ORDER.get(tierOf(b))!) || a.cost - b.cost);
}

/** Why the shop won't sell an item, in its words */
const BLOCK_REASONS: Record<PurchaseBlock, string> = {
  unique_owned: "You already have one",
  group_owned: "You already have one of its kind",
  stack_full: "You can't carry more",
};

interface ShopState {
  isOpen: boolean;
  selectedCategory: ShopCategory;
  selectedItem: ItemDefinition | null;
  selectedInventorySlot: ItemSlot | null;
}

/**
 * Shop UI Controller - manages the HTML shop overlay
 */
export class ShopUI {
  /** The local champion's class, to star the items that suit it */
  private championClass: ChampionClass | null = null;

  private state: ShopState = {
    isOpen: false,
    selectedCategory: "all",
    selectedItem: null,
    selectedInventorySlot: null,
  };

  // DOM elements
  private overlay: HTMLElement | null = null;
  private goldDisplay: HTMLElement | null = null;
  private itemsGrid: HTMLElement | null = null;
  /** Where the item list was scrolled when the shop closed */
  private listScroll = 0;
  private detailsPanel: HTMLElement | null = null;
  private buyButton: HTMLButtonElement | null = null;
  /** Whether the local champion is where it can shop (its fountain) */
  private atShop = true;
  private sellButton: HTMLButtonElement | null = null;
  private undoButton: HTMLButtonElement | null = null;
  private controlWardButton: HTMLButtonElement | null = null;
  private closeButton: HTMLButtonElement | null = null;
  private categoryButtons: NodeListOf<HTMLButtonElement> | null = null;
  private inventorySlots: NodeListOf<HTMLElement> | null = null;

  // Game reference (for gold display in local context)
  private gameContext: GameContext | null = null;

  // Network client for online mode
  private networkClient: NetworkClient | null = null;

  // Online mode state (from server)
  private onlineGold: number = 0;
  private onlineItems: Array<{ definitionId: string; charges?: number } | null> = [];
  /** Control wards carried (bought here, apart from the six slots) */
  private onlineControlWards = 0;

  // Track if DOM has been initialized
  private domInitialized: boolean = false;

  constructor() {
    // Don't initialize DOM in constructor - wait for first use
    // This ensures DOM elements exist when we query them
  }

  /**
   * Ensure DOM is initialized (lazy initialization).
   */
  private ensureDOMInitialized(): void {
    if (this.domInitialized) return;

    // Get DOM elements
    this.overlay = document.getElementById("shop-overlay");
    this.goldDisplay = document.getElementById("shop-gold-amount");
    this.itemsGrid = document.getElementById("shop-items-grid");
    this.detailsPanel = document.getElementById("item-details");
    this.buyButton = document.getElementById("btn-buy") as HTMLButtonElement;
    this.sellButton = document.getElementById("btn-sell") as HTMLButtonElement;
    this.undoButton = document.getElementById("btn-undo") as HTMLButtonElement;
    this.controlWardButton = document.getElementById("btn-control-ward") as HTMLButtonElement;
    this.closeButton = document.getElementById(
      "shop-close"
    ) as HTMLButtonElement;
    this.categoryButtons = document.querySelectorAll(".category-btn");
    this.inventorySlots = document.querySelectorAll(".inventory-slot");

    // Only proceed if we found the overlay (DOM is ready)
    if (!this.overlay) {
      console.warn("[ShopUI] DOM not ready, will retry on next call");
      return;
    }

    // Set up event listeners
    this.setupEventListeners();

    // Populate items
    this.populateItems();

    this.domInitialized = true;
  }

  /**
   * Set up all event listeners.
   */
  private setupEventListeners(): void {
    // Close button
    this.closeButton?.addEventListener("click", () => this.close());

    // Category buttons
    this.categoryButtons?.forEach((btn) => {
      btn.addEventListener("click", () => {
        const category = btn.dataset.category as ItemCategory;
        this.selectCategory(category);
      });
    });

    // Buy button
    this.buyButton?.addEventListener("click", () => this.buySelectedItem());

    // Sell button
    this.sellButton?.addEventListener("click", () => this.sellSelectedItem());

    // Undo button
    this.undoButton?.addEventListener("click", () => this.undoLastAction());

    // The server checks the gold, the place and how many are carried
    this.controlWardButton?.addEventListener("click", () => this.networkClient?.sendBuyItemInput(CONTROL_WARD_ITEM_ID));

    // Inventory slots
    this.inventorySlots?.forEach((slot, index) => {
      slot.addEventListener("click", () =>
        this.selectInventorySlot(index as ItemSlot)
      );
    });

    // Clicks around the shop reach the game (shop.css), so a right-click there
    // moves; a left-click there closes it. Escape closes it too, in OnlineGame
    // (which opens the menu instead when the shop is closed).
    const container = this.overlay?.querySelector(".shop-container");
    document.addEventListener("mousedown", (event) => {
      if (event.button === 0 && this.state.isOpen && !container?.contains(event.target as Node)) this.close();
    });
    // On the shop itself a right-click moves too, to the ground under the
    // cursor as if the shop weren't there (except on an item: that buys it)
    const input = InputManager.getInstance();
    container?.addEventListener("mousemove", (event) => input.forwardMouseEvent(event as MouseEvent));
    container?.addEventListener("mousedown", (event) => {
      const mouse = event as MouseEvent;
      if (mouse.button === 2 && !(mouse.target as Element).closest(".shop-item")) input.forwardMouseEvent(mouse);
    });
    container?.addEventListener("mouseup", (event) => {
      if ((event as MouseEvent).button === 2) input.forwardMouseEvent(event as MouseEvent);
    });
    container?.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  /**
   * Populate the items grid with all items.
   */
  private populateItems(): void {
    if (!this.itemsGrid) {
      console.warn("[ShopUI] itemsGrid not found!");
      return;
    }

    this.itemsGrid.innerHTML = "";

    const items = getItemsByCategory(this.state.selectedCategory);

    // The "All" tab heads each tier
    let tier: ItemTier | null = null;
    for (const item of items) {
      if (this.state.selectedCategory === "all" && tierOf(item) !== tier) {
        tier = tierOf(item);
        const heading = document.createElement("div");
        heading.className = "shop-tier-heading";
        heading.textContent = TIERS.find(entry => entry.tier === tier)?.title ?? tier;
        this.itemsGrid.appendChild(heading);
      }
      const itemEl = this.createItemElement(item);
      this.itemsGrid.appendChild(itemEl);
    }
  }

  /**
   * Create an item element for the grid.
   */
  private createItemElement(item: ItemDefinition): HTMLElement {
    const div = document.createElement("div");
    div.className = "shop-item";
    div.dataset.itemId = item.id;

    // Items that suit the local champion get a star
    if (this.championClass && isRecommendedFor(item, this.championClass)) {
      div.classList.add("recommended");
      div.title = "Recommended for your champion";
    }

    // Icon
    const iconDiv = document.createElement("div");
    iconDiv.className = `shop-item-icon item-icon-${item.category}`;
    iconDiv.appendChild(createItemIconElement(item));
    div.appendChild(iconDiv);

    // Price for this inventory (set by updateItemPrice)
    const costDiv = document.createElement("div");
    costDiv.className = "shop-item-cost";
    div.appendChild(costDiv);
    this.updateItemPrice(div, item);

    // Click handler
    div.addEventListener("click", () => this.selectItem(item));

    // Right-click for quick buy
    div.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.selectItem(item);
      this.buySelectedItem();
    });

    return div;
  }

  /**
   * Select a category and filter items.
   */
  private selectCategory(category: ShopCategory): void {
    this.state.selectedCategory = category;

    // Update active button
    this.categoryButtons?.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.category === category);
    });

    // Repopulate items
    this.populateItems();
  }

  /**
   * Select an item to view details.
   */
  private selectItem(item: ItemDefinition): void {
    this.state.selectedItem = item;
    this.state.selectedInventorySlot = null;

    // Update selection visual
    const itemEls = this.itemsGrid?.querySelectorAll(".shop-item");
    itemEls?.forEach((el) => {
      el.classList.toggle(
        "selected",
        (el as HTMLElement).dataset.itemId === item.id
      );
    });

    // Clear inventory slot selection
    this.inventorySlots?.forEach((slot) => slot.classList.remove("selected"));

    // Show details
    this.showItemDetails(item);

    // Update buttons
    this.updateButtons();
  }

  /**
   * Select an inventory slot.
   */
  private selectInventorySlot(slot: ItemSlot): void {
    const itemState = this.onlineItems[slot] ?? null;

    if (itemState && itemState.definitionId) {
      // Look up item definition
      const itemDef = getItemDefinition(itemState.definitionId);

      if (itemDef) {
        this.state.selectedItem = itemDef;
        this.state.selectedInventorySlot = slot;

        // Update selection visual
        this.inventorySlots?.forEach((el, idx) => {
          el.classList.toggle("selected", idx === slot);
        });

        // Clear item grid selection
        const itemEls = this.itemsGrid?.querySelectorAll(".shop-item");
        itemEls?.forEach((el) => el.classList.remove("selected"));

        // Show details
        this.showItemDetails(itemDef, true);

        // Update buttons
        this.updateButtons();
      }
    }
  }

  /**
   * Show item details in the details panel.
   */
  private showItemDetails(
    item: ItemDefinition,
    isOwned: boolean = false
  ): void {
    if (!this.detailsPanel) {
      console.warn("[ShopUI] detailsPanel not found!");
      return;
    }

    const statsHtml = this.formatItemStats(item);
    const passivesHtml = this.formatItemPassives(item);
    const plan = planItemPurchase(item.id, this.getInventoryIds());
    const price = plan?.price ?? item.cost;
    const costText = isOwned
      ? `Sell: ${item.sellValue}g`
      : price < item.cost ? `Cost: ${price}g <s>${item.cost}g</s>` : `Cost: ${item.cost}g`;

    this.detailsPanel.innerHTML = `
      <div class="item-detail-header">
        <div class="item-detail-icon item-icon-${item.category}"></div>
        <div class="item-detail-title">
          <div class="item-detail-name">${item.name}</div>
          <div class="item-detail-cost">${costText}</div>
        </div>
      </div>
      ${item.description ? `<div class="item-detail-description">${item.description}</div>` : ""}
      ${statsHtml ? `<div class="item-detail-stats">${statsHtml}</div>` : ""}
      ${
        passivesHtml
          ? `<div class="item-detail-passives">${passivesHtml}</div>`
          : ""
      }
      ${!isOwned && this.blockReason(item) ? `<div class="item-detail-blocked">${BLOCK_REASONS[this.blockReason(item)!]}</div>` : ""}
    `;
    this.detailsPanel.querySelector(".item-detail-icon")?.appendChild(createItemIconElement(item));

    // Build tree right under the header, what it builds into at the end
    const select = (next: ItemDefinition) => this.selectItem(next);
    if (plan && plan.tree.parts.length > 0) {
      const tree = renderItemTree(isOwned ? { ...plan.tree, owned: true } : plan.tree, select);
      this.detailsPanel.querySelector(".item-detail-header")?.after(this.labeled("Built from", tree));
    }
    const buildsInto = renderBuildsInto(item.id, select);
    if (buildsInto) {
      this.detailsPanel.appendChild(this.labeled("Builds into", buildsInto));
    }
  }

  /**
   * A details section: a small title over its content.
   */
  private labeled(title: string, content: HTMLElement): HTMLElement {
    const section = document.createElement("div");
    section.className = "item-detail-section";
    const label = document.createElement("div");
    label.className = "item-detail-section-title";
    label.textContent = title;
    section.append(label, content);
    return section;
  }

  /**
   * Item ids in the inventory, by slot.
   */
  private getInventoryIds(): (string | null)[] {
    return this.onlineItems.map(item => item?.definitionId ?? null);
  }

  /** Why the item can't be bought with this inventory (a second pair of boots...), or null */
  private blockReason(item: ItemDefinition): PurchaseBlock | null {
    return purchaseBlockReason(item.id, this.onlineItems);
  }

  /**
   * What an item costs now: its parts in the inventory are taken off.
   */
  private getPrice(item: ItemDefinition): number {
    return planItemPurchase(item.id, this.getInventoryIds())?.price ?? item.cost;
  }

  /**
   * Show an item cell's price for this inventory, and whether gold covers it.
   */
  private updateItemPrice(cell: Element, item: ItemDefinition): void {
    const price = this.getPrice(item);
    const costEl = cell.querySelector(".shop-item-cost");
    if (costEl) costEl.textContent = price.toString();
    cell.classList.toggle("discounted", price < item.cost);
    cell.classList.toggle("cannot-afford", this.onlineGold < price);
    cell.classList.toggle("blocked", this.blockReason(item) !== null);
  }

  /**
   * Format item stats for display.
   */
  private formatItemStats(item: ItemDefinition): string {
    return listItemStats(item.stats)
      .map(({ info, value }) => `<div class="item-stat">${info.label}: <span class="item-stat-value ${info.cssClass}">${value}</span></div>`)
      .join("");
  }

  /**
   * Format item passives for display.
   * Note: passiveIds are just string IDs - full passive definitions would come from server.
   */
  private formatItemPassives(item: ItemDefinition): string {
    const active = getItemActive(item.id);
    const consumable = describeConsumable(item.id);
    const activeHtml = active ? `
      <div class="item-passive item-active">
        <div class="item-passive-name">Active: ${active.name} <span class="item-active-cooldown">${active.cooldown >= 1 ? `${active.cooldown}s` : ""}</span></div>
        <div class="item-passive-desc">${active.description}</div>
      </div>` : "";
    const consumableHtml = consumable ? `<div class="item-passive-desc">${consumable}</div>` : "";
    if (!item.passiveIds || !item.passiveIds.length) return activeHtml + consumableHtml;

    return activeHtml + consumableHtml + item.passiveIds
      .map((passiveId) => {
        const passive = getItemPassive(passiveId);
        return `
      <div class="item-passive">
        <div class="item-passive-name">${passive?.name ?? passiveId}</div>
        ${passive ? `<div class="item-passive-desc">${passive.description}</div>` : ""}
      </div>
    `;
      })
      .join("");
  }

  /**
   * Update button states based on current selection.
   */
  private updateButtons(): void {
    const gold = this.onlineGold;
    const item = this.state.selectedItem;

    // Buy button - check gold and being at base (server validates everything else)
    if (this.buyButton) {
      const canBuy = this.atShop &&
                     item !== null &&
                     this.state.selectedInventorySlot === null &&
                     gold >= this.getPrice(item) &&
                     this.blockReason(item) === null;
      this.buyButton.disabled = !canBuy;
      this.buyButton.textContent = this.atShop ? "BUY" : "AT BASE ONLY";
    }

    // Sell button
    if (this.sellButton) {
      const canSell = this.atShop && this.state.selectedInventorySlot !== null;
      this.sellButton.disabled = !canSell;
    }

    // Undo button - not available in online mode (server handles state)
    if (this.undoButton) {
      this.undoButton.disabled = true;
    }

    this.updateControlWardButton();
  }

  /** The control ward button: how many are carried, and whether one more can be bought */
  private updateControlWardButton(): void {
    if (!this.controlWardButton) return;
    const { CONTROL_WARD_COST, MAX_CONTROL_WARDS_CARRIED } = GameConfig.VISION;
    const carried = this.onlineControlWards;
    this.controlWardButton.disabled = !this.atShop || carried >= MAX_CONTROL_WARDS_CARRIED || this.onlineGold < CONTROL_WARD_COST;
    this.controlWardButton.title = this.atShop
      ? `Control Ward (${CONTROL_WARD_COST} gold): reveals and disables enemy wards around it. Carry up to ${MAX_CONTROL_WARDS_CARRIED}; place one with 5.`
      : "Buy at base only";
    const count = document.getElementById("control-ward-count");
    if (count) count.textContent = `${carried}/${MAX_CONTROL_WARDS_CARRIED}`;
    const cost = document.getElementById("control-ward-cost");
    if (cost) cost.textContent = `${CONTROL_WARD_COST}`;
  }

  /**
   * Buy the currently selected item.
   */
  private buySelectedItem(): void {
    if (!this.state.selectedItem || !this.networkClient) return;

    const item = this.state.selectedItem;

    // The server validates it; gold and inventory update from its next state
    this.networkClient.sendBuyItemInput(item.id);
  }

  /**
   * Sell the selected inventory item.
   */
  private sellSelectedItem(): void {
    if (this.state.selectedInventorySlot === null || !this.networkClient) return;

    const slot = this.state.selectedInventorySlot;

    this.networkClient.sendSellItemInput(slot);
    // Server will handle validation and gold credit
    // Clear selection
    this.state.selectedItem = null;
    this.state.selectedInventorySlot = null;
    this.refreshUI();
  }

  /**
   * Undo the last buy/sell action.
   * Note: Not available in online mode - server handles state.
   */
  private undoLastAction(): void {
    // Undo is not available in online mode
  }

  /**
   * Refresh the entire shop UI.
   */
  private refreshUI(): void {
    this.updateGoldDisplay();
    this.populateItems();
    this.updateInventorySlots();
    this.updateButtons();

    // Reset details panel if nothing selected
    if (!this.state.selectedItem && this.detailsPanel) {
      this.detailsPanel.innerHTML = `
        <div class="item-details-placeholder">
          Select an item to view details
        </div>
      `;
    }
  }

  /**
   * Update the gold display.
   */
  private updateGoldDisplay(): void {
    if (!this.goldDisplay) return;
    this.goldDisplay.textContent = Math.floor(this.onlineGold).toString();
  }

  /**
   * Update inventory slot displays.
   */
  private updateInventorySlots(): void {
    if (!this.inventorySlots) return;

    this.inventorySlots.forEach((slot, index) => {
      const itemState = this.onlineItems[index] ?? null;

      // Clear slot
      slot.innerHTML = "";
      slot.classList.remove("has-item");

      if (itemState && itemState.definitionId) {
        // Look up item definition by ID
        const itemDef = getItemDefinition(itemState.definitionId);

        if (itemDef) {
          slot.classList.add("has-item");

          const iconDiv = document.createElement("div");
          iconDiv.className = `slot-item-icon item-icon-${itemDef.category}`;
          iconDiv.appendChild(createItemIconElement(itemDef));
          slot.appendChild(iconDiv);
        }
      } else {
        const numberDiv = document.createElement("div");
        numberDiv.className = "slot-number";
        // The key that uses the item in this slot
        numberDiv.textContent = ITEM_KEYS[index] ?? (index + 1).toString();
        slot.appendChild(numberDiv);
      }
    });
  }

  /**
   * Set the game context reference (for UI callbacks).
   */
  setGameContext(gameContext: GameContext): void {
    this.gameContext = gameContext;
  }

  /**
   * Set the network client for online mode.
   * When set, buy/sell actions will be sent to the server instead of modifying local state.
   */
  setNetworkClient(networkClient: NetworkClient): void {
    this.networkClient = networkClient;
  }

  /**
   * Set online mode gold (from server state).
   * Used in online mode instead of gameContext.money.
   */
  setOnlineGold(gold: number): void {
    this.onlineGold = gold;
    this.updateGoldDisplay();
  }

  /**
   * Set online mode items (from server state).
   * Used in online mode instead of champion.getInventory().
   * @param items Array of item states or null for empty slots
   */
  setOnlineItems(items: Array<{ definitionId: string } | null>): void {
    this.onlineItems = items;
    this.updateInventorySlots();
  }

  /**
   * Set the local champion's class: the items that suit it are starred.
   */
  setChampionClass(championClass: ChampionClass): void {
    if (championClass === this.championClass) return;
    this.championClass = championClass;
    if (this.state.isOpen) this.refreshUI();
  }

  /**
   * Update online state from server snapshot.
   * Convenience method that sets both gold and items.
   */
  updateOnlineState(gold: number, items: Array<{ definitionId: string; charges?: number } | null>, atShop = true, controlWards = 0): void {
    const inventoryChanged = JSON.stringify(this.onlineItems) !== JSON.stringify(items);
    // Something was bought: gold went down as the inventory or the wards carried changed
    if (gold < this.onlineGold && (inventoryChanged || controlWards > this.onlineControlWards)) {
      getAudio().play("item_buy");
    }
    this.onlineGold = gold;
    this.onlineItems = items;
    this.atShop = atShop;
    this.onlineControlWards = controlWards;
    if (this.state.isOpen) {
      // Gold changes after a purchase or sale, and over time: refresh what it affects
      this.updateGoldDisplay();
      this.updateInventorySlots();
      this.updateItemAffordability();
      this.updateButtons();
      // Owned parts changed: the selected item's price and tree did too
      if (inventoryChanged && this.state.selectedItem && this.state.selectedInventorySlot === null) {
        this.showItemDetails(this.state.selectedItem);
      }
    }
  }

  /**
   * Open the shop.
   */
  open(): void {
    // Ensure DOM is initialized before opening
    this.ensureDOMInitialized();

    if (this.state.isOpen) return;

    this.state.isOpen = true;
    this.overlay?.classList.remove("hidden");

    // Refresh UI
    this.refreshUI();

    // As it was left: the item picked and where the list was scrolled
    if (this.state.selectedItem) this.selectItem(this.state.selectedItem);
    const list = this.itemsGrid?.closest(".shop-items-panel");
    if (list) list.scrollTop = this.listScroll;
  }

  /**
   * Close the shop.
   */
  close(): void {
    if (!this.state.isOpen) return;

    this.state.isOpen = false;
    this.overlay?.classList.add("hidden");

    // The item picked in the list stays picked for next time; one picked in
    // the inventory doesn't (the inventory may change)
    if (this.state.selectedInventorySlot !== null) {
      this.state.selectedItem = null;
      this.state.selectedInventorySlot = null;
    }
    this.listScroll = this.itemsGrid?.closest(".shop-items-panel")?.scrollTop ?? 0;
  }

  /**
   * Toggle the shop open/closed.
   */
  toggle(): void {
    if (this.state.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Check if the shop is open.
   */
  isOpen(): boolean {
    return this.state.isOpen;
  }

  /**
   * Update the shop each frame (for gold updates, etc).
   */
  update(): void {
    if (this.state.isOpen) {
      this.updateGoldDisplay();
      this.updateItemAffordability(); // Update affordability without recreating elements
      this.updateButtons();
    }
  }

  /**
   * Update item prices and affordability without recreating elements.
   * This preserves event listeners and allows clicks to work properly.
   */
  private updateItemAffordability(): void {
    if (!this.itemsGrid) return;

    const itemEls = this.itemsGrid.querySelectorAll(".shop-item");

    itemEls.forEach((el) => {
      const itemId = (el as HTMLElement).dataset.itemId;
      const item = itemId ? getItemDefinition(itemId) : undefined;
      if (item) {
        this.updateItemPrice(el, item);
      }
    });
  }
}

// Singleton instance
let shopUIInstance: ShopUI | null = null;

/**
 * Get or create the ShopUI singleton.
 */
export function getShopUI(): ShopUI {
  if (!shopUIInstance) {
    shopUIInstance = new ShopUI();
  }
  return shopUIInstance;
}

export default ShopUI;
