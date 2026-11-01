/**
 * VFX lab (dev only): with the client dev server running, open
 * /vfx-lab.html. Every registered ability VFX plays on a loop in a grid over
 * the real GPU ground, its name under it, so effects can be tuned and
 * compared without a match. After them come every projectile in flight,
 * the zones and the champion auras (recall, jungle buffs, an overheated Oitboil).
 *
 * Query options: ?only=magnus (ids containing the text), ?zoom=1.4 (screen
 * pixels per world unit), ?period=2.5 (seconds between casts),
 * ?x=0&y=-700 (where on the map the grid sits), ?speed=0.25 (slow motion),
 * ?kind=projectile (or ability, zone, aura, orb), ?pause=0.6 (freeze 0.6 seconds
 * after the first cast, for a screenshot of that moment).
 */

import { getAllRegisteredVFX } from "@/vfx/VFXRegistry";
import { VFXManager } from "@/vfx/VFXManager";
import type { OnlineStateManager } from "@/core/OnlineStateManager";
import { getGPURenderer } from "@/gpu/GPURenderer";
import { emitProjectile, PROJECTILE_STYLES } from "@/gpu/fx/projectiles";
import { emitZone } from "@/gpu/fx/zones";
import { emitChampionAuras } from "@/gpu/fx/championAuras";
import { emitLightOrb, type LightOrbState } from "@/gpu/fx/lightOrb";
import { GameConfig } from "@siege/shared";

const params = new URLSearchParams(window.location.search);
const only = params.get("only");
const zoom = Number(params.get("zoom") ?? 1.0);
const period = Number(params.get("period") ?? 2.4);
const originX = Number(params.get("x") ?? -150);
const originY = Number(params.get("y") ?? -620);
const speed = Number(params.get("speed") ?? 1);
const onlyKind = params.get("kind");
const pauseAt = params.has("pause") ? Number(params.get("pause")) : null;
let firstCast: number | null = null;

// Slow motion: the effects read performance.now(), so the lab runs its own clock
const realNow = performance.now.bind(performance);
let labTime = realNow();
let lastReal = labTime;
performance.now = () => labTime;

const CELL_W = 360;
const CELL_H = 260;
/** How far from the caster each ability's target is */
const REACH = 170;

interface Cell {
  id: string;
  kind: "ability" | "projectile" | "zone" | "aura" | "orb";
  casterX: number;
  casterY: number;
  targetX: number;
  targetY: number;
}

const abilityIds = getAllRegisteredVFX().filter((id) => !only || id.includes(only)).sort();
const projectileIds = Object.keys(PROJECTILE_STYLES).filter((id) => !only || id.includes(only)).sort();
const ZONES = ["damage", "slow", "heal", "buff", "lava", "toxic_cloud"];
/** Zones drawn by the ability that left them, as a zone type and that ability */
const ABILITY_ZONES: Record<string, { zoneType: string; abilityId: string }> = {
  lava: { zoneType: "damage", abilityId: "calamitus_q" },
  toxic_cloud: { zoneType: "slow", abilityId: "zhakrul_w" },
};
const AURAS = ["recall", "crest_of_insight", "crest_of_cinders", "both_crests", "oitboil_overheated", "fenris_feral", "fenris_bloodthirst", "caelum_embolden", "protobot_learning", "hop_sugar_rush", "zhakrul_venom", "zhakrul_ancient_venom"];
const ORBS: LightOrbState[] = ["orbiting", "traveling", "stationed", "destroyed"];
const ids: Array<{ id: string; kind: Cell["kind"] }> = [
  ...abilityIds.map((id) => ({ id, kind: "ability" as const })),
  ...projectileIds.map((id) => ({ id, kind: "projectile" as const })),
  ...ZONES.filter((id) => !only || id.includes(only)).map((id) => ({ id, kind: "zone" as const })),
  ...AURAS.filter((id) => !only || id.includes(only)).map((id) => ({ id, kind: "aura" as const })),
  ...ORBS.map((state) => `orb_${state}`).filter((id) => !only || id.includes(only)).map((id) => ({ id, kind: "orb" as const })),
].filter((entry) => !onlyKind || entry.kind === onlyKind);

const canvas = document.getElementById("lab") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const columns = Math.max(1, Math.min(ids.length, Math.floor((window.innerWidth / zoom) / CELL_W)));
const cells: Cell[] = ids.map(({ id, kind }, index) => {
  const col = index % columns;
  const row = Math.floor(index / columns);
  const casterX = originX + (col - (columns - 1) / 2) * CELL_W - REACH / 2;
  const casterY = originY + row * CELL_H;
  return { id, kind, casterX, casterY, targetX: casterX + REACH, targetY: casterY };
});

// The VFX manager only asks the state manager where entities are
const entities = new Map<string, { position: { x: number; y: number }; snapshot: { entityId: string } }>();
for (const cell of cells) {
  entities.set(cell.id, { position: { x: cell.casterX, y: cell.casterY }, snapshot: { entityId: cell.id } });
}
const stateManager = { getEntity: (id: string) => entities.get(id) } as unknown as OnlineStateManager;
const vfx = new VFXManager(stateManager);

let lastCast = -Infinity;
let lastFrame = performance.now();
let cameraY = originY + ((Math.ceil(cells.length / columns) - 1) * CELL_H) / 2;

window.addEventListener("wheel", (event) => {
  cameraY += event.deltaY / zoom;
});

function frame(): void {
  const real = realNow();
  const frozen = pauseAt !== null && firstCast !== null && labTime - firstCast >= pauseAt * 1000;
  // Small steps up to the pause, so particles move as they would
  labTime += frozen ? 0 : Math.min((real - lastReal) * speed, pauseAt !== null ? 16 : Infinity);
  lastReal = real;
  const now = labTime;
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  if (now - lastCast > period * 1000 && !frozen) {
    lastCast = now;
    firstCast ??= now;
    for (const cell of cells) {
      if (cell.kind === "ability") vfx.spawnAbilityVFX(cell.id, cell.casterX, cell.casterY, cell.targetX, cell.targetY, cell.id);
    }
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(zoom, 0, 0, zoom, canvas.width / 2 - originX * zoom, canvas.height / 2 - cameraY * zoom);

  const gpu = getGPURenderer();
  if (!gpu) {
    ctx.fillStyle = "#fff";
    ctx.fillText("No WebGL2", 20, 20);
    return;
  }
  gpu.drawGround(ctx);

  vfx.update(dt);
  vfx.emitGround(gpu.groundFx);
  // Zones run for 5 seconds; auras cycle a recall from start to end
  const seconds = now / 1000;
  for (const cell of cells) {
    const x = cell.casterX + REACH / 2;
    if (cell.kind === "orb") {
      // Orbiting circles the caster, traveling goes back and forth, the rest stay put
      const state = cell.id.slice(4) as LightOrbState;
      const ox = state === "orbiting" ? cell.casterX + Math.cos(seconds * 2) * 60 : state === "traveling" ? cell.casterX + (Math.sin(seconds * 2) * 0.5 + 0.5) * REACH : x;
      const oy = state === "orbiting" ? cell.casterY + Math.sin(seconds * 2) * 60 : cell.casterY;
      emitLightOrb(gpu.topFx, cell.id, state, ox, oy, seconds, 0);
    } else if (cell.kind === "zone") {
      emitZone(gpu.groundFx, gpu.topFx, { entityId: cell.id, radius: 110, ...(ABILITY_ZONES[cell.id] ?? { zoneType: cell.id }), totalDuration: 5, remainingDuration: 5 - (seconds % 5) }, x, cell.casterY, seconds);
    } else if (cell.kind === "aura") {
      const recall = GameConfig.TIMING.RECALL_DURATION;
      const crests = cell.id === "both_crests" ? ["crest_of_insight", "crest_of_cinders"]
        : cell.id === "zhakrul_ancient_venom" ? ["zhakrul_venom", "zhakrul_ancient_venom"] : [cell.id];
      emitChampionAuras(gpu.groundFx, gpu.topFx, {
        isRecalling: cell.id === "recall",
        recallProgress: seconds % recall,
        activeEffects: crests.map((definitionId) => ({ definitionId, stacks: cell.id === "zhakrul_ancient_venom" ? 3 : 1 })),
      }, x, cell.casterY, seconds);
    }
  }
  gpu.drawFX(ctx, "ground");

  // Casters and targets
  for (const cell of cells) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(cell.casterX, cell.casterY + 14, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8e8f0";
    ctx.fillRect(cell.casterX - 5, cell.casterY - 18, 10, 30);
    if (cell.kind === "ability") {
      ctx.strokeStyle = "rgba(255, 80, 80, 0.7)";
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.moveTo(cell.targetX - 5, cell.targetY - 5);
      ctx.lineTo(cell.targetX + 5, cell.targetY + 5);
      ctx.moveTo(cell.targetX + 5, cell.targetY - 5);
      ctx.lineTo(cell.targetX - 5, cell.targetY + 5);
      ctx.stroke();
    }
  }

  vfx.emitTop(gpu.topFx);
  // Projectiles fly from the caster to the target at game speed, again and again
  const flight = ((now / 1000) % 0.25) / 0.25;
  for (const cell of cells) {
    if (cell.kind !== "projectile") continue;
    const x = cell.casterX - REACH * 0.5 + REACH * 2 * flight;
    emitProjectile(gpu.topFx, `${cell.id}:${Math.floor(now / 250)}`, cell.id, x, cell.casterY, 0, now / 1000, 0);
  }
  gpu.drawFX(ctx, "top");
  vfx.renderScreenFlash(ctx);

  ctx.font = `${Math.round(11 / zoom * 1.2)}px monospace`;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  for (const cell of cells) ctx.fillText(cell.id, cell.casterX + REACH / 2, cell.casterY + 70);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
