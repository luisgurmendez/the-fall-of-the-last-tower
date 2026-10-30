/**
 * OnlineLevel - Renders game state from server for multiplayer.
 *
 * Unlike mobaLevel which simulates locally, this level:
 * - Receives entity state from server via OnlineStateManager
 * - Renders entities based on server snapshots
 * - Sends inputs to server via NetworkClient
 */

import Level from '@/core/level';
import { Rectangle } from '@/objects/shapes';
import { MOBAConfig } from '@/map';
import MOBABackground from '@/objects/MOBABackground';
import { MOBAMap } from '@/map/MOBAMap';
import Camera from '@/core/camera';
import { ChampionHUD } from '@/ui/ChampionHUD';
import { GameStatsHUD } from '@/ui/GameStatsHUD';
import { OnlineMinimap } from '@/ui/OnlineMinimap';
import { AnnouncementBanner } from '@/ui/AnnouncementBanner';
import { LowHealthVignette } from '@/ui/LowHealthVignette';
import { TargetInfoHUD } from '@/ui/TargetInfoHUD';
import { TabScoreboard } from '@/ui/TabScoreboard';
import { OnlineInputHandler } from '@/core/input/OnlineInputHandler';
import { EntityRenderer } from '@/render/EntityRenderer';
import { OnlineChampionAdapter } from '@/online/OnlineChampionAdapter';
import { OnlineFogProvider } from '@/online/OnlineFogProvider';
import { AbilityRangeIndicator } from '@/ui/AbilityRangeIndicator';
import { DebugInspector } from '@/debug';
import { getChampionDefinition } from '@siege/shared';
import { InputManager } from '@/core/input/InputManager';
import type { OnlineStateManager } from '@/core/OnlineStateManager';
import type { NetworkClient } from '@siege/client';
import type { MatchData } from '@/ui/matchmaking/MatchmakingUI';
import type { GameObject } from '@/core/GameObject';

/**
 * Configuration for online level.
 */
export interface OnlineLevelConfig {
  networkClient: NetworkClient;
  stateManager: OnlineStateManager;
  matchData: MatchData;
}

/**
 * Generate an online level that renders server state.
 */
export function generateOnlineLevel(config: OnlineLevelConfig): Level {
  const { networkClient, stateManager, matchData } = config;

  // Create world dimensions
  const { width, height } = MOBAConfig.MAP_SIZE;
  const worldDimensions = new Rectangle(width, height);

  // Create the MOBA map (render-only - no local simulation)
  // Entities (minions, champions, towers) are rendered from server state
  const mobaMap = new MOBAMap({ renderOnly: true });

  // Create entity renderer (renders entities based on server state)
  const entityRenderer = new EntityRenderer(stateManager, matchData.yourSide);

  // Find local player's champion from match data
  const localPlayer = matchData.players.find(p => p.side === matchData.yourSide);
  const localChampionId = localPlayer?.championId || 'warrior';

  // Create online input handler (sends inputs to server, detects enemy hover for cursor)
  const inputHandler = new OnlineInputHandler(networkClient, stateManager, matchData.yourSide, localChampionId);

  // Get champion definition for display name
  const championDef = getChampionDefinition(localChampionId);
  const championDisplayName = championDef?.name || localChampionId;

  console.log(`[OnlineLevel] Local player champion: ${localChampionId} (${championDisplayName})`);

  // Create HUD for local player
  const hudConfig = {
    accentColor: matchData.yourSide === 0 ? '#3498db' : '#e74c3c',
    championName: championDisplayName,
    championId: localChampionId,
    showManaBar: true,
    resourceColor: '#3498db',
    resourceName: 'Mana',
  };

  // Create champion adapter for HUD (wraps server state)
  // Pass the selected championId as fallback for before server state arrives
  const championAdapter = new OnlineChampionAdapter(stateManager, localChampionId);

  // OnlineMinimap reads from server state instead of local objects; right-clicks on it are map moves
  const minimap = new OnlineMinimap(stateManager, matchData.yourSide, { size: 200, corner: 'bottom-right' });
  inputHandler.setMinimapLocator((x, y) => minimap.screenToWorldIfInside(x, y));

  // Create camera controller that follows local player
  const cameraController = new OnlineCameraController(
    stateManager,
    matchData.yourSide,
    (x, y) => minimap.screenToWorldIfInside(x, y) !== null,
  );

  // Create fog of war provider (reveals fog based on server entity positions)
  const fogProvider = new OnlineFogProvider(stateManager, matchData.yourSide);

  // Wire bush manager to fog provider for bush transparency in online mode
  fogProvider.setBushManager(mobaMap.getBushManager());

  // Create debug inspector for entity inspection (toggle with F3)
  const debugInspector = new DebugInspector(stateManager);
  debugInspector.setBushManager(mobaMap.getBushManager());

  // Create champion HUD and wire up level-up handler
  const championHUD = new ChampionHUD(hudConfig, championAdapter);
  championHUD.setLevelUpHandler((slot) => {
    networkClient.sendLevelUpInput(slot);
  });

  // Wire up charge state callback from input handler to HUD
  inputHandler.setChargeStateCallback((chargeState) => {
    championHUD.setChargeState(chargeState);
  });

  // Wire up hover state callback from input handler to EntityRenderer for sprite outlines
  inputHandler.setHoverStateCallback((enemyId, allyId) => {
    entityRenderer.setHoveredEntities(enemyId, allyId);
  });

  // Create ability range indicator (shows range/AOE when hovering abilities)
  const inputManager = InputManager.getInstance();
  const abilityRangeIndicator = new AbilityRangeIndicator(stateManager, championHUD, inputManager);

  // Create target info HUD (shows selected entity info in top-left corner)
  const targetInfoHUD = new TargetInfoHUD({
    stateManager,
    inputHandler,
    localSide: matchData.yourSide,
  });

  // Create tab scoreboard (shows full scoreboard when Tab is held)
  const tabScoreboard = new TabScoreboard(stateManager, matchData.yourSide);

  // Build objects list
  const objects: GameObject[] = [
    // Background (must be first for rendering order)
    new MOBABackground(worldDimensions, mobaMap),
    // MOBA Map (terrain/structures rendering)
    mobaMap,
    // Fog of war provider (updates fog based on server entities)
    fogProvider,
    // Ability range indicator (renders under entities)
    abilityRangeIndicator,
    // Entity renderer (renders all server entities)
    entityRenderer,
    // Input handler (captures and sends inputs)
    inputHandler,
    // Camera controller
    cameraController,
    // Red screen edges when the local champion is low (under the HUD)
    new LowHealthVignette(stateManager),
    // HUD layers
    championHUD,
    new GameStatsHUD({
      getLatency: () => networkClient.getLatency(),
      getGameTime: () => stateManager.getGameTime(),
    }),
    // Target info HUD (selected entity info in top-left)
    targetInfoHUD,
    minimap,
    // Big moments (dragon slain)
    new AnnouncementBanner(stateManager),
    // Tab scoreboard (full scoreboard overlay when Tab is held)
    tabScoreboard,
    // Debug inspector for entity inspection (F3 to toggle)
    debugInspector,
  ];

  // Enable fog of war visuals (fog provider updates based on server state)
  return new Level(objects, worldDimensions, {
    localPlayerTeam: matchData.yourSide,
    disableFog: false,  // Enable fog visuals - OnlineFogProvider handles revealing
  });
}

/**
 * Camera controller that follows the local player's position from server.
 * Controls:
 * - Y: Toggle camera lock on/off
 * - Space: Instantly snap camera to champion (and enable lock)
 * When unlocked, edge scroll panning works via Camera.ts
 */
class OnlineCameraController implements GameObject {
  readonly id = 'online-camera-controller';
  shouldInitialize = true;
  shouldDispose = false;

  private stateManager: OnlineStateManager;
  private camera: Camera | null = null;
  private localSide: number;
  private hasInitializedPosition = false;
  private isLocked = false; // Start with camera unlocked (Y to toggle, Space to focus)
  private keyListener: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    stateManager: OnlineStateManager,
    localSide: number,
    private isPointerOverUI: (x: number, y: number) => boolean,
  ) {
    this.stateManager = stateManager;
    this.localSide = localSide;
  }

  init(ctx: any): void {
    this.camera = ctx.camera;

    // Initialize camera at the spawn position for the local player's side
    // Blue (0) spawns at bottom-left, Red (1) spawns at top-right
    if (this.camera) {
      const spawnPos = this.localSide === 0
        ? MOBAConfig.CHAMPION_SPAWN.BLUE
        : MOBAConfig.CHAMPION_SPAWN.RED;
      this.camera.position.x = spawnPos.x;
      this.camera.position.y = spawnPos.y;
      // Don't edge-pan while the pointer is on the minimap (it sits at the screen edge)
      this.camera.isPointerOverUI = this.isPointerOverUI;
    }

    // Listen for camera control keys
    this.keyListener = (e: KeyboardEvent) => {
      // Y key: Toggle camera lock
      if (e.key === 'y' || e.key === 'Y') {
        this.isLocked = !this.isLocked;

        // If re-locking, snap to player position
        if (this.isLocked && this.camera) {
          this.snapToPlayer();
        }
      }

      // Space key: Instantly snap camera to champion (without enabling lock)
      if (e.key === ' ') {
        e.preventDefault(); // Prevent page scroll
        if (this.camera) {
          this.snapToPlayer();
        }
      }
    };
    window.addEventListener('keydown', this.keyListener);
  }

  /**
   * Instantly snap camera to local player's position.
   */
  private snapToPlayer(): void {
    if (!this.camera) return;
    const localPos = this.stateManager.getLocalPlayerPosition();
    if (localPos) {
      this.camera.position.x = localPos.x;
      this.camera.position.y = localPos.y;
    }
  }

  step(ctx: any): void {
    if (!this.camera) return;

    // Only follow champion if camera is locked
    // When unlocked, Camera.ts handles edge scroll panning
    if (!this.isLocked) return;

    // Get local player position from state manager
    const localPos = this.stateManager.getLocalPlayerPosition();
    if (localPos) {
      // Once we have a position from server, use it
      if (!this.hasInitializedPosition) {
        // Snap to server position on first update
        this.camera.position.x = localPos.x;
        this.camera.position.y = localPos.y;
        this.hasInitializedPosition = true;
      } else {
        // Smoothly follow the player
        const lerpFactor = 0.1;
        this.camera.position.x += (localPos.x - this.camera.position.x) * lerpFactor;
        this.camera.position.y += (localPos.y - this.camera.position.y) * lerpFactor;
      }
    }
  }

  // Clean up event listener when disposed
  dispose(): void {
    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = null;
    }
  }
}

export default generateOnlineLevel;
