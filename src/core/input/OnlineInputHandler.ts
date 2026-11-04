/**
 * OnlineInputHandler - Captures player input and sends to server.
 *
 * Handles:
 * - Right-click: Move to position
 * - Q/W/E/R: Ability cast (a charge ability charges while held; one that
 *   can't move while charging stops the champion and holds move orders, see
 *   charging.ts), as the player's cast mode says (castModes.ts: on the
 *   press, on the release, or on a left-click after the press)
 * - S: Stop
 * Every key is the player's binding (controls.ts); the defaults are the
 * keys named here.
 * - Click on enemy: Target unit
 * - Cursor icons: Attack cursor when hovering enemies
 * - Visual feedback: Enemy hover ellipse, move markers
 */

import type { GameObject } from "@/core/GameObject";
import type GameContext from "@/core/gameContext";
import { InputManager, MouseButton } from "@/core/input/InputManager";
import Vector from "@/physics/vector";
import type { NetworkClient } from "@siege/client";
import { isPingModifierDown } from "@/ui/SignalWheel";
import type { AbilitySlot } from "@siege/shared";
import { EntityType, GameConfig, MOBAConfig, SUMMONER_SPELLS, getAbilityDefinition, getChampionDefinition, hasChargeBehavior, isSummonerSpellId, type AbilityState, type EquippedItemState, type SummonerSpellState, type WardType } from "@siege/shared";
import type {
  OnlineStateManager,
  InterpolatedEntity,
} from "@/core/OnlineStateManager";
import { getCursorManager } from "@/core/CursorManager";
import { pickScore } from "@/core/input/picking";
import RenderElement from "@/render/renderElement";
import { renderWardPreview } from "@/render/entities/ward";
import { Dimensions } from "@/core/canvas";
import { blocksMovement, chargeProgress, chargeTime, startCharge, type ChargeState } from "@/core/input/charging";
import { getControls } from "@/core/input/controls";
import { abilityAction, itemAction, summonerAction, type ControlAction } from "@/core/input/keyBindings";
import { CastController, abilityAims, abilityReady, itemAims, summonerAims, type Castable } from "@/core/input/castModes";
import { getItemActive } from "@/data/itemStats";
import { isTypingTarget } from "@/core/state/chat";

const ABILITY_SLOTS: AbilitySlot[] = ["Q", "W", "E", "R"];
const SUMMONER_SLOTS: (0 | 1)[] = [0, 1];
const ITEM_SLOTS = [0, 1, 2, 3, 4, 5];

/** Ward actions: a stealth ward (the trinket), a control ward */
const WARD_ACTIONS: [ControlAction, WardType][] = [["ward", "stealth"], ["control_ward", "control"]];

/** Escape only drops a preview for a handler that stepped this recently (ms): not one left from an earlier match */
const ESCAPE_WINDOW_MS = 1000;

/** Entity types that can be attacked (for cursor hover) */
/**
 * A jungle tunnel's mouth answers the cursor within this ellipse around it
 * (its burrow as drawn: the hole and its mound, seen a little from above)
 */
const TUNNEL_MOUTH_HALF_WIDTH = 30;
const TUNNEL_MOUTH_HALF_HEIGHT = 22;

/** The mouths of the active map's jungle tunnels */
function tunnelMouths(): { x: number; y: number }[] {
  return MOBAConfig.TUNNELS.LIST.flatMap(({ a, b }) => [a, b]);
}

const ATTACKABLE_ENTITY_TYPES: Set<number> = new Set([
  EntityType.CHAMPION,
  EntityType.MINION,
  EntityType.TOWER,
  EntityType.INHIBITOR,
  EntityType.NEXUS,
  EntityType.JUNGLE_CAMP,
]);

/** Entity types that can be targeted as allies */
const ALLY_TARGETABLE_ENTITY_TYPES: Set<number> = new Set([
  0, // EntityType.CHAMPION
  1, // EntityType.MINION
]);

/** Move marker: a ring on the ground closing in on the point, with arrows converging on it */
const MOVE_MARKER_CONFIG = {
  ANIMATION_DURATION: 0.45, // seconds
  /** Ring radius at the start and at the end (world units) */
  START_RADIUS: 20,
  END_RADIUS: 6,
  /** The ground is seen at an angle: rings are this much flatter than wide */
  FLATTEN: 0.55,
  MOVE_COLOR: "#7CFC8A",
  ATTACK_MOVE_COLOR: "#FF5A4E",
};

/** Active move marker instance */
interface MoveMarker {
  position: Vector;
  startTime: number;
  /** Attack-move markers are tinted red */
  attackMove?: boolean;
}

/** Hovered entity info for rendering */
interface HoveredEntityInfo {
  position: Vector;
  pulseTime: number;
  isAlly: boolean;
  collisionRadius: number;
}

/** Get collision radius based on entity type */
function getEntityCollisionRadius(entity: InterpolatedEntity): number {
  const snapshot = entity.snapshot as any;
  const entityType = snapshot.entityType;

  // EntityType.CHAMPION = 0
  if (entityType === 0) {
    return 25; // Default champion radius
  }

  // EntityType.MINION = 1
  if (entityType === 1) {
    const minionType = snapshot.minionType || "melee";
    switch (minionType) {
      case "melee":
        return 12;
      case "caster":
        return 10;
      case "siege":
        return 18;
      case "super":
        return 22;
      // Nocthar's summons, as big as they're drawn
      case "hollow":
        return 11 * (snapshot.scale ?? 1);
      case "colossus":
        return 24 * (snapshot.scale ?? 1);
      default:
        return 12;
    }
  }

  // EntityType.TOWER = 2
  if (entityType === 2) {
    return 50;
  }

  // EntityType.JUNGLE_CAMP = 5
  if (entityType === 5) {
    return 15; // Default jungle creature radius
  }

  // Default
  return 25;
}

/**
 * OnlineInputHandler captures input and sends commands to server.
 */
export class OnlineInputHandler implements GameObject {
  readonly id = "online-input-handler";
  shouldInitialize = true;
  shouldDispose = false;
  position = new Vector(0, 0);

  private networkClient: NetworkClient;
  private stateManager: OnlineStateManager;
  private localSide: number;
  private inputManager: InputManager;

  /** Currently hovered enemy entity ID */
  private hoveredEnemyId: string | null = null;

  /** Currently hovered ally entity ID */
  private hoveredAllyId: string | null = null;

  /** Currently hovered entity info for rendering */
  private hoveredEntityInfo: HoveredEntityInfo | null = null;

  /** The jungle tunnel mouth under the cursor (when no unit is): a right-click goes in */
  private hoveredTunnelMouth: { x: number; y: number } | null = null;

  /** Active move markers */
  private moveMarkers: MoveMarker[] = [];

  /** Animation time tracking */
  private lastUpdateTime = 0;

  /** Current ability being charged (null if none) */
  private chargeState: ChargeState | null = null;

  /** Champion ID for ability lookups */
  private championId: string = "warrior";

  /** Converts minimap clicks to world positions */
  private minimapLocator: ((screenX: number, screenY: number) => Vector | null) | null = null;

  /** Callback for charge state updates (for HUD) */
  private onChargeStateChange: ((state: { slot: AbilitySlot; progress: number } | null) => void) | null = null;

  /** Callback for hover state updates (for EntityRenderer sprite outlines) */
  private onHoverStateChange: ((enemyId: string | null, allyId: string | null) => void) | null = null;

  /** Currently selected entity ID (for target info HUD) */
  private selectedEntityId: string | null = null;

  /** Callback for selection state updates (for TargetInfoHUD) */
  private onSelectionChange: ((entityId: string | null) => void) | null = null;

  /** The ability, summoner spell or item whose preview shows (cast modes other than quick cast) */
  private readonly casts = new CastController();

  /** Callback for the ability whose preview shows (for the HUD) */
  private onArmedAbilityChange: ((slot: AbilitySlot | null) => void) | null = null;

  /** Whether a screen position is over the HUD or the minimap (a click there casts nothing) */
  private pointerOverUI: ((x: number, y: number) => boolean) | null = null;

  /** When it last stepped (ms) */
  private lastStepAt = 0;

  /** Escape drops the preview shown before the menu hears it */
  private readonly onEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || isTypingTarget(event.target) || performance.now() - this.lastStepAt > ESCAPE_WINDOW_MS) return;
    if (this.casts.cancel()) event.stopImmediatePropagation();
  };

  /** A change of settings drops the preview shown */
  private readonly unsubscribeControls: () => void;

  constructor(
    networkClient: NetworkClient,
    stateManager: OnlineStateManager,
    localSide: number,
    championId: string = "warrior",
  ) {
    this.networkClient = networkClient;
    this.stateManager = stateManager;
    this.localSide = localSide;
    this.championId = championId;
    this.inputManager = InputManager.getInstance();
    // Capture: before OnlineGame's Escape opens the menu
    window.addEventListener("keydown", this.onEscape, true);
    this.unsubscribeControls = getControls().subscribe(() => this.casts.cancel());
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onEscape, true);
    this.unsubscribeControls();
  }

  /** The key bound to an action */
  private key(action: ControlAction): string {
    return getControls().keyFor(action);
  }

  /**
   * Set callback for the ability whose preview shows until it's cast (for
   * the HUD to draw it).
   */
  setArmedAbilityCallback(callback: (slot: AbilitySlot | null) => void): void {
    this.onArmedAbilityChange = callback;
  }

  /** Set how to tell the pointer is over the HUD or the minimap */
  setPointerOverUI(test: (x: number, y: number) => boolean): void {
    this.pointerOverUI = test;
  }

  /** The ability whose preview shows, if one does */
  getArmedAbility(): AbilitySlot | null {
    const armed = this.casts.getArmed();
    return armed?.kind === "ability" ? armed.slot : null;
  }

  /**
   * Set the champion ID for ability lookups.
   */
  setChampionId(championId: string): void {
    this.championId = championId;
  }

  /**
   * Set how to turn a screen position over the minimap into a world position
   * (returns null when the position isn't over the minimap).
   */
  setMinimapLocator(locator: (screenX: number, screenY: number) => Vector | null): void {
    this.minimapLocator = locator;
  }

  /**
   * Set callback for charge state updates (for HUD).
   */
  setChargeStateCallback(callback: (state: { slot: AbilitySlot; progress: number } | null) => void): void {
    this.onChargeStateChange = callback;
  }

  /**
   * Set callback for hover state updates (for EntityRenderer sprite outlines).
   */
  setHoverStateCallback(callback: (enemyId: string | null, allyId: string | null) => void): void {
    this.onHoverStateChange = callback;
  }

  /**
   * Set callback for selection state updates (for TargetInfoHUD).
   */
  setSelectionCallback(callback: (entityId: string | null) => void): void {
    this.onSelectionChange = callback;
  }

  /**
   * Get the currently selected entity ID.
   */
  getSelectedEntityId(): string | null {
    return this.selectedEntityId;
  }

  /**
   * Get current charge progress (0-1) for UI display.
   * Returns null if not charging.
   */
  getChargeProgress(): { slot: AbilitySlot; progress: number } | null {
    if (!this.chargeState) return null;
    return { slot: this.chargeState.slot, progress: chargeProgress(this.chargeState, performance.now() / 1000) };
  }

  /**
   * Check if currently charging an ability.
   */
  isCharging(): boolean {
    return this.chargeState !== null;
  }

  init(_ctx: GameContext): void {
    // Nothing to initialize
  }

  step(ctx: GameContext): void {
    if (ctx.isPaused) return;
    this.lastStepAt = performance.now();

    const { camera } = ctx;

    // Update move markers (remove expired ones)
    this.updateMoveMarkers();

    // Update cursor based on hover state
    this.updateHoveredEnemy(camera);

    // Update charge state callback for HUD
    if (this.onChargeStateChange) {
      this.onChargeStateChange(this.getChargeProgress());
    }

    // Dead, nothing shown can be cast
    if ((this.stateManager.getLocalPlayerEntity()?.snapshot as { isDead?: boolean } | undefined)?.isDead) {
      this.casts.cancel();
    }

    // Clicks on the minimap are about map positions, not what's under the cursor in the world
    const mousePosition = this.inputManager.getMousePosition();
    const minimapTarget = this.minimapLocator?.(mousePosition.x, mousePosition.y) ?? null;

    // A charge that can't move holds move and attack orders until it's let go
    const holdingStill = blocksMovement(this.chargeState);

    // A right-click drops the preview shown (and still moves)
    if (this.inputManager.isMouseButtonJustPressed(MouseButton.RIGHT)) this.casts.cancel();

    // A left-click with the ping key held pings (SignalWheel)
    const pinging = isPingModifierDown(this.inputManager);

    // A left-click in the world while a preview shows casts it (not on the HUD or the minimap)
    let leftClick = this.inputManager.isMouseButtonJustPressed(MouseButton.LEFT);
    if (leftClick && !pinging && !minimapTarget && this.casts.getArmed() && !this.pointerOverUI?.(mousePosition.x, mousePosition.y)) {
      const castable = this.casts.click(getControls().getCastMode());
      if (castable) {
        this.cast(castable, camera);
        leftClick = false;
      }
    }

    // Handle right-click movement or attack
    if (!holdingStill && this.inputManager.isMouseButtonJustPressed(MouseButton.RIGHT)) {
      const worldPos = minimapTarget ?? this.screenToWorld(mousePosition, camera);

      // If hovering an enemy, send target attack instead of move
      if (this.hoveredEnemyId && !minimapTarget) {
        this.networkClient.sendTargetUnitInput(this.hoveredEnemyId);
      } else if (this.hoveredTunnelMouth && !minimapTarget) {
        // A tunnel's mouth: walk to its very center, which the server takes as going in
        const mouth = this.hoveredTunnelMouth;
        this.networkClient.sendMoveInput(mouth.x, mouth.y);
        this.spawnMoveMarker(new Vector(mouth.x, mouth.y));
      } else {
        this.networkClient.sendMoveInput(worldPos.x, worldPos.y);
        // Spawn move marker at click position
        this.spawnMoveMarker(worldPos);
      }
    }

    const attackMoveKey = this.key("attack_move");

    // Handle entity selection (left-click when NOT holding A)
    if (
      !minimapTarget &&
      !pinging &&
      !this.inputManager.isKeyDown(attackMoveKey) &&
      leftClick
    ) {
      this.handleEntitySelection(camera);
    }

    // Handle attack-move (A + left-click, on the map or the minimap)
    if (
      !pinging &&
      !holdingStill &&
      this.inputManager.isKeyDown(attackMoveKey) &&
      leftClick
    ) {
      const worldPos = minimapTarget ?? this.screenToWorld(mousePosition, camera);
      this.networkClient.sendAttackMoveInput(worldPos.x, worldPos.y);
      this.spawnMoveMarker(worldPos, true);
    }

    // Handle stop (S key)
    if (this.inputManager.isKeyJustPressed(this.key("stop"))) {
      this.networkClient.sendStopInput();
    }

    // Handle abilities (Q, W, E, R) or level-up with Ctrl held
    // Note: e.key returns 'Control' (capital C) for the control key
    if (this.inputManager.isKeyDown("Control")) {
      // Ctrl + an ability's key = Level up ability
      for (const slot of ABILITY_SLOTS) {
        if (this.inputManager.isKeyJustPressed(this.key(abilityAction(slot)))) {
          this.networkClient.sendLevelUpInput(slot);
        }
      }
    } else {
      // Normal ability cast
      for (const slot of ABILITY_SLOTS) this.handleAbilityInput(this.key(abilityAction(slot)), slot, camera);
    }

    // Handle recall (B key)
    if (this.inputManager.isKeyJustPressed(this.key("recall"))) {
      this.networkClient.sendRecallInput();
    }

    // Summoner spells: D and F, cast at the cursor (on the unit under it, if any)
    for (const slot of SUMMONER_SLOTS) {
      const castable: Castable = { kind: "summoner", slot };
      const summoner = this.localSummoner(slot);
      const definition = summoner && isSummonerSpellId(summoner.id) ? SUMMONER_SPELLS[summoner.id] : undefined;
      this.handleCastKey(this.key(summonerAction(slot)), castable, summonerAims(definition), (summoner?.cooldownRemaining ?? 0) <= 0, camera);
    }

    // Items: 1, 2, 3, 6, 7, 8 use the item in each slot, aimed at the cursor
    for (const slot of ITEM_SLOTS) {
      const item = this.localItem(slot);
      const aims = item ? itemAims(getItemActive(item.definitionId)) : false;
      this.handleCastKey(this.key(itemAction(slot)), { kind: "item", slot }, aims, true, camera);
    }

    // Wards: hold 4 (5 for a control ward) to see where it goes and what it
    // will see (render), release to place it there
    for (const [action, wardType] of WARD_ACTIONS) {
      if (!this.inputManager.isKeyJustReleased(this.key(action))) continue;
      const at = this.wardPlacement(camera);
      if (at) this.networkClient.sendPlaceWardInput(wardType, at.x, at.y);
    }

    this.onArmedAbilityChange?.(this.getArmedAbility());
  }

  /**
   * A summoner spell's or an item's key: cast now, or show it and cast on
   * the release or a click, as the cast mode says.
   */
  private handleCastKey(key: string, castable: Castable, aims: boolean, ready: boolean, camera: any): void {
    const mode = getControls().getCastMode();
    if (this.inputManager.isKeyJustPressed(key) && this.casts.press(castable, { mode, aims, ready }) === "cast") {
      this.cast(castable, camera);
    }
    if (this.inputManager.isKeyJustReleased(key) && this.casts.release(castable, mode)) {
      this.cast(castable, camera);
    }
  }

  /** Cast an ability, summoner spell or item at the cursor (on the unit under it, if any) */
  private cast(castable: Castable, camera: any): void {
    const at = this.screenToWorld(this.inputManager.getMousePosition(), camera);
    switch (castable.kind) {
      case "ability":
        this.sendAbilityWithTarget(castable.slot, at);
        break;
      case "summoner":
        this.networkClient.sendSummonerSpellInput(castable.slot, at.x, at.y, this.hoveredEnemyId ?? undefined);
        break;
      case "item":
        this.networkClient.sendUseItemInput(castable.slot, at.x, at.y);
        break;
    }
  }

  /** The local champion's summoner spell in a slot */
  private localSummoner(slot: 0 | 1): SummonerSpellState | undefined {
    return (this.stateManager.getLocalPlayerEntity()?.snapshot as { summoners?: SummonerSpellState[] } | undefined)?.summoners?.[slot];
  }

  /** The local champion's item in an inventory slot */
  private localItem(slot: number): EquippedItemState | null {
    return (this.stateManager.getLocalPlayerEntity()?.snapshot as { items?: (EquippedItemState | null)[] } | undefined)?.items?.[slot] ?? null;
  }

  /**
   * Handle entity selection on left-click.
   * Selects the closest entity to the click position, or clears selection if clicking empty space.
   */
  private handleEntitySelection(camera: any): void {
    const mouseWorldPos = this.screenToWorld(
      this.inputManager.getMousePosition(),
      camera,
    );

    let closestEntity: InterpolatedEntity | null = null;
    let bestScore = Infinity;

    // Check all entities from state manager
    const entities = this.stateManager.getEntities();
    for (const entity of entities) {
      const snapshot = entity.snapshot;

      // Skip projectiles, zones and healing blossoms (not selectable)
      if (snapshot.entityType === 6 || snapshot.entityType === 8 || snapshot.entityType === 10) continue;

      // Skip dead entities
      if ("isDead" in snapshot && (snapshot as any).isDead) continue;
      if ("isDestroyed" in snapshot && (snapshot as any).isDestroyed) continue;

      const score = pickScore(mouseWorldPos, entity.position, snapshot as any);
      if (score !== null && score < bestScore) {
        closestEntity = entity;
        bestScore = score;
      }
    }

    const previousSelection = this.selectedEntityId;

    if (closestEntity) {
      // Toggle off if clicking the same entity, otherwise select the new one
      if (this.selectedEntityId === closestEntity.snapshot.entityId) {
        this.selectedEntityId = null;
      } else {
        this.selectedEntityId = closestEntity.snapshot.entityId;
      }
    } else {
      // Clicking empty space clears selection
      this.selectedEntityId = null;
    }

    // Fire callback if selection changed
    if (this.onSelectionChange && this.selectedEntityId !== previousSelection) {
      this.onSelectionChange(this.selectedEntityId);
    }
  }

  /**
   * Update hover detection for enemies and allies, set cursor accordingly.
   */
  private updateHoveredEnemy(camera: any): void {
    const mouseWorldPos = this.screenToWorld(
      this.inputManager.getMousePosition(),
      camera,
    );

    // Each unit can be pointed at anywhere on its drawn body (see picking.ts)
    let closestEnemy: InterpolatedEntity | null = null;
    let closestAlly: InterpolatedEntity | null = null;
    let closestEnemyScore = Infinity;
    let closestAllyScore = Infinity;

    // Check all entities from state manager
    const entities = this.stateManager.getEntities();
    for (const entity of entities) {
      const snapshot = entity.snapshot;

      // Skip entities without side property
      if (!("side" in snapshot)) continue;

      // Skip dead entities
      if ("isDead" in snapshot && (snapshot as any).isDead) continue;
      if ("isDestroyed" in snapshot && (snapshot as any).isDestroyed) continue;

      // Neutral entities (side 2) are always enemies to everyone
      const entitySide = (snapshot as any).side;
      const isNeutral = entitySide === 2;
      const isAlly = !isNeutral && entitySide === this.localSide;
      const score = pickScore(mouseWorldPos, entity.position, snapshot as any);
      if (score === null) continue;

      if (isAlly) {
        // Check ally targetable types (including self for self-cast abilities like Elara heal)
        if (!ALLY_TARGETABLE_ENTITY_TYPES.has(snapshot.entityType)) continue;

        if (score < closestAllyScore) {
          closestAlly = entity;
          closestAllyScore = score;
        }
      } else {
        // Check attackable enemy types
        if (!ATTACKABLE_ENTITY_TYPES.has(snapshot.entityType)) continue;

        if (score < closestEnemyScore) {
          closestEnemy = entity;
          closestEnemyScore = score;
        }
      }
    }

    // Priority: Enemy > Ally (for targeting purposes)
    const cursorManager = getCursorManager();
    const prevEnemyId = this.hoveredEnemyId;
    const prevAllyId = this.hoveredAllyId;

    if (closestEnemy) {
      this.hoveredEnemyId = closestEnemy.snapshot.entityId;
      this.hoveredAllyId = null;
      this.hoveredEntityInfo = {
        position: new Vector(closestEnemy.position.x, closestEnemy.position.y),
        pulseTime: performance.now() / 1000,
        isAlly: false,
        collisionRadius: getEntityCollisionRadius(closestEnemy),
      };
      cursorManager.setCursor("attack");
    } else if (closestAlly) {
      this.hoveredEnemyId = null;
      this.hoveredAllyId = closestAlly.snapshot.entityId;
      this.hoveredEntityInfo = {
        position: new Vector(closestAlly.position.x, closestAlly.position.y),
        pulseTime: performance.now() / 1000,
        isAlly: true,
        collisionRadius: getEntityCollisionRadius(closestAlly),
      };
      // No special cursor for allies, unless A arms an attack-move
      cursorManager.setCursor(this.inputManager.isKeyDown(this.key("attack_move")) ? "attack" : "default");
    } else {
      this.hoveredEnemyId = null;
      this.hoveredAllyId = null;
      this.hoveredEntityInfo = null;
      // Holding A arms an attack-move
      cursorManager.setCursor(this.inputManager.isKeyDown(this.key("attack_move")) ? "attack" : "default");
    }

    // A tunnel's mouth, when no unit is in the way
    this.hoveredTunnelMouth = closestEnemy || closestAlly ? null : tunnelMouths().find(mouth =>
      ((mouseWorldPos.x - mouth.x) / TUNNEL_MOUTH_HALF_WIDTH) ** 2 + ((mouseWorldPos.y - mouth.y) / TUNNEL_MOUTH_HALF_HEIGHT) ** 2 <= 1
    ) ?? null;

    // Notify EntityRenderer of hover state change for sprite outlines
    if (this.onHoverStateChange &&
        (this.hoveredEnemyId !== prevEnemyId || this.hoveredAllyId !== prevAllyId)) {
      this.onHoverStateChange(this.hoveredEnemyId, this.hoveredAllyId);
    }
  }

  /**
   * Spawn a move marker at the given world position.
   */
  private spawnMoveMarker(position: Vector, attackMove = false): void {
    // Remove any existing markers (only show one at a time)
    this.moveMarkers = [];
    this.moveMarkers.push({
      position: new Vector(position.x, position.y),
      startTime: performance.now() / 1000,
      attackMove,
    });
  }

  /**
   * Update move markers, removing expired ones.
   */
  private updateMoveMarkers(): void {
    const currentTime = performance.now() / 1000;
    this.moveMarkers = this.moveMarkers.filter((marker) => {
      const elapsed = currentTime - marker.startTime;
      return elapsed < MOVE_MARKER_CONFIG.ANIMATION_DURATION;
    });
  }

  /**
   * Handle ability input for a specific slot.
   * Supports both instant-cast and charge abilities.
   */
  private handleAbilityInput(
    key: string,
    slot: AbilitySlot,
    camera: any,
  ): void {
    // Check if this ability has charge behavior
    const abilityDef = this.getAbilityDefinition(slot);
    const isChargeAbility = abilityDef && hasChargeBehavior(abilityDef);

    // Handle charge ability key press (start charging; one that can't move stops the champion)
    if (isChargeAbility && this.inputManager.isKeyJustPressed(key)) {
      this.chargeState = startCharge(slot, abilityDef, this.localAbilityState(slot), performance.now() / 1000);
      if (this.chargeState?.holdsStill) this.networkClient.sendStopInput();
      return;
    }

    // Handle charge ability key release (fire with charge time)
    if (isChargeAbility && this.chargeState?.slot === slot && this.inputManager.isKeyJustReleased(key)) {
      const worldPos = this.screenToWorld(
        this.inputManager.getMousePosition(),
        camera,
      );

      // How long it charged
      const charged = chargeTime(this.chargeState, performance.now() / 1000);

      // Clear charge state
      this.chargeState = null;

      // Send ability with charge time
      this.sendAbilityWithTarget(slot, worldPos, charged);
      return;
    }

    // Abilities that don't charge: as the cast mode says
    if (!isChargeAbility && abilityDef) {
      const state = this.localAbilityState(slot);
      this.handleCastKey(key, { kind: "ability", slot }, abilityAims(abilityDef, state), abilityReady(state), camera);
    }
  }

  /**
   * The local champion's state of the ability in a slot (its snapshot's).
   */
  private localAbilityState(slot: AbilitySlot): Partial<AbilityState> | undefined {
    const snapshot = this.stateManager.getLocalPlayerEntity()?.snapshot as { abilities?: Partial<Record<AbilitySlot, AbilityState>> } | undefined;
    return snapshot?.abilities?.[slot];
  }

  /**
   * Get ability definition for a slot.
   */
  private getAbilityDefinition(slot: AbilitySlot) {
    const champDef = getChampionDefinition(this.championId);
    if (!champDef) return null;
    // The slot's ability now: its own, or one swapped in (Nocthar's colossus's)
    const abilityId = this.localAbilityState(slot)?.abilityId ?? champDef.abilities[slot];
    return getAbilityDefinition(abilityId);
  }

  /**
   * Send ability input with appropriate targeting.
   */
  private sendAbilityWithTarget(
    slot: AbilitySlot,
    worldPos: Vector,
    chargeTime?: number
  ): void {
    // If hovering over an enemy, send as unit-targeted ability
    if (this.hoveredEnemyId) {
      this.networkClient.sendAbilityInput(
        slot,
        "unit",
        worldPos.x,
        worldPos.y,
        this.hoveredEnemyId,
        chargeTime,
      );
    } else if (this.hoveredAllyId) {
      // If hovering over an ally, send as unit-targeted ability
      this.networkClient.sendAbilityInput(
        slot,
        "unit",
        worldPos.x,
        worldPos.y,
        this.hoveredAllyId,
        chargeTime,
      );
    } else {
      // Otherwise send as position-targeted ability
      this.networkClient.sendAbilityInput(
        slot,
        "position",
        worldPos.x,
        worldPos.y,
        undefined,
        chargeTime,
      );
    }
  }

  /**
   * Convert screen coordinates to world coordinates.
   */
  private screenToWorld(screenPos: Vector, camera: any): Vector {
    // Get canvas dimensions
    const canvas = document.querySelector("canvas");
    if (!canvas) return screenPos;

    const centerX = Dimensions.w / 2;
    const centerY = Dimensions.h / 2;

    // Convert from screen to world coordinates
    const worldX = (screenPos.x - centerX) / camera.zoom + camera.position.x;
    const worldY = (screenPos.y - centerY) / camera.zoom + camera.position.y;

    return new Vector(worldX, worldY);
  }

  /**
   * Render visual feedback: move markers, and the attack range while A is
   * held (entity highlighting is done via sprite outlines).
   */
  render(): RenderElement {
    const element = new RenderElement((ctx: GameContext) => {
      const { canvasRenderingContext } = ctx;

      if (this.inputManager.isKeyDown(this.key("attack_move"))) {
        this.renderAttackRange(canvasRenderingContext);
      }
      for (const [action, wardType] of WARD_ACTIONS) {
        if (this.inputManager.isKeyDown(this.key(action))) this.renderWardPlacement(canvasRenderingContext, wardType, ctx.camera);
      }
      // A summoner spell's or item's preview: how far it reaches (the HUD draws abilities')
      const armed = this.casts.getArmed();
      if (armed && armed.kind !== "ability") this.renderAimRange(canvasRenderingContext, this.aimRange(armed));

      if (this.hoveredTunnelMouth) this.renderTunnelMouthHover(canvasRenderingContext, this.hoveredTunnelMouth);

      // Render move markers
      for (const marker of this.moveMarkers) {
        this.renderMoveMarker(canvasRenderingContext, marker);
      }
    }, true);

    element.positionType = "normal";
    element.zIndex = -100; // Render behind entities
    return element;
  }

  /**
   * Where a ward placed now would go: at the cursor, or as far as the
   * placement range reaches toward it (the server does the same, and also
   * keeps it out of walls). Null while the local champion is dead.
   */
  private wardPlacement(camera: any): Vector | null {
    const local = this.stateManager.getLocalPlayerEntity();
    if (!local || (local.snapshot as { isDead?: boolean }).isDead) return null;
    const cursor = this.screenToWorld(this.inputManager.getMousePosition(), camera);
    const offset = cursor.clone().sub(local.position);
    const distance = offset.length();
    const range = GameConfig.VISION.WARD_PLACE_RANGE;
    if (distance <= range) return cursor;
    return local.position.clone().add(offset.scalar(range / distance));
  }

  /**
   * While a ward key is held: the placement range around the local
   * champion, and the ward and what it will see where it would go (dimmed
   * when no ward charge is left, or no control ward is carried).
   */
  private renderWardPlacement(ctx: CanvasRenderingContext2D, wardType: WardType, camera: any): void {
    const local = this.stateManager.getLocalPlayerEntity();
    const at = this.wardPlacement(camera);
    if (!local || !at) return;
    // A stealth ward uses a trinket charge, a control ward one bought in the shop
    const snapshot = local.snapshot as { trinketCharges?: number; controlWards?: number };
    const charges = wardType === "control" ? snapshot.controlWards ?? 0 : snapshot.trinketCharges ?? 1;

    ctx.save();
    ctx.beginPath();
    ctx.arc(local.position.x, local.position.y, GameConfig.VISION.WARD_PLACE_RANGE, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(241, 196, 15, 0.05)";
    ctx.fill();
    ctx.strokeStyle = "rgba(241, 196, 15, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    renderWardPreview(ctx, wardType, at.x, at.y, GameConfig.VISION.WARD_SIGHT_RANGE, charges > 0);
  }

  /** How far an aimed summoner spell or item active reaches */
  private aimRange(castable: Castable): number {
    if (castable.kind === "summoner") {
      const id = this.localSummoner(castable.slot)?.id;
      return (id && isSummonerSpellId(id) ? SUMMONER_SPELLS[id].range : undefined) ?? 0;
    }
    if (castable.kind === "item") {
      const item = this.localItem(castable.slot);
      return (item ? getItemActive(item.definitionId)?.range : undefined) ?? 0;
    }
    return 0;
  }

  /** The ring a shown summoner spell or item active reaches to, around the local champion */
  private renderAimRange(ctx: CanvasRenderingContext2D, range: number): void {
    const local = this.stateManager.getLocalPlayerEntity();
    if (!local || range <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(local.position.x, local.position.y, range, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 206, 209, 0.06)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 206, 209, 0.6)";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Circle around the local champion showing how far its basic attacks
   * reach (attack range is edge to edge, so it's drawn from its edge).
   */
  private renderAttackRange(ctx: CanvasRenderingContext2D): void {
    const local = this.stateManager.getLocalPlayerEntity();
    if (!local) return;
    const snapshot = local.snapshot as { attackRange?: number; isDead?: boolean; championId?: string };
    if (snapshot.isDead) return;
    const attackRange = snapshot.attackRange ??
      (snapshot.championId ? getChampionDefinition(snapshot.championId)?.baseStats.attackRange : undefined) ?? 0;
    const radius = attackRange + getEntityCollisionRadius(local);

    ctx.save();
    ctx.beginPath();
    ctx.arc(local.position.x, local.position.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(231, 76, 60, 0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(231, 76, 60, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Render a move marker: a ring on the ground that closes in on the point,
   * with four arrows converging on it, fading out (red for attack-move).
   */
  /**
   * A jungle tunnel's mouth under the cursor: a thin ring round its burrow
   * and an arrow bobbing over it, pointing in.
   */
  private renderTunnelMouthHover(ctx: CanvasRenderingContext2D, mouth: { x: number; y: number }): void {
    const bob = Math.sin(performance.now() / 160) * 2;
    ctx.save();
    for (const [stroke, width] of [["rgba(0, 0, 0, 0.5)", 3], ["#ffe08a", 1.5]] as const) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.ellipse(mouth.x, mouth.y, TUNNEL_MOUTH_HALF_WIDTH - 4, TUNNEL_MOUTH_HALF_HEIGHT - 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const tip = mouth.y - TUNNEL_MOUTH_HALF_HEIGHT - 4 + bob;
    ctx.beginPath();
    ctx.moveTo(mouth.x, tip);
    ctx.lineTo(mouth.x - 6, tip - 8);
    ctx.lineTo(mouth.x + 6, tip - 8);
    ctx.closePath();
    ctx.fillStyle = "#ffe08a";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private renderMoveMarker(
    ctx: CanvasRenderingContext2D,
    marker: MoveMarker,
  ): void {
    const elapsed = performance.now() / 1000 - marker.startTime;
    const progress = elapsed / MOVE_MARKER_CONFIG.ANIMATION_DURATION;
    if (progress >= 1) return;

    const { START_RADIUS, END_RADIUS, FLATTEN } = MOVE_MARKER_CONFIG;
    const ease = 1 - Math.pow(1 - progress, 2);
    const radius = START_RADIUS + (END_RADIUS - START_RADIUS) * ease;
    const color = marker.attackMove ? MOVE_MARKER_CONFIG.ATTACK_MOVE_COLOR : MOVE_MARKER_CONFIG.MOVE_COLOR;
    const { x, y } = marker.position;

    ctx.save();
    ctx.globalAlpha = 1 - progress * progress;
    ctx.lineWidth = 2;

    // Dark outline under the colored ring so it reads on grass and paths alike
    for (const [stroke, width] of [["rgba(0, 0, 0, 0.55)", 4], [color, 2]] as const) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * FLATTEN, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Four arrowheads pointing in, riding just outside the ring
    const arrowDistance = radius + 6;
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const ax = x + Math.cos(angle) * arrowDistance;
      const ay = y + Math.sin(angle) * arrowDistance * FLATTEN;
      const inward = Math.atan2(y - ay, (x - ax) * FLATTEN);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(inward);
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(-3, -4);
      ctx.lineTo(-3, 4);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }

    // A dot on the spot itself
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, 2.5, 2.5 * FLATTEN, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ============================================================================
  // Public getters for hovered entity state (used by EntityRenderer for outlines)
  // ============================================================================

  /**
   * Get the currently hovered enemy entity ID.
   */
  getHoveredEnemyId(): string | null {
    return this.hoveredEnemyId;
  }

  /**
   * Get the currently hovered ally entity ID.
   */
  getHoveredAllyId(): string | null {
    return this.hoveredAllyId;
  }

  /**
   * Check if an entity is currently hovered (enemy or ally).
   */
  isEntityHovered(entityId: string): boolean {
    return this.hoveredEnemyId === entityId || this.hoveredAllyId === entityId;
  }

  /**
   * Get the hover type for an entity (null if not hovered).
   */
  getEntityHoverType(entityId: string): 'enemy' | 'ally' | null {
    if (this.hoveredEnemyId === entityId) return 'enemy';
    if (this.hoveredAllyId === entityId) return 'ally';
    return null;
  }
}

export default OnlineInputHandler;
