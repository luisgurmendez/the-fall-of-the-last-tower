/**
 * ShopUI - Controller for the HTML shop overlay.
 * Bridges the HTML shop interface with the game state.
 * Supports both local (offline) and network (online) modes.
 */

import { Champion } from "@/champions/Champion";
import GameContext from "@/core/gameContext";
import { ALL_ITEMS, getItemsByCategory } from "@/items/definitions";
import type { ItemDefinition, ItemSlot } from "@/items/types";
import type { NetworkClient } from "@siege/client";

type ItemCategory = ItemDefinition["category"] | "all";

interface ShopState {
  isOpen: boolean;
  selectedCategory: ItemCategory;
  selectedItem: ItemDefinition | null;
  selectedInventorySlot: ItemSlot | null;
}

/**
 * Shop UI Controller - manages the HTML shop overlay
 */
export class ShopUI {
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
  private detailsPanel: HTMLElement | null = null;
  private buyButton: HTMLButtonElement | null = null;
  private sellButton: HTMLButtonElement | null = null;
  private undoButton: HTMLButtonElement | null = null;
  private closeButton: HTMLButtonElement | null = null;
  private categoryButtons: NodeListOf<HTMLButtonElement> | null = null;
  private inventorySlots: NodeListOf<HTMLElement> | null = null;

  // Game reference
  private champion: Champion | null = null;
  private gameContext: GameContext | null = null;

  // Network client for online mode
  private networkClient: NetworkClient | null = null;

  // Online mode state (from server)
  private onlineGold: number | null = null;
  private onlineItems: Array<{ definitionId: string } | null> | null = null;

  // Undo stack
  private undoStack: Array<{
    action: "buy" | "sell";
    item: ItemDefinition;
    slot: ItemSlot;
    goldChange: number;
  }> = [];

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
    console.log("[ShopUI] DOM initialized successfully");
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

    // Inventory slots
    this.inventorySlots?.forEach((slot, index) => {
      slot.addEventListener("click", () =>
        this.selectInventorySlot(index as ItemSlot)
      );
    });

    // Close on backdrop click
    const backdrop = document.querySelector(".shop-backdrop");
    backdrop?.addEventListener("click", () => this.close());

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.state.isOpen) {
        this.close();
      }
    });
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

    const items =
      this.state.selectedCategory === "all"
        ? ALL_ITEMS
        : getItemsByCategory(this.state.selectedCategory);

    console.log("[ShopUI] populateItems:", items.length, "items");

    for (const item of items) {
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

    // Check if can afford
    const gold = this.gameContext?.money ?? 0;
    if (gold < item.cost) {
      div.classList.add("cannot-afford");
    }

    // Icon
    const iconDiv = document.createElement("div");
    iconDiv.className = `shop-item-icon item-icon-${item.category}`;
    iconDiv.textContent = this.getItemIcon(item);
    div.appendChild(iconDiv);

    // Cost
    const costDiv = document.createElement("div");
    costDiv.className = "shop-item-cost";
    costDiv.textContent = item.cost.toString();
    div.appendChild(costDiv);

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
   * Get an emoji icon for an item based on its category.
   */
  private getItemIcon(item: ItemDefinition): string {
    const icons: Record<string, string> = {
      attack_damage: "⚔",
      ability_power: "✦",
      attack_speed: "⚡",
      armor: "🛡",
      magic_resist: "✧",
      health: "♥",
      movement: "👢",
      utility: "⚙",
    };
    return icons[item.category] || "?";
  }

  /**
   * Select a category and filter items.
   */
  private selectCategory(category: ItemCategory): void {
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
    console.log("[ShopUI] selectItem:", item.name);
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
    const inventory = this.champion?.getInventory();
    const equippedItem = inventory?.items.get(slot);

    if (equippedItem) {
      this.state.selectedItem = equippedItem.definition;
      this.state.selectedInventorySlot = slot;

      // Update selection visual
      this.inventorySlots?.forEach((el, idx) => {
        el.classList.toggle("selected", idx === slot);
      });

      // Clear item grid selection
      const itemEls = this.itemsGrid?.querySelectorAll(".shop-item");
      itemEls?.forEach((el) => el.classList.remove("selected"));

      // Show details
      this.showItemDetails(equippedItem.definition, true);

      // Update buttons
      this.updateButtons();
    }
  }

  /**
   * Show item details in the details panel.
   */
  private showItemDetails(
    item: ItemDefinition,
    isOwned: boolean = false
  ): void {
    console.log(
      "[ShopUI] showItemDetails:",
      item.name,
      "detailsPanel:",
      this.detailsPanel
    );
    if (!this.detailsPanel) {
      console.warn("[ShopUI] detailsPanel not found!");
      return;
    }

    const statsHtml = this.formatItemStats(item);
    const passivesHtml = this.formatItemPassives(item);

    this.detailsPanel.innerHTML = `
      <div class="item-detail-header">
        <div class="item-detail-icon item-icon-${item.category}">
          ${this.getItemIcon(item)}
        </div>
        <div class="item-detail-title">
          <div class="item-detail-name">${item.name}</div>
          <div class="item-detail-cost">${
            isOwned ? `Sell: ${item.sellValue}g` : `Cost: ${item.cost}g`
          }</div>
        </div>
      </div>
      <div class="item-detail-description">${item.description}</div>
      ${statsHtml ? `<div class="item-detail-stats">${statsHtml}</div>` : ""}
      ${
        passivesHtml
          ? `<div class="item-detail-passives">${passivesHtml}</div>`
          : ""
      }
    `;
  }

  /**
   * Format item stats for display.
   */
  private formatItemStats(item: ItemDefinition): string {
    const statNames: Record<
      string,
      { name: string; class: string; format: (v: number) => string }
    > = {
      attackDamage: {
        name: "Attack Damage",
        class: "ad",
        format: (v) => `+${v}`,
      },
      abilityPower: {
        name: "Ability Power",
        class: "ap",
        format: (v) => `+${v}`,
      },
      attackSpeed: {
        name: "Attack Speed",
        class: "as",
        format: (v) => `+${Math.round(v * 100)}%`,
      },
      armor: { name: "Armor", class: "armor", format: (v) => `+${v}` },
      magicResist: {
        name: "Magic Resist",
        class: "mr",
        format: (v) => `+${v}`,
      },
      health: { name: "Health", class: "health", format: (v) => `+${v}` },
      movementSpeed: {
        name: "Movement Speed",
        class: "ms",
        format: (v) => `+${v}`,
      },
      critChance: {
        name: "Critical Chance",
        class: "crit",
        format: (v) => `+${Math.round(v * 100)}%`,
      },
    };

    const lines: string[] = [];
    for (const [key, value] of Object.entries(item.stats)) {
      const statInfo = statNames[key];
      if (statInfo && value !== undefined) {
        lines.push(
          `<div class="item-stat">${
            statInfo.name
          }: <span class="item-stat-value ${statInfo.class}">${statInfo.format(
            value
          )}</span></div>`
        );
      }
    }
    return lines.join("");
  }

  /**
   * Format item passives for display.
   */
  private formatItemPassives(item: ItemDefinition): string {
    if (!item.passives.length) return "";

    return item.passives
      .map(
        (passive) => `
      <div class="item-passive">
        <div class="item-passive-name">${passive.isUnique ? "UNIQUE: " : ""}${
          passive.name
        }</div>
        <div class="item-passive-desc">${passive.description}</div>
      </div>
    `
      )
      .join("");
  }

  /**
   * Update button states based on current selection.
   */
  private updateButtons(): void {
    // Get gold from online state or game context
    const gold = this.onlineGold ?? this.gameContext?.money ?? 0;
    const item = this.state.selectedItem;

    // Buy button
    if (this.buyButton) {
      let canBuy = false;

      if (item && this.state.selectedInventorySlot === null) {
        if (this.networkClient) {
          // Online mode: just check gold (server validates everything else)
          canBuy = gold >= item.cost;
        } else if (this.champion) {
          // Offline mode: full validation
          canBuy = this.champion.canPurchaseItem(item, gold).success;
        }
      }
      this.buyButton.disabled = !canBuy;
    }

    // Sell button
    if (this.sellButton) {
      const canSell = this.state.selectedInventorySlot !== null;
      this.sellButton.disabled = !canSell;
    }

    // Undo button (disabled in online mode - server handles state)
    if (this.undoButton) {
      const canUndo = !this.networkClient && this.undoStack.length > 0;
      this.undoButton.disabled = !canUndo;
    }
  }

  /**
   * Buy the currently selected item.
   */
  private buySelectedItem(): void {
    if (!this.state.selectedItem) return;

    const item = this.state.selectedItem;

    // Online mode: send buy request to server
    if (this.networkClient) {
      console.log(`[ShopUI] Sending buy request for ${item.name} (${item.id})`);
      this.networkClient.sendBuyItemInput(item.id);
      // Server will handle validation and gold deduction
      // Close shop after purchase attempt
      this.close();
      return;
    }

    // Offline mode: handle locally
    if (!this.champion || !this.gameContext) return;

    const gold = this.gameContext.money;

    const result = this.champion.canPurchaseItem(item, gold);
    if (!result.success) {
      console.log(`Cannot buy ${item.name}: ${result.reason}`);
      return;
    }

    // Deduct gold
    this.gameContext.setMoney(gold - item.cost);

    // Add item to inventory
    const slot = this.champion.purchaseItem(item);

    if (slot !== -1) {
      // Add to undo stack
      this.undoStack.push({
        action: "buy",
        item,
        slot,
        goldChange: -item.cost,
      });

      console.log(`Purchased ${item.name} for ${item.cost}g`);

      // Refresh UI
      this.refreshUI();
    }
  }

  /**
   * Sell the selected inventory item.
   */
  private sellSelectedItem(): void {
    if (this.state.selectedInventorySlot === null) return;

    const slot = this.state.selectedInventorySlot;

    // Online mode: send sell request to server
    if (this.networkClient) {
      console.log(`[ShopUI] Sending sell request for slot ${slot}`);
      this.networkClient.sendSellItemInput(slot);
      // Server will handle validation and gold credit
      // Clear selection
      this.state.selectedItem = null;
      this.state.selectedInventorySlot = null;
      this.refreshUI();
      return;
    }

    // Offline mode: handle locally
    if (!this.champion || !this.gameContext) return;

    const inventory = this.champion.getInventory();
    const equipped = inventory.items.get(slot);

    if (!equipped) return;

    const item = equipped.definition;
    const goldGained = this.champion.sellItem(slot);

    // Add gold
    this.gameContext.setMoney(this.gameContext.money + goldGained);

    // Add to undo stack
    this.undoStack.push({
      action: "sell",
      item,
      slot,
      goldChange: goldGained,
    });

    console.log(`Sold ${item.name} for ${goldGained}g`);

    // Clear selection
    this.state.selectedItem = null;
    this.state.selectedInventorySlot = null;

    // Refresh UI
    this.refreshUI();
  }

  /**
   * Undo the last buy/sell action.
   */
  private undoLastAction(): void {
    if (!this.champion || !this.gameContext || this.undoStack.length === 0)
      return;

    const lastAction = this.undoStack.pop()!;

    if (lastAction.action === "buy") {
      // Undo a purchase - sell the item and refund full cost
      this.champion.sellItem(lastAction.slot);
      this.gameContext.setMoney(this.gameContext.money + lastAction.item.cost);
      console.log(`Undid purchase of ${lastAction.item.name}`);
    } else {
      // Undo a sale - re-purchase the item without cost
      const gold = this.gameContext.money;
      if (gold >= lastAction.goldChange) {
        this.gameContext.setMoney(gold - lastAction.goldChange);
        this.champion.purchaseItem(lastAction.item);
        console.log(`Undid sale of ${lastAction.item.name}`);
      }
    }

    // Refresh UI
    this.refreshUI();
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

    // Online mode: use server gold
    if (this.onlineGold !== null) {
      this.goldDisplay.textContent = Math.floor(this.onlineGold).toString();
      return;
    }

    // Offline mode: use game context
    if (this.gameContext) {
      this.goldDisplay.textContent = this.gameContext.money.toString();
    }
  }

  /**
   * Update inventory slot displays.
   */
  private updateInventorySlots(): void {
    if (!this.inventorySlots) return;

    // Online mode: use server items
    if (this.onlineItems !== null) {
      this.inventorySlots.forEach((slot, index) => {
        const itemState = this.onlineItems![index] ?? null;

        // Clear slot
        slot.innerHTML = "";
        slot.classList.remove("has-item");

        if (itemState && itemState.definitionId) {
          // Look up item definition by ID
          const itemDef = ALL_ITEMS.find(i => i.id === itemState.definitionId);

          if (itemDef) {
            slot.classList.add("has-item");

            const iconDiv = document.createElement("div");
            iconDiv.className = `slot-item-icon item-icon-${itemDef.category}`;
            iconDiv.textContent = this.getItemIcon(itemDef);
            slot.appendChild(iconDiv);
          }
        } else {
          const numberDiv = document.createElement("div");
          numberDiv.className = "slot-number";
          numberDiv.textContent = (index + 1).toString();
          slot.appendChild(numberDiv);
        }
      });
      return;
    }

    // Offline mode: use champion inventory
    if (!this.champion) return;

    const inventory = this.champion.getInventory();

    this.inventorySlots.forEach((slot, index) => {
      const equipped = inventory.items.get(index as ItemSlot);

      // Clear slot
      slot.innerHTML = "";
      slot.classList.remove("has-item");

      if (equipped) {
        slot.classList.add("has-item");

        const iconDiv = document.createElement("div");
        iconDiv.className = `slot-item-icon item-icon-${equipped.definition.category}`;
        iconDiv.textContent = this.getItemIcon(equipped.definition);
        slot.appendChild(iconDiv);
      } else {
        const numberDiv = document.createElement("div");
        numberDiv.className = "slot-number";
        numberDiv.textContent = (index + 1).toString();
        slot.appendChild(numberDiv);
      }
    });
  }

  /**
   * Set the champion reference for the shop.
   */
  setChampion(champion: Champion): void {
    this.champion = champion;
    this.updateInventorySlots();
  }

  /**
   * Set the game context reference.
   */
  setGameContext(gameContext: GameContext): void {
    this.gameContext = gameContext;
    this.updateGoldDisplay();
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
   * Update online state from server snapshot.
   * Convenience method that sets both gold and items.
   */
  updateOnlineState(gold: number, items: Array<{ definitionId: string } | null>): void {
    this.onlineGold = gold;
    this.onlineItems = items;
    if (this.state.isOpen) {
      this.updateGoldDisplay();
      this.updateInventorySlots();
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

    // Clear undo stack when opening
    this.undoStack = [];

    // Refresh UI
    this.refreshUI();
  }

  /**
   * Close the shop.
   */
  close(): void {
    if (!this.state.isOpen) return;

    this.state.isOpen = false;
    this.overlay?.classList.add("hidden");

    // Clear selection
    this.state.selectedItem = null;
    this.state.selectedInventorySlot = null;
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
   * Update item affordability CSS classes without recreating elements.
   * This preserves event listeners and allows clicks to work properly.
   */
  private updateItemAffordability(): void {
    if (!this.itemsGrid || !this.gameContext) return;

    const gold = this.gameContext.money;
    const itemEls = this.itemsGrid.querySelectorAll(".shop-item");

    itemEls.forEach((el) => {
      const itemId = (el as HTMLElement).dataset.itemId;
      const item = ALL_ITEMS.find((i) => i.id === itemId);
      if (item) {
        el.classList.toggle("cannot-afford", gold < item.cost);
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
