/**
 * The camera at the start of a match (src/levels/OnlineCameraController.ts):
 * it starts over the local player's spawn, and goes to their champion the
 * first time the server says where it is, locked or not. That matters when
 * a player rejoins a match (a bot may have walked their champion to a
 * lane): the camera starts over the champion, not over the empty base.
 * After that, unlocked, it stays where the player moves it.
 */
import { describe, it, expect } from 'bun:test';
import { MOBAConfig } from '@siege/shared';
import { OnlineCameraController } from '@/levels/OnlineCameraController';

// The controller listens for its keys on the window
(globalThis as { window?: unknown }).window ??= { addEventListener() {}, removeEventListener() {} };

function setup(position: { x: number; y: number } | null) {
  let at = position;
  const stateManager = { getLocalPlayerPosition: () => at };
  const camera = { position: { x: 0, y: 0 }, isPointerOverUI: null as unknown };
  const controller = new OnlineCameraController(stateManager as never, 0, () => false);
  controller.init({ camera } as never);
  return { controller, camera, moveTo: (next: { x: number; y: number }) => { at = next; } };
}

describe('The camera when a match starts or is rejoined', () => {
  it('starts over the spawn', () => {
    const { camera } = setup(null);
    expect(camera.position).toEqual({ x: MOBAConfig.CHAMPION_SPAWN.BLUE.x, y: MOBAConfig.CHAMPION_SPAWN.BLUE.y });
  });

  it('goes to the champion the first time its position is known, though unlocked', () => {
    const { controller, camera } = setup({ x: -118, y: 118 });
    controller.step({});
    expect(camera.position).toEqual({ x: -118, y: 118 });
  });

  it('waits for a position: none yet, it stays over the spawn', () => {
    const { controller, camera, moveTo } = setup(null);
    controller.step({});
    expect(camera.position.x).toBe(MOBAConfig.CHAMPION_SPAWN.BLUE.x);
    moveTo({ x: 500, y: -500 });
    controller.step({});
    expect(camera.position).toEqual({ x: 500, y: -500 });
  });

  it('unlocked, it then stays where it is as the champion walks', () => {
    const { controller, camera, moveTo } = setup({ x: 0, y: 0 });
    controller.step({});
    moveTo({ x: 300, y: 300 });
    controller.step({});
    expect(camera.position).toEqual({ x: 0, y: 0 });
  });
});
