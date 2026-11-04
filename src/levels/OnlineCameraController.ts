import { MOBAConfig } from '@siege/shared';
import type Camera from '@/core/camera';
import type { GameObject } from '@/core/GameObject';
import type { OnlineStateManager } from '@/core/OnlineStateManager';
import { getControls } from '@/core/input/controls';
import { normalizeKey } from '@/core/input/keyBindings';
import { isTypingTarget } from '@/core/state/chat';

/**
 * Camera controller that follows the local player's position from server.
 * Controls:
 * - Y: Toggle camera lock on/off
 * - Space: Instantly snap camera to champion (and enable lock)
 * When unlocked, edge scroll panning works via Camera.ts
 */
export class OnlineCameraController implements GameObject {
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

    // Listen for camera control keys (the player's bindings)
    this.keyListener = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const key = normalizeKey(e.key);
      const controls = getControls();

      // Y key: Toggle camera lock
      if (key === controls.keyFor('camera_lock')) {
        this.isLocked = !this.isLocked;

        // If re-locking, snap to player position
        if (this.isLocked && this.camera) {
          this.snapToPlayer();
        }
      }

      // Space key: Instantly snap camera to champion (without enabling lock)
      if (key === controls.keyFor('camera_center')) {
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

  step(_ctx: any): void {
    if (!this.camera) return;

    // Get local player position from state manager
    const localPos = this.stateManager.getLocalPlayerPosition();

    // The first position from the server: snap to it, locked or not (a
    // player rejoining a match finds their champion away from the spawn)
    if (localPos && !this.hasInitializedPosition) {
      this.camera.position.x = localPos.x;
      this.camera.position.y = localPos.y;
      this.hasInitializedPosition = true;
      return;
    }

    // Only follow champion if camera is locked
    // When unlocked, Camera.ts handles edge scroll panning
    if (!this.isLocked) return;

    if (localPos) {
      // Smoothly follow the player
      const lerpFactor = 0.1;
      this.camera.position.x += (localPos.x - this.camera.position.x) * lerpFactor;
      this.camera.position.y += (localPos.y - this.camera.position.y) * lerpFactor;
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
