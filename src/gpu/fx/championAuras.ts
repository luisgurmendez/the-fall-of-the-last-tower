/**
 * What a champion shows on the ground around it, on the GPU: the recall
 * channel (a circle that draws itself in as the recall goes, light rising
 * from it) and the jungle buffs it holds (a blue ring with orbiting motes
 * for Crest of Insight, a flickering red-orange one with embers for Crest
 * of Cinders), so everyone can see who has them.
 */

import { GameConfig } from "@siege/shared";
import { fxColor, type FXBatch } from "./FXBatch";

const RECALL = fxColor("#4fc3f7");
const RECALL_LIGHT = fxColor("#b3e5fc");
const INSIGHT = fxColor("#4fc3f7");
const CINDERS = fxColor("#ff7043");
const EMBER = fxColor("#ffab40");

/** Feet are a little below a champion's position */
const FEET = 18;

export interface ChampionAuraSnapshot {
  isRecalling?: boolean;
  recallProgress?: number;
  activeEffects?: Array<{ definitionId: string }>;
}

/**
 * Add a champion's ground effects: rings and circles to `ground`, what
 * rises or circles above them to `top`.
 */
export function emitChampionAuras(ground: FXBatch, top: FXBatch, champion: ChampionAuraSnapshot, x: number, y: number, time: number): void {
  const feetY = y + FEET;

  if (champion.isRecalling) {
    const progress = Math.min(1, (champion.recallProgress ?? 0) / GameConfig.TIMING.RECALL_DURATION);
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
  if (hasCinders) {
    for (let i = 0; i < 5; i++) {
      const phase = (time * 0.7 + i / 5) % 1;
      top.glow(x + Math.sin(i * 2.4 + time * 2) * 20, feetY - 2 - phase * 46, 4, EMBER, 1.5 * (1 - phase), 0.5, 0.6, 0.8, i);
    }
  }
}
