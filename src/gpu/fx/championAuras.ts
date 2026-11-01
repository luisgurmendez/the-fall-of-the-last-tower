/**
 * What a champion shows on the ground around it, on the GPU: the recall
 * channel (a circle that draws itself in as the recall goes, light rising
 * from it) and the jungle buffs it holds (a blue ring with orbiting motes
 * for Crest of Insight, a flickering red-orange one with embers for Crest
 * of Cinders), so everyone can see who has them; Oitboil on fire while
 * he's overheated; Fenris's red rage, feral or in his bloodthirst; the
 * glow of Caelum's blessing on whoever he emboldened; Protobot's circuit
 * while he's learned something; Hop-To-Eat's sugar rush; and Zhak'rul's
 * venom on whoever he poisoned, ancient at three doses.
 */

import { recallElapsed } from "@/core/state/recallClock";
import { GameConfig } from "@siege/shared";
import { fxColor, type FXBatch } from "./FXBatch";

const RECALL = fxColor("#4fc3f7");
const RECALL_LIGHT = fxColor("#b3e5fc");
const INSIGHT = fxColor("#4fc3f7");
const CINDERS = fxColor("#ff7043");
const EMBER = fxColor("#ffab40");
const OVERHEAT = fxColor("#ff6a1a");
const OVERHEAT_HOT = fxColor("#ffc04a");
const RAGE = fxColor("#e02a2a");
const BLOOD = fxColor("#8a0a14");
const BLESSING = fxColor("#a8e070");
const BLESSING_LIGHT = fxColor("#fff2a8");
const CIRCUIT = fxColor("#4ae0ff");
const SUGAR = fxColor("#ff8ab8");
const VENOM = fxColor("#8be04a");
const VENOM_LIGHT = fxColor("#d4ff8a");
const VENOM_DARK = fxColor("#3f8a1e");

/** Feet are a little below a champion's position */
const FEET = 18;

export interface ChampionAuraSnapshot {
  /** Without one (the VFX lab), recallProgress is taken as is */
  entityId?: string;
  isRecalling?: boolean;
  recallProgress?: number;
  activeEffects?: Array<{ definitionId: string; stacks?: number }>;
}

/**
 * Add a champion's ground effects: rings and circles to `ground`, what
 * rises or circles above them to `top`.
 */
export function emitChampionAuras(ground: FXBatch, top: FXBatch, champion: ChampionAuraSnapshot, x: number, y: number, time: number): void {
  const feetY = y + FEET;

  const recalled = champion.entityId
    ? recallElapsed(champion.entityId, champion.isRecalling, champion.recallProgress, time)
    : champion.recallProgress ?? 0;
  if (champion.isRecalling) {
    const progress = Math.min(1, recalled / GameConfig.TIMING.RECALL_DURATION);
    ground.sigil(x, feetY, 50, RECALL, 1.1, progress, 0.8, 18, 1, 1, 0.3);
    ground.glow(x, feetY, 75, RECALL, 0.25 + progress * 0.35, 0, 0);
    top.beam(x, feetY - 40 - progress * 120, x, feetY, 6 + progress * 10, RECALL_LIGHT, 0.3 + progress * 0.6, 0.2, 6, 0.06, 0.4);
    const motes = 6 + Math.floor(progress * 10);
    for (let i = 0; i < motes; i++) {
      const phase = (time * 0.8 + i / motes) % 1;
      const angle = (i / motes) * Math.PI * 2 + time;
      top.glow(x + Math.cos(angle) * 28, feetY + Math.sin(angle) * 12 - phase * 70, 4, RECALL_LIGHT, 1.4 * (1 - phase), 0.5, 0.6);
    }
  }

  const effects = champion.activeEffects;
  if (!effects) return;
  const hasInsight = effects.some((effect) => effect.definitionId === "crest_of_insight");
  const hasCinders = effects.some((effect) => effect.definitionId === "crest_of_cinders");
  const rings: Array<{ color: typeof INSIGHT; radius: number; speed: number }> = [];
  if (hasInsight) rings.push({ color: INSIGHT, radius: 40, speed: 1.6 });
  if (hasCinders) rings.push({ color: CINDERS, radius: hasInsight ? 50 : 40, speed: -2.2 });

  for (const ring of rings) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 3 + ring.radius);
    ground.ring(x, feetY, ring.radius, 2.5, ring.color, 0.8 + pulse * 0.4, 0.3, 0.4, ring.radius);
    for (let i = 0; i < 3; i++) {
      const angle = time * ring.speed + (i * Math.PI * 2) / 3;
      const at = (a: number) => ({ x: x + Math.cos(a) * ring.radius, y: feetY + Math.sin(a) * ring.radius * 0.5 });
      const step = -Math.sign(ring.speed) * 0.15;
      top.ribbon([at(angle + step * 3), at(angle + step * 2), at(angle + step), at(angle)], 3, ring.color, 1.2);
      top.glow(at(angle).x, at(angle).y, 7, ring.color, 1.3, 0.4, 0.6);
    }
  }
  if (effects.some((effect) => effect.definitionId === "oitboil_overheated")) {
    // Ablaze: a hot glow under him and flames licking up his body
    const pulse = 0.5 + 0.5 * Math.sin(time * 9);
    ground.glow(x, feetY, 64, OVERHEAT, 0.8 + pulse * 0.4, 0, 0, 0.6, 0.3);
    for (let i = 0; i < 8; i++) {
      const age = 0.15 + 0.85 * ((time * (1.1 + (i % 3) * 0.2) + i * 0.37) % 1);
      const side = ((i * 2.4) % 2) - 1;
      top.flame(x + side * 20, feetY - 6 - (i % 4) * 12 - age * 18, 13 + (i % 3) * 4, i % 2 ? OVERHEAT_HOT : OVERHEAT, 1.4, age, 0.4, 3, i * 0.13, 1);
    }
  }
  const feral = effects.some((effect) => effect.definitionId === "fenris_feral");
  const bloodthirst = effects.some((effect) => effect.definitionId === "fenris_bloodthirst");
  if (feral || bloodthirst) {
    // A red glow under him, throbbing faster in his bloodthirst, and red
    // wisps rising off him
    const pulse = 0.5 + 0.5 * Math.sin(time * (bloodthirst ? 10 : 5));
    ground.glow(x, feetY, bloodthirst ? 70 : 54, RAGE, (bloodthirst ? 0.9 : 0.55) + pulse * 0.35, 0, 0, 0.5, 0.7);
    if (bloodthirst) ground.ring(x, feetY, 46, 3, BLOOD, 1.0 + pulse * 0.4, 0.7, 0.3, 0.2);
    const wisps = bloodthirst ? 7 : 4;
    for (let i = 0; i < wisps; i++) {
      const phase = (time * 0.9 + i / wisps) % 1;
      top.glow(x + Math.sin(i * 2.1 + time * 2.5) * 22, feetY - 8 - phase * 60, 5, i % 2 ? RAGE : BLOOD, 1.4 * (1 - phase), 0.4, 0.3, 0.6, i);
    }
  }
  if (effects.some((effect) => effect.definitionId === "caelum_embolden")) {
    // Blessed: a soft green-gold glow and leaves of light circling up
    ground.glow(x, feetY, 50, BLESSING, 0.6 + 0.2 * Math.sin(time * 4), 0, 0, 0.3, 0.5);
    for (let i = 0; i < 4; i++) {
      const angle = time * 2 + (i * Math.PI) / 2;
      const phase = (time * 0.6 + i / 4) % 1;
      top.glow(x + Math.cos(angle) * 24, feetY + Math.sin(angle) * 10 - phase * 50, 4, i % 2 ? BLESSING : BLESSING_LIGHT, 1.3 * (1 - phase), 0.5, 0.6, 0.6, i);
    }
  }
  if (effects.some((effect) => effect.definitionId === "protobot_learning")) {
    // Learning: a cyan circuit ring at his feet, a spark running round it
    const angle = time * 3;
    ground.ring(x, feetY, 44, 2, CIRCUIT, 0.7 + 0.2 * Math.sin(time * 6), 0.4, 0.3, 44);
    top.glow(x + Math.cos(angle) * 44, feetY + Math.sin(angle) * 22, 5, CIRCUIT, 1.4, 0.5, 0.7);
  }
  if (effects.some((effect) => effect.definitionId === "hop_sugar_rush")) {
    // Sugar rush: pink sparkles bouncing off it
    for (let i = 0; i < 4; i++) {
      const phase = (time * 1.4 + i / 4) % 1;
      top.glow(x + Math.sin(i * 1.9 + time * 3) * 18, feetY - 10 - Math.sin(phase * Math.PI) * 40, 4, SUGAR, 1.4 * (1 - phase * 0.6), 0.5, 0.6, 0.6, i);
    }
  }
  const venom = effects.find((effect) => effect.definitionId === "zhakrul_venom");
  if (venom) {
    // Poisoned: green bubbles rising off it, more for each dose; ancient, a
    // sickly glow at its feet too
    const ancient = effects.some((effect) => effect.definitionId === "zhakrul_ancient_venom");
    const doses = Math.max(1, Math.min(3, venom.stacks ?? 1));
    if (ancient) ground.glow(x, feetY, 48, VENOM_DARK, 0.75 + 0.25 * Math.sin(time * 5), 0, 0, 0.5, 0.9);
    const bubbles = doses * 2 + (ancient ? 3 : 0);
    for (let i = 0; i < bubbles; i++) {
      const phase = (time * 0.8 + i / bubbles) % 1;
      top.glow(x + Math.sin(i * 2.7 + time * 1.5) * 16, feetY - 14 - phase * 48, ancient ? 5 : 4, i % 2 ? VENOM : VENOM_LIGHT, 1.3 * (1 - phase), 0.5, 0.5, 0.6, i);
    }
  }
  if (hasCinders) {
    for (let i = 0; i < 5; i++) {
      const phase = (time * 0.7 + i / 5) % 1;
      top.glow(x + Math.sin(i * 2.4 + time * 2) * 20, feetY - 2 - phase * 46, 4, EMBER, 1.5 * (1 - phase), 0.5, 0.6, 0.8, i);
    }
  }
}
