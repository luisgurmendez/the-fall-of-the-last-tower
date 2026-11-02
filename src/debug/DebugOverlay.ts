/**
 * DebugOverlay - The debug mode: what the server thinks about each unit in
 * sight, drawn over the game (practice matches only). F3 or the Escape menu
 * turns it on and off.
 *
 * While it's on, the server sends a DEBUG_STATE about 10 times a second
 * (NetworkClient.sendDebug; server game/DebugReport.ts). Each unit gets its
 * hitbox, its attack range, the path it's walking, an arrow to what it's
 * attacking, a monster's leash and a label with its state (a bot's decision
 * first). The selected unit (left click, as in the game; with nothing
 * selected, the local champion) also gets its abilities' reach. The panel on
 * the left turns the layers on and off and lists the selected unit's details.
 */

import type { GameObject } from "@/core/GameObject";
import type GameContext from "@/core/gameContext";
import type { OnlineStateManager } from "@/core/OnlineStateManager";
import RenderElement from "@/render/renderElement";
import { Dimensions } from "@/core/canvas";
import type { NetworkClient } from "@siege/client";
import type { DebugStateData, DebugUnit, EntitySnapshot } from "@siege/shared";
import { DEFAULT_LAYERS, drawUnit, shortId, sideColor, unitName, type DebugLayers } from "./debugDraw";

const LAYER_LABELS: Record<keyof DebugLayers, string> = {
  paths: "Paths",
  targets: "Targets",
  hitboxes: "Hitboxes",
  ranges: "Attack ranges",
  sight: "Sight",
  leashes: "Leashes",
  labels: "States",
  abilities: "Abilities",
};

/** A DEBUG_STATE older than this (ms) shows as waiting for the server */
const STALE_MS = 1000;
/** How often the panel's text is rebuilt (ms) */
const PANEL_REFRESH_MS = 100;
/** A match's entity ID, as the server makes them ("game-1793..-0_e41") */
const ENTITY_ID = /\bgame-[\w-]+_\w+/g;

export class DebugOverlay implements GameObject {
  readonly id = "debug-overlay";

  private enabled = false;
  /** The server said this match has no debug (not a practice match) */
  private unavailable = false;
  private units = new Map<string, DebugUnit>();
  private lastState: DebugStateData | null = null;
  private receivedAt = 0;
  private readonly layers: DebugLayers = { ...DEFAULT_LAYERS };
  private selection: () => string | null = () => null;

  private panel: HTMLDivElement | null = null;
  private panelBody: HTMLDivElement | null = null;
  private panelRefreshedAt = 0;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "F3") return;
    event.preventDefault();
    this.toggle();
  };

  constructor(
    private readonly networkClient: NetworkClient,
    private readonly stateManager: OnlineStateManager,
  ) {
    window.addEventListener("keydown", this.onKeyDown);
  }

  /** Where the selected unit comes from (the input handler's left-click selection) */
  setSelectionSource(selection: () => string | null): void {
    this.selection = selection;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  toggle(): void {
    this.enabled = !this.enabled;
    this.networkClient.sendDebug(this.enabled);
    this.units.clear();
    this.lastState = null;
    this.unavailable = false;
    if (this.enabled) this.showPanel();
    else this.hidePanel();
  }

  /** A DEBUG_STATE from the server */
  receive(data: DebugStateData): void {
    if (!this.enabled) return;
    if (data.unavailable) {
      this.unavailable = true;
      this.refreshPanel();
      return;
    }
    this.lastState = data;
    this.receivedAt = performance.now();
    this.units = new Map(data.units.map(unit => [unit.entityId, unit]));
  }

  /** Remove it for good (the match is over) */
  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    if (this.enabled) this.networkClient.sendDebug(false);
    this.enabled = false;
    this.hidePanel();
  }

  step(): void {
    if (!this.enabled || performance.now() - this.panelRefreshedAt < PANEL_REFRESH_MS) return;
    this.refreshPanel();
  }

  render(): RenderElement {
    const element = new RenderElement((gameContext: GameContext) => {
      if (!this.enabled || this.units.size === 0) return;
      const { canvasRenderingContext: ctx, camera } = gameContext;
      const selectedId = this.selectedId();
      const positionOf = (entityId: string) => this.stateManager.getEntity(entityId)?.position;

      // Drawn after the fog and under the HUD, in world space
      ctx.save();
      ctx.translate(Dimensions.w / 2, Dimensions.h / 2);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(-camera.position.x, -camera.position.y);
      const dc = { ctx, zoom: camera.zoom, layers: this.layers, positionOf };
      for (const unit of this.units.values()) {
        const entity = this.stateManager.getEntity(unit.entityId);
        if (!entity || (entity.snapshot as { isDead?: boolean }).isDead) continue;
        drawUnit(dc, unit, entity.snapshot, entity.position, unit.entityId === selectedId);
      }
      ctx.restore();
    }, true);
    element.positionType = "overlay";
    return element;
  }

  /** The selected unit, else the local champion */
  private selectedId(): string | null {
    const selected = this.selection();
    if (selected && this.units.has(selected)) return selected;
    return this.stateManager.getLocalPlayerEntity()?.snapshot.entityId ?? null;
  }

  // ===========================================================================
  // Panel
  // ===========================================================================

  private showPanel(): void {
    if (this.panel) return;
    const panel = document.createElement("div");
    panel.className = "debug-panel";
    // Clicks on it stay off the game
    panel.addEventListener("mousedown", event => event.stopPropagation());

    const title = document.createElement("div");
    title.className = "debug-panel-title";
    title.innerHTML = "DEBUG <span>F3 to close</span>";

    const layers = document.createElement("div");
    layers.className = "debug-panel-layers";
    for (const key of Object.keys(LAYER_LABELS) as (keyof DebugLayers)[]) {
      const chip = document.createElement("button");
      chip.className = "debug-panel-chip";
      chip.textContent = LAYER_LABELS[key];
      chip.classList.toggle("on", this.layers[key]);
      chip.addEventListener("click", () => {
        this.layers[key] = !this.layers[key];
        chip.classList.toggle("on", this.layers[key]);
      });
      layers.append(chip);
    }

    const body = document.createElement("div");
    body.className = "debug-panel-body";

    panel.append(title, layers, body);
    document.body.append(panel);
    this.panel = panel;
    this.panelBody = body;
    this.refreshPanel();
  }

  private hidePanel(): void {
    this.panel?.remove();
    this.panel = null;
    this.panelBody = null;
  }

  private refreshPanel(): void {
    this.panelRefreshedAt = performance.now();
    const body = this.panelBody;
    if (!body) return;
    body.replaceChildren();

    const line = (text: string, className = "") => {
      const row = document.createElement("div");
      if (className) row.className = className;
      row.textContent = text;
      body.append(row);
      return row;
    };

    if (this.unavailable) {
      line("Debug only works in practice matches.", "debug-panel-warning");
      return;
    }
    if (!this.lastState || performance.now() - this.receivedAt > STALE_MS) {
      line("Waiting for the server...", "debug-panel-dim");
      return;
    }

    const minutes = Math.floor(this.lastState.gameTime / 60);
    const seconds = Math.floor(this.lastState.gameTime % 60).toString().padStart(2, "0");
    line(`${this.units.size} units in sight · tick ${this.lastState.tick} · ${minutes}:${seconds}`, "debug-panel-dim");

    const id = this.selectedId();
    const unit = id ? this.units.get(id) : undefined;
    const snapshot = id ? this.stateManager.getEntity(id)?.snapshot : undefined;
    if (!unit || !snapshot) {
      line("Left-click a unit to see what it's thinking.", "debug-panel-dim");
      return;
    }

    const name = line(unitName(snapshot), "debug-panel-name");
    name.style.color = sideColor(snapshot.side);
    line(shortId(unit.entityId), "debug-panel-dim");
    line(`state: ${unit.state}`);
    line(`target: ${this.describeTarget(unit.targetId)}`);
    const health = snapshot as EntitySnapshot & { health?: number; maxHealth?: number };
    if (health.health !== undefined && health.maxHealth) {
      line(`health: ${Math.round(health.health)} / ${Math.round(health.maxHealth)}`);
    }
    if (unit.path && unit.path.length > 0) {
      const entity = this.stateManager.getEntity(unit.entityId)!;
      let length = 0;
      let from = { x: entity.position.x, y: entity.position.y };
      for (const point of unit.path) {
        length += Math.hypot(point.x - from.x, point.y - from.y);
        from = point;
      }
      line(`path: ${unit.path.length} point${unit.path.length === 1 ? "" : "s"}, ${Math.round(length)} long`);
    }
    const reach = [`radius ${Math.round(unit.radius)}`];
    if (unit.attackRange) reach.push(`attack ${Math.round(unit.attackRange)}`);
    if (unit.sight) reach.push(`sight ${Math.round(unit.sight)}`);
    line(reach.join(" · "));
    if (unit.abilities && unit.abilities.length > 0) {
      line(unit.abilities.map(a => `${a.slot} ${a.range}${a.radius ? ` (area ${a.radius})` : ""}`).join(" · "));
    }
    for (const note of unit.notes ?? []) {
      // Notes name units by ID ("aggro on <id>"): their names read better
      line(`· ${note.replace(ENTITY_ID, id => this.describeTarget(id))}`, "debug-panel-note");
    }
  }

  private describeTarget(targetId: string | null | undefined): string {
    if (!targetId) return "none";
    const snapshot = this.stateManager.getEntity(targetId)?.snapshot;
    return snapshot ? `${unitName(snapshot)} (${shortId(targetId)})` : shortId(targetId);
  }
}
