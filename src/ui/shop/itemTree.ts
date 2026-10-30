/**
 * The shop's build tree views: an item's tree of parts (with the parts the
 * inventory already covers marked) and the items it builds into. Clicking an
 * item in either selects it.
 */

import { getItemBuildsInto, type ItemDefinition, type ItemTreeNode } from "@siege/shared";
import { getItemDefinition } from "@/data/items";
import { createItemIconElement } from "@/ui/itemIcons";

type SelectItem = (item: ItemDefinition) => void;

/**
 * The item's tree: the item on top, its parts below, theirs below them.
 */
export function renderItemTree(tree: ItemTreeNode, onSelect: SelectItem): HTMLElement {
  const container = document.createElement("div");
  container.className = "item-tree";
  container.appendChild(renderBranch(tree, false, onSelect));
  return container;
}

/**
 * A row of the items this one builds into, or null if it builds into nothing.
 */
export function renderBuildsInto(itemId: string, onSelect: SelectItem): HTMLElement | null {
  const items = getItemBuildsInto(itemId)
    .map(getItemDefinition)
    .filter((item): item is ItemDefinition => item !== undefined);
  if (items.length === 0) return null;

  const row = document.createElement("div");
  row.className = "item-builds-into";
  for (const item of items) {
    row.appendChild(renderItemButton(item, false, onSelect));
  }
  return row;
}

function renderBranch(node: ItemTreeNode, coveredAbove: boolean, onSelect: SelectItem): HTMLElement {
  const branch = document.createElement("div");
  branch.className = "tree-branch";
  const item = getItemDefinition(node.itemId);
  if (!item) return branch;

  const owned = node.owned || coveredAbove;
  branch.appendChild(renderItemButton(item, owned, onSelect));

  if (node.parts.length > 0) {
    const parts = document.createElement("div");
    parts.className = "tree-parts";
    for (const part of node.parts) {
      parts.appendChild(renderBranch(part, owned, onSelect));
    }
    branch.appendChild(parts);
  }
  return branch;
}

function renderItemButton(item: ItemDefinition, owned: boolean, onSelect: SelectItem): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = owned ? "tree-item owned" : "tree-item";
  button.title = owned ? `${item.name} (owned)` : `${item.name}: ${item.cost}g`;
  button.appendChild(createItemIconElement(item));
  button.addEventListener("click", () => onSelect(item));
  return button;
}
