/**
 * The practice tools on the client: their names and keys, and which toggles
 * are on (the server's PRACTICE_TOOLS events about the local champion;
 * gameEvents.ts). The panel (src/ui/PracticePanel.ts) shows them.
 *
 * Their keys are Shift + a letter, fixed like F3's debug: Shift doesn't
 * change what a key does in the game (keyBindings.ts), so these don't take
 * anything from the player's bindings. They only work in practice matches.
 */

import type { PracticeTool, PracticeToggles } from "@siege/shared";

export const PRACTICE_TOOL_INFO: Record<PracticeTool, { label: string; key: string }> = {
  level_up: { label: "Level up", key: "l" },
  max_level: { label: "Level 18", key: "m" },
  gold: { label: "+1000 gold", key: "g" },
  reset_cooldowns: { label: "Reset cooldowns", key: "c" },
  refill: { label: "Refill health and mana", key: "h" },
  teleport: { label: "Teleport", key: "t" },
  toggle_no_cooldowns: { label: "No cooldowns", key: "n" },
  toggle_invulnerable: { label: "Invulnerable", key: "i" },
  toggle_freeze_bots: { label: "Freeze bots", key: "b" },
};

const TOOL_BY_KEY = new Map(
  (Object.entries(PRACTICE_TOOL_INFO) as [PracticeTool, { key: string }][]).map(([tool, { key }]) => [key, tool]),
);

/** The tool a key press is (Shift + its letter, no other modifier), or null */
export function practiceToolForKey(event: {
  key: string;
  shiftKey: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}): PracticeTool | null {
  if (!event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.key.length !== 1) return null;
  return TOOL_BY_KEY.get(event.key.toLowerCase()) ?? null;
}

const ALL_OFF: PracticeToggles = { noCooldowns: false, invulnerable: false, freezeBots: false };

/** Which practice toggles are on, as the server last said */
export class PracticeTogglesStore {
  private toggles: PracticeToggles = { ...ALL_OFF };
  private readonly listeners = new Set<(toggles: PracticeToggles) => void>();

  get(): PracticeToggles {
    return { ...this.toggles };
  }

  set(toggles: PracticeToggles): void {
    this.toggles = { ...toggles };
    for (const listener of this.listeners) listener(this.get());
  }

  /** Hear each change; returns how to stop */
  subscribe(listener: (toggles: PracticeToggles) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/** The toggles a PRACTICE_TOOLS event says are on (anything but true is off) */
export function togglesFromEvent(data: Record<string, unknown>): PracticeToggles {
  return {
    noCooldowns: data.noCooldowns === true,
    invulnerable: data.invulnerable === true,
    freezeBots: data.freezeBots === true,
  };
}
