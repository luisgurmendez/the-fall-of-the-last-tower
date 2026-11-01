/**
 * OitboilHooks - Overheat (the passive)
 *
 * His abilities heat him up (OITBOIL_HEAT.gain); after a while without
 * casting, heat falls. At full heat he overheats for a few seconds
 * (oitboil_overheated): his abilities deal more damage here, his attacks
 * through the effect's attack damage, and the fire burns a share of his
 * maximum health each second, never below 1 health. Blue Fire (W) vents
 * heat and ends an overheat. Heat is the passive's stacks, so the HUD
 * shows it; the passive is active while he's overheated.
 */

import { GameEventType, OITBOIL_HEAT } from '@siege/shared';
import type { IChampionHooks } from '../../IChampionHooks';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerGameContext } from '../../../game/ServerGameContext';

/** The overheat's burn lands in chunks this often (a number every tick would be noise) */
const BURN_INTERVAL = 0.5;

interface HeatState {
  heat: number;
  lastCastAt: number;
  lastUpdateAt: number;
  burnTimer: number;
  overheated: boolean;
}

function heatOf(champion: ServerChampion, context: ServerGameContext): HeatState {
  const data = (champion.passiveState.customData ??= {});
  if (!data.heat) {
    const now = context.getGameTime();
    data.heat = { heat: 0, lastCastAt: now, lastUpdateAt: now, burnTimer: 0, overheated: false } satisfies HeatState;
  }
  return data.heat as HeatState;
}

export const oitboilHooks: IChampionHooks = {
  championId: 'oitboil',

  getAbilityDamageMultiplier(champion: ServerChampion): number {
    return champion.hasEffect('oitboil_overheated') ? 1 + OITBOIL_HEAT.overheatDamageBonus : 1;
  },

  onAbilityCast(champion: ServerChampion, abilityId: string, context: ServerGameContext): void {
    const state = heatOf(champion, context);
    state.lastCastAt = context.getGameTime();

    if (abilityId === 'oitboil_w') {
      // Blue Fire vents heat, and puts out an overheat
      if (state.overheated) {
        champion.removeEffect('oitboil_overheated');
        state.overheated = false;
        state.heat = OITBOIL_HEAT.max;
      }
      state.heat = Math.max(0, state.heat - OITBOIL_HEAT.vent);
    } else if (!state.overheated) {
      state.heat = Math.min(OITBOIL_HEAT.max, state.heat + (OITBOIL_HEAT.gain[abilityId] ?? 0));
      if (state.heat >= OITBOIL_HEAT.max) overheat(champion, state, context);
    }
    show(champion, state);
  },

  updatePassiveState(champion: ServerChampion, context: ServerGameContext): void {
    const state = heatOf(champion, context);
    const now = context.getGameTime();
    const dt = Math.max(0, now - state.lastUpdateAt);
    state.lastUpdateAt = now;

    if (champion.isDead) {
      state.heat = 0;
      state.overheated = false;
    } else if (state.overheated) {
      if (!champion.hasEffect('oitboil_overheated')) {
        // It ran out: cooled right down
        state.overheated = false;
        state.heat = 0;
      } else {
        state.burnTimer += dt;
        if (state.burnTimer >= BURN_INTERVAL) {
          state.burnTimer -= BURN_INTERVAL;
          const burn = Math.min(champion.maxHealth * OITBOIL_HEAT.overheatBurnPerSecond * BURN_INTERVAL, champion.health - 1);
          if (burn > 0) champion.takeDamage(burn, 'true', champion.id, context);
        }
      }
    } else if (now - state.lastCastAt >= OITBOIL_HEAT.decayDelay) {
      state.heat = Math.max(0, state.heat - OITBOIL_HEAT.decayPerSecond * dt);
    }
    show(champion, state);
  },
};

function overheat(champion: ServerChampion, state: HeatState, context: ServerGameContext): void {
  state.overheated = true;
  state.burnTimer = 0;
  champion.applyEffect('oitboil_overheated', OITBOIL_HEAT.overheatDuration, champion.id);
  // For the VFX and the sound
  context.addEvent(GameEventType.ABILITY_CAST, {
    entityId: champion.id,
    abilityId: 'oitboil_overheat',
    targetX: champion.position.x,
    targetY: champion.position.y,
  });
}

function show(champion: ServerChampion, state: HeatState): void {
  champion.passiveState.stacks = Math.round(state.heat);
  champion.passiveState.isActive = state.overheated;
}
