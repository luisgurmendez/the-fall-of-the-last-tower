/**
 * Cast modes: how a key press turns into a cast.
 *
 * - Quick cast: the press casts at the cursor (the game's original way).
 * - Quick cast with indicator: holding the key shows the ability's preview
 *   (its range and what it will hit); letting go casts it.
 * - Normal cast: the press shows the preview; a left-click casts it, and
 *   pressing the key again puts it away.
 *
 * In every mode, what isn't aimed (self casts, areas around the caster,
 * summoner spells and item actives on the champion) casts on the press, a
 * right-click or Escape drops the preview shown, and a left-click while one
 * shows casts it. An aimed ability that isn't ready shows nothing (the HUD
 * flashes its slot). Charged abilities (Vile's arrows) charge while held and
 * fire on the release in every mode (charging.ts).
 *
 * CastController keeps the one shown ("armed"); OnlineInputHandler feeds it
 * presses, releases and clicks and sends the casts it gives back.
 */

import {
  getRecastAbility,
  type AbilityDefinition,
  type AbilitySlot,
  type AbilityState,
  type AbilityTargetType,
  type ItemActiveData,
  type SummonerSpellDefinition,
} from "@siege/shared";

export type CastMode = "quick" | "quick_indicator" | "normal";

export const CAST_MODES: readonly { mode: CastMode; label: string; description: string }[] = [
  { mode: "quick", label: "Quick cast", description: "Press: cast at the cursor" },
  { mode: "quick_indicator", label: "Quick cast with indicator", description: "Hold: aim; release: cast" },
  { mode: "normal", label: "Normal cast", description: "Press: aim; left-click: cast" },
];

export function isCastMode(value: unknown): value is CastMode {
  return CAST_MODES.some(info => info.mode === value);
}

/** Something a key casts: an ability, a summoner spell or an item active */
export type Castable =
  | { kind: "ability"; slot: AbilitySlot }
  | { kind: "summoner"; slot: 0 | 1 }
  | { kind: "item"; slot: number };

export function sameCastable(a: Castable | null, b: Castable | null): boolean {
  return a !== null && b !== null && a.kind === b.kind && a.slot === b.slot;
}

/** What a press did */
export type PressOutcome =
  /** Cast now */
  | "cast"
  /** Its preview shows; it casts later */
  | "armed"
  /** Its preview was put away (normal cast, its key again) */
  | "disarmed"
  /** Nothing (aimed but not ready) */
  | "ignored";

export class CastController {
  private armed: Castable | null = null;
  /** The mode it was armed in: a change of mode drops it */
  private armedMode: CastMode | null = null;

  /** The castable whose preview shows, if any */
  getArmed(): Castable | null {
    return this.armed;
  }

  /** A castable's key went down */
  press(castable: Castable, { mode, aims, ready }: { mode: CastMode; aims: boolean; ready: boolean }): PressOutcome {
    this.dropIfModeChanged(mode);
    if (mode === "quick" || !aims) return "cast";
    if (!ready) return "ignored";
    if (mode === "normal" && sameCastable(this.armed, castable)) {
      this.disarm();
      return "disarmed";
    }
    this.armed = castable;
    this.armedMode = mode;
    return "armed";
  }

  /** A castable's key went up: whether to cast it now */
  release(castable: Castable, mode: CastMode): boolean {
    this.dropIfModeChanged(mode);
    if (mode !== "quick_indicator" || !sameCastable(this.armed, castable)) return false;
    this.disarm();
    return true;
  }

  /** A left-click: the castable to cast now (the one shown), if any */
  click(mode: CastMode): Castable | null {
    this.dropIfModeChanged(mode);
    const armed = this.armed;
    this.disarm();
    return armed;
  }

  /** Drop the one shown (a right-click, Escape, death): whether one was */
  cancel(): boolean {
    const had = this.armed !== null;
    this.disarm();
    return had;
  }

  private disarm(): void {
    this.armed = null;
    this.armedMode = null;
  }

  private dropIfModeChanged(mode: CastMode): void {
    if (this.armed !== null && this.armedMode !== mode) this.disarm();
  }
}

/** Target types cast at a point or a unit */
const AIMED_TARGET_TYPES: ReadonlySet<AbilityTargetType> = new Set([
  "skillshot",
  "ground_target",
  "target_enemy",
  "target_ally",
  "target_unit",
]);

function recasting(state: Partial<AbilityState> | undefined): boolean {
  return (state?.recastCount ?? 0) > 0 && (state?.recastWindowRemaining ?? 0) > 0;
}

/**
 * Whether the ability is aimed (cast at a point or a unit) as it would be
 * cast now: during its recast window, as its recast.
 */
export function abilityAims(definition: AbilityDefinition, state?: Partial<AbilityState>): boolean {
  const cast = recasting(state) ? getRecastAbility(definition)?.ability ?? definition : definition;
  // A toggle turns on or off where the champion is
  if (cast.toggle !== undefined) return false;
  return AIMED_TARGET_TYPES.has(cast.targetType);
}

/**
 * Whether the ability can be cast as far as the champion's snapshot says:
 * learned, and off cooldown, or with a charge left, or in its recast window
 * (mana is the server's call).
 */
export function abilityReady(state: Partial<AbilityState> | undefined): boolean {
  if ((state?.rank ?? 0) <= 0) return false;
  if (recasting(state)) return true;
  if (state?.charges !== undefined) return state.charges > 0;
  return state?.cooldownRemaining !== undefined && state.cooldownRemaining <= 0;
}

/** Whether a summoner spell is aimed (a point, an enemy, a monster) */
export function summonerAims(definition: SummonerSpellDefinition | undefined): boolean {
  return definition !== undefined && definition.target !== "self";
}

/** Whether an item's active is aimed (used at a point) */
export function itemAims(active: ItemActiveData | undefined): boolean {
  return active?.targeting === "point";
}
