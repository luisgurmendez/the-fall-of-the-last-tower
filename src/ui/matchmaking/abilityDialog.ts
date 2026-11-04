/**
 * Champion select's ability tooltips (abilityCards.ts): where one goes so it
 * stays on screen, and what a slot becomes while its ability is swapped
 * (Nocthar's colossus: ChampionDefinition.swapAbilities).
 */

import type { AbilitySlot, ChampionDefinition } from "@siege/shared";

/**
 * How far to move a tooltip shown above its icon so it stays inside what
 * shows it (`bounds`: the screen, or the box that clips it): down when it
 * goes over the top, left when it goes past the right edge (never past the
 * left one). And the height to cap it at when it's taller than that (it
 * scrolls then).
 */
export function fitDialog(
  dialog: { top: number; height: number; left: number; width: number },
  bounds: { top: number; bottom: number; left: number; right: number },
  margin: number,
): { shift: number; shiftX: number; maxHeight: number | null } {
  const room = bounds.bottom - bounds.top - margin * 2;
  const height = Math.min(dialog.height, room);
  // It hangs from its bottom (over the icon): capped, its top comes down
  const top = dialog.top + dialog.height - height;
  const shift = Math.max(0, bounds.top + margin - top);
  const overRight = dialog.left + dialog.width - (bounds.right - margin);
  const roomLeft = dialog.left - (bounds.left + margin);
  const shiftX = overRight > 0 ? -Math.min(overRight, Math.max(0, roomLeft)) : 0;
  return { shift, shiftX, maxHeight: dialog.height > room ? room : null };
}

/** What shows an element: the screen, cut to each box around it that clips (overflow) */
function visibleBounds(element: HTMLElement): { top: number; bottom: number; left: number; right: number } {
  const bounds = { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
  for (let box = element.parentElement; box; box = box.parentElement) {
    if (getComputedStyle(box).overflowY === "visible") continue;
    const rect = box.getBoundingClientRect();
    bounds.top = Math.max(bounds.top, rect.top);
    bounds.bottom = Math.min(bounds.bottom, rect.bottom);
    bounds.left = Math.max(bounds.left, rect.left);
    bounds.right = Math.min(bounds.right, rect.right);
  }
  return bounds;
}

/** What a slot becomes for a while, and when (null for a slot that's never swapped) */
export function swapFor(
  champion: Pick<ChampionDefinition, "swapAbilities" | "swapLabel">,
  slot: AbilitySlot,
): { label: string; abilityId: string } | null {
  const abilityId = champion.swapAbilities?.[slot];
  return abilityId ? { label: champion.swapLabel ?? "Swapped in", abilityId } : null;
}

/** Keep a card's tooltip in sight while it's shown (hover) */
export function keepDialogOnScreen(card: HTMLElement, dialog: HTMLElement, margin = 8): void {
  card.addEventListener("mouseenter", () => {
    dialog.style.transform = "";
    dialog.style.maxHeight = "";
    dialog.style.overflowY = "";
    // Shown by :hover; measured on the next frame, once it's laid out
    requestAnimationFrame(() => {
      const rect = dialog.getBoundingClientRect();
      const { shift, shiftX, maxHeight } = fitDialog(
        { top: rect.top, height: rect.height, left: rect.left, width: rect.width }, visibleBounds(card), margin);
      // Too tall for the screen: as tall as fits, and it scrolls (only then: it would clip the arrow)
      if (maxHeight !== null) {
        dialog.style.maxHeight = `${maxHeight}px`;
        dialog.style.overflowY = "auto";
      }
      if (shift > 0 || shiftX < 0) dialog.style.transform = `translate(${shiftX}px, ${shift}px)`;
      dialog.classList.toggle("moved", shift > 0 || shiftX < 0);
    });
  });
}
