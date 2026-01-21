/**
 * AbilityInputManager - Handles ability casting input (QWER keys + mouse targeting).
 *
 * Manages the ability targeting flow:
 * 1. Player presses Q/W/E/R
 * 2. If ability requires targeting, enter targeting mode
 * 3. Player clicks to confirm (or right-clicks to cancel)
 * 4. Ability is cast
 */

import Vector from '@/physics/vector';
import type { Champion } from '@/champions/Champion';
import type { AbilitySlot } from '@/abilities/types';
import type Ability from '@/abilities/Ability';
import type { IAbilityTargetDescription } from '@/abilities/AbilityTargetDescription';
import { InputManager } from './InputManager';
import actionLogger from '@/utils/ActionLogger';

/**
 * Current targeting state for ability casting.
 */
export interface AbilityTargetingState {
  /** Which ability slot is being targeted (null = not targeting) */
  slot: AbilitySlot | null;
  /** The ability being targeted */
  ability: Ability | null;
  /** Target description for validation */
  targetDescription: IAbilityTargetDescription | null;
  /** Current mouse position in world coordinates */
  mouseWorldPosition: Vector;
  /** Whether currently hovering a valid target unit */
  hoveringValidTarget: Champion | null;
  /** Whether the current targeting state is valid */
  isValidTarget: boolean;
}

/**
 * Key bindings for abilities.
 */
const ABILITY_KEYS: Record<string, AbilitySlot> = {
  'q': 'Q',
  'Q': 'Q',
  'w': 'W',
  'W': 'W',
  'e': 'E',
  'E': 'E',
  'r': 'R',
  'R': 'R',
};

/**
 * Manages ability input and targeting state.
 */
export class AbilityInputManager {
  private champion: Champion | null = null;
  private inputManager: InputManager;

  /** Quick cast mode - abilities cast immediately on key press */
  private quickCast: boolean = true;  // Default to quick cast ON

  /** Current targeting state */
  private targetingState: AbilityTargetingState = {
    slot: null,
    ability: null,
    targetDescription: null,
    mouseWorldPosition: new Vector(0, 0),
    hoveringValidTarget: null,
    isValidTarget: false,
  };

  /** Camera position for screen-to-world conversion */
  private cameraPosition: Vector = new Vector(0, 0);
  private cameraZoom: number = 1;

  /** Nearby champions for quick cast targeting */
  private nearbyChampions: Champion[] = [];

  /** Callbacks for UI updates */
  private onTargetingChange?: (state: AbilityTargetingState) => void;
  private onAbilityCast?: (slot: AbilitySlot, target?: Champion, position?: Vector) => void;

  constructor() {
    this.inputManager = InputManager.getInstance();
  }

  /**
   * Enable or disable quick cast mode.
   */
  setQuickCast(enabled: boolean): void {
    this.quickCast = enabled;
    console.log(`%c[Settings] Quick Cast: ${enabled ? 'ON' : 'OFF'}`, 'color: #4CAF50');
  }

  /**
   * Check if quick cast is enabled.
   */
  isQuickCast(): boolean {
    return this.quickCast;
  }

  /**
   * Set the champion to control.
   */
  setChampion(champion: Champion | null): void {
    this.champion = champion;
    this.cancelTargeting();
  }

  /**
   * Get current targeting state.
   */
  getTargetingState(): AbilityTargetingState {
    return { ...this.targetingState };
  }

  /**
   * Check if currently in targeting mode.
   */
  isTargeting(): boolean {
    return this.targetingState.slot !== null;
  }

  /**
   * Set targeting state change callback.
   */
  setOnTargetingChange(callback: (state: AbilityTargetingState) => void): void {
    this.onTargetingChange = callback;
  }

  /**
   * Set ability cast callback.
   */
  setOnAbilityCast(callback: (slot: AbilitySlot, target?: Champion, position?: Vector) => void): void {
    this.onAbilityCast = callback;
  }

  /**
   * Update camera info for screen-to-world conversion.
   */
  updateCamera(position: Vector, zoom: number): void {
    this.cameraPosition = position;
    this.cameraZoom = zoom;
  }

  /**
   * Update input state. Call each frame.
   */
  update(nearbyChampions: Champion[] = []): void {
    if (!this.champion) return;

    // Store for quick cast
    this.nearbyChampions = nearbyChampions;

    // Update mouse world position
    this.targetingState.mouseWorldPosition = this.inputManager.getMouseWorldPosition(
      this.cameraPosition,
      this.cameraZoom
    );

    // Check for ability key presses
    this.checkAbilityKeys();

    // If in targeting mode, update targeting state
    if (this.isTargeting()) {
      this.updateTargeting(nearbyChampions);
      this.checkTargetingConfirmation();
    }
  }

  /**
   * Check for Q/W/E/R key presses.
   */
  private checkAbilityKeys(): void {
    if (!this.champion) return;

    for (const [key, slot] of Object.entries(ABILITY_KEYS)) {
      if (this.inputManager.isKeyJustPressed(key)) {
        this.handleAbilityKeyPress(slot);
        break;
      }
    }

    // Cancel targeting with Escape
    if (this.inputManager.isKeyJustPressed('Escape')) {
      this.cancelTargeting();
    }

    // Toggle quick cast with backtick (`)
    if (this.inputManager.isKeyJustPressed('`')) {
      this.setQuickCast(!this.quickCast);
    }
  }

  /**
   * Handle an ability key press.
   */
  private handleAbilityKeyPress(slot: AbilitySlot): void {
    if (!this.champion) return;

    actionLogger.keyPress(slot.toLowerCase());

    const ability = this.champion.getAbility(slot);
    if (!ability) {
      actionLogger.debug('ability', `No ability in slot ${slot}`);
      return;
    }

    // Check if ability is learned and ready
    if (!ability.isLearned) {
      actionLogger.debug('ability', `${slot} not learned yet`);
      return;
    }
    if (!ability.isReady) {
      actionLogger.debug('ability', `${slot} on cooldown`);
      return;
    }

    // Get target description
    const targetDesc = ability.getTargetDescription();

    // No targeting needed - cast immediately
    if (!targetDesc.requiresTarget && !targetDesc.targetsGround) {
      this.castAbility(slot, undefined, undefined);
      return;
    }

    // Quick cast mode - try to cast immediately
    if (this.quickCast) {
      const mousePos = this.targetingState.mouseWorldPosition;

      // For unit-targeted abilities, find target under mouse
      if (targetDesc.requiresTarget) {
        const target = this.findTargetUnderMouse(mousePos, targetDesc);
        if (target) {
          this.castAbility(slot, target, undefined);
          return;
        }
        // No valid target - show brief feedback
        actionLogger.debug('ability', `${slot} quick cast: no valid target under cursor`);
        return;
      }

      // For ground-targeted/skillshot abilities, cast at mouse position
      if (targetDesc.targetsGround) {
        this.castAbility(slot, undefined, mousePos.clone());
        return;
      }
    }

    // Normal mode - enter targeting
    this.startTargeting(slot, ability, targetDesc);
  }

  /**
   * Find a valid target under the mouse cursor.
   */
  private findTargetUnderMouse(mousePos: Vector, targetDesc: any): Champion | null {
    if (!this.champion) return null;

    for (const target of this.nearbyChampions) {
      if (target === this.champion) continue;
      if (target.isDead()) continue;

      const distance = mousePos.distanceTo(target.getPosition());
      if (distance < 30) { // Target hitbox
        if (targetDesc.isValidTarget(this.champion, target, null)) {
          return target;
        }
      }
    }
    return null;
  }

  /**
   * Start targeting mode for an ability.
   */
  private startTargeting(
    slot: AbilitySlot,
    ability: Ability,
    targetDescription: IAbilityTargetDescription
  ): void {
    this.targetingState.slot = slot;
    this.targetingState.ability = ability;
    this.targetingState.targetDescription = targetDescription;
    this.targetingState.isValidTarget = false;
    this.targetingState.hoveringValidTarget = null;

    const targetingType = targetDescription.requiresTarget ? 'unit' : 'ground';
    actionLogger.abilityTargetingStart(slot, targetingType);

    this.onTargetingChange?.(this.targetingState);
  }

  /**
   * Cancel targeting mode.
   */
  cancelTargeting(): void {
    if (this.targetingState.slot) {
      actionLogger.abilityTargetingCancelled(this.targetingState.slot);
    }

    this.targetingState.slot = null;
    this.targetingState.ability = null;
    this.targetingState.targetDescription = null;
    this.targetingState.isValidTarget = false;
    this.targetingState.hoveringValidTarget = null;

    this.onTargetingChange?.(this.targetingState);
  }

  /**
   * Update targeting validation.
   */
  private updateTargeting(nearbyChampions: Champion[]): void {
    if (!this.champion || !this.targetingState.targetDescription) return;

    const targetDesc = this.targetingState.targetDescription;
    const mousePos = this.targetingState.mouseWorldPosition;

    // Reset hovering target
    this.targetingState.hoveringValidTarget = null;

    // For unit-targeted abilities, check for valid target under mouse
    if (targetDesc.requiresTarget) {
      for (const target of nearbyChampions) {
        if (target === this.champion) continue;
        if (target.isDead()) continue;

        // Check if mouse is over target
        const distance = mousePos.distanceTo(target.getPosition());
        if (distance < 30) { // Target hitbox size
          if (targetDesc.isValidTarget(this.champion, target, null)) {
            this.targetingState.hoveringValidTarget = target;
            break;
          }
        }
      }

      this.targetingState.isValidTarget = this.targetingState.hoveringValidTarget !== null;
    }
    // For ground-targeted/skillshot abilities, check range
    else if (targetDesc.targetsGround) {
      this.targetingState.isValidTarget = targetDesc.isValidTarget(
        this.champion,
        null,
        mousePos
      );
    }

    this.onTargetingChange?.(this.targetingState);
  }

  /**
   * Check for targeting confirmation (left click) or cancellation (right click).
   */
  private checkTargetingConfirmation(): void {
    // Right click cancels targeting
    if (this.inputManager.isRightMouseJustPressed()) {
      this.cancelTargeting();
      return;
    }

    // Left click confirms targeting
    if (this.inputManager.isLeftMouseJustPressed()) {
      const slot = this.targetingState.slot;
      if (!slot) return;

      // For unit-targeted abilities, need a valid target
      if (this.targetingState.targetDescription?.requiresTarget) {
        if (this.targetingState.hoveringValidTarget) {
          this.castAbility(slot, this.targetingState.hoveringValidTarget, undefined);
          this.cancelTargeting();
        }
      }
      // For ground-targeted/skillshot abilities
      else if (this.targetingState.targetDescription?.targetsGround) {
        this.castAbility(slot, undefined, this.targetingState.mouseWorldPosition.clone());
        this.cancelTargeting();
      }
    }
  }

  /**
   * Cast the ability.
   */
  private castAbility(slot: AbilitySlot, target?: Champion, position?: Vector): void {
    if (!this.champion) return;

    const ability = this.champion.getAbility(slot);
    const abilityName = ability?.definition.name ?? slot;

    actionLogger.abilityCastStart(this.champion.id, slot, abilityName);

    // Actually cast the ability on the champion
    this.champion.castAbility(slot, target, position);

    // Log completion with target info
    let targetInfo: string | undefined;
    if (target) {
      targetInfo = `target: ${target.id}`;
    } else if (position) {
      targetInfo = `pos: (${position.x.toFixed(0)}, ${position.y.toFixed(0)})`;
    }
    actionLogger.abilityCastComplete(this.champion.id, slot, targetInfo);

    // Notify callback
    this.onAbilityCast?.(slot, target, position);
  }

  /**
   * Get the controlled champion.
   */
  getChampion(): Champion | null {
    return this.champion;
  }
}

export default AbilityInputManager;
