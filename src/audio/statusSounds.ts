/**
 * A short chip sound when crowd control or a slow lands on our champion, so
 * it's heard as well as seen (the marks: crowdControl.ts, statusMarks.ts).
 * Played on the ui bus, like the menus' blips (ChiptunePlayer.blip).
 */

import { crowdControlKindOf } from "@/render/overlays/crowdControl";
import { statusMarkOf } from "@/render/overlays/statusMarks";
import type { UiSoundDef } from "./uiSounds";

export type StatusSound = "stun" | "knockup" | "root" | "silence" | "fear" | "taunt" | "slow";

/** Strongest first: when several land at once, they sound in this order */
const ORDER: StatusSound[] = ["stun", "knockup", "taunt", "fear", "root", "silence", "slow"];

export const STATUS_SOUNDS: Record<StatusSound, UiSoundDef> = {
  // Dizzy: a fast wobble
  stun: { notes: [["G5", 0.04], ["E5", 0.04], ["G5", 0.04], ["E5", 0.06]], wave: "square", gain: 0.07 },
  // Thrown up
  knockup: { notes: [["C5", 0.04], ["G5", 0.04], ["C6", 0.06]], wave: "pulse25", gain: 0.07 },
  // Angry, twice
  taunt: { notes: [["D5", 0.05], ["A4", 0.02], ["D5", 0.06]], wave: "square", gain: 0.07 },
  // Ghostly
  fear: { notes: [["B4", 0.06], ["F4", 0.06], ["B4", 0.08]], wave: "pulse12", gain: 0.08 },
  // A low thud, held
  root: { notes: [["C3", 0.06], ["G2", 0.12]], wave: "square", gain: 0.08 },
  // Muffled
  silence: { notes: [["E5", 0.04], ["D5", 0.09]], wave: "pulse12", gain: 0.07 },
  // Sinking
  slow: { notes: [["E5", 0.05], ["C5", 0.05], ["A4", 0.08]], wave: "pulse25", gain: 0.06 },
};

interface Effect {
  definitionId: string;
  timeRemaining: number;
}

/** The sound an effect makes landing, if any */
function soundOf(effectId: string): StatusSound | null {
  const kind = crowdControlKindOf(effectId);
  if (kind === "stun" || kind === "suppress" || kind === "stasis") return "stun";
  if (kind === "knockup" || kind === "root" || kind === "silence" || kind === "fear" || kind === "taunt") return kind;
  if (kind === "blind" || kind === "disarm") return "silence";
  return statusMarkOf(effectId) === "slow" ? "slow" : null;
}

/** The sounds of what newly landed on our champion (each once, strongest first) */
export function newStatusSounds(previous: Effect[] | undefined, next: Effect[] | undefined): StatusSound[] {
  const before = new Set((previous ?? []).filter(effect => effect.timeRemaining > 0).map(effect => soundOf(effect.definitionId)));
  const sounds = new Set<StatusSound>();
  for (const effect of next ?? []) {
    if (effect.timeRemaining <= 0) continue;
    const sound = soundOf(effect.definitionId);
    if (sound && !before.has(sound)) sounds.add(sound);
  }
  return ORDER.filter(sound => sounds.has(sound));
}
