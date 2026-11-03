/**
 * Pinging and emoting: the ping wheel and the emote wheel.
 *
 * - Alt (or G) + left-click pings the spot clicked, on the map or the
 *   minimap ("look"). Held, a wheel comes up around the click: dragging
 *   toward an option and letting go pings that one (danger, on my way,
 *   help, missing) at the spot clicked.
 * - Holding T brings up the emote wheel around the cursor: letting go over
 *   an emote shows it over the champion.
 *
 * The server sends pings to the team only and limits them (InputHandler);
 * Signals keeps them, render/overlays/signals.ts and OnlineMinimap draw them.
 */

import { ScreenEntity } from '@/core/GameObject';
import GameContext from '@/core/gameContext';
import RenderElement from '@/render/renderElement';
import RenderUtils from '@/render/utils';
import Vector from '@/physics/vector';
import { Dimensions } from '@/core/canvas';
import { InputManager } from '@/core/input/InputManager';
import { drawPixelArt } from '@/render/pixelArt';
import type { NetworkClient } from '@siege/client';
import type { OnlineStateManager } from '@/core/OnlineStateManager';
import { EMOTES, type EmoteId, type PingType } from '@siege/shared';
import { EMOTE_LABELS, emoteIcon, pingIcon, PING_STYLE } from '@/ui/signalIcons';

/** The ping wheel's options, clockwise from the top */
const PING_WHEEL: PingType[] = ['danger', 'on_my_way', 'assist', 'missing'];

const WHEEL = {
  /** Past this far (CSS pixels) from the center, the pointer picks an option */
  deadZone: 22,
  /** A ping click held this long (ms) brings up its wheel, even before a drag */
  pingWheelDelay: 160,
  pingRadius: 64,
  emoteRadius: 84,
  slot: 40,
};

/** Whether the ping key (Alt or G) is held: a left-click pings instead of selecting */
export function isPingModifierDown(input: InputManager): boolean {
  return input.isKeyDown('Alt') || input.isKeyDown('g') || input.isKeyDown('G');
}

type OpenWheel =
  | { kind: 'ping'; center: Vector; at: Vector; openedAt: number }
  | { kind: 'emote'; center: Vector };

export class SignalWheel extends ScreenEntity {
  private readonly input = InputManager.getInstance();
  private wheel: OpenWheel | null = null;

  constructor(
    private readonly networkClient: NetworkClient,
    private readonly stateManager: OnlineStateManager,
    /** A screen point over the minimap as a world point, or null if it isn't over it */
    private readonly minimapLocator: (screenX: number, screenY: number) => Vector | null,
  ) {
    super('signal-wheel');
  }

  step(ctx: GameContext): void {
    const mouse = this.input.getMousePosition();

    // Ping: Alt/G + left press opens it at the spot; letting go sends it
    if (!this.wheel && isPingModifierDown(this.input) && this.input.isLeftMouseJustPressed()) {
      const at = this.minimapLocator(mouse.x, mouse.y) ?? screenToWorld(mouse, ctx.camera);
      this.wheel = { kind: 'ping', center: mouse.clone(), at, openedAt: performance.now() };
    }
    if (this.wheel?.kind === 'ping' && !this.input.isLeftMouseDown()) {
      const pingType = this.selected(PING_WHEEL.length) ?? -1;
      const at = this.wheel.at;
      this.networkClient.sendPingInput(PING_WHEEL[pingType] ?? 'look', at.x, at.y);
      this.wheel = null;
    }

    // Emote: hold T, let go over one
    if (!this.wheel && this.input.isKeyJustPressed('t') && !this.isDead()) {
      this.wheel = { kind: 'emote', center: mouse.clone() };
    }
    if (this.wheel?.kind === 'emote' && !this.input.isKeyDown('t')) {
      const index = this.selected(EMOTES.length);
      if (index !== null) this.networkClient.sendEmoteInput(EMOTES[index]);
      this.wheel = null;
    }
  }

  private isDead(): boolean {
    return this.stateManager.getChampionSnapshot(this.stateManager.getLocalEntityId())?.isDead ?? false;
  }

  /** The option (of `count`, clockwise from the top) the pointer is toward, or null in the middle */
  private selected(count: number): number | null {
    if (!this.wheel) return null;
    const mouse = this.input.getMousePosition();
    const dx = mouse.x - this.wheel.center.x;
    const dy = mouse.y - this.wheel.center.y;
    if (Math.hypot(dx, dy) < WHEEL.deadZone) return null;
    const fromTop = Math.atan2(dy, dx) + Math.PI / 2;
    const step = (Math.PI * 2) / count;
    return ((Math.round(fromTop / step) % count) + count) % count;
  }

  render(): RenderElement {
    return this.createOverlayRender((ctx: GameContext) => {
      const wheel = this.wheel;
      if (!wheel) return;
      const c = ctx.canvasRenderingContext;
      if (wheel.kind === 'ping') {
        // A quick click pings without the wheel flashing up
        const dragged = this.selected(PING_WHEEL.length) !== null;
        if (!dragged && performance.now() - wheel.openedAt < WHEEL.pingWheelDelay) return;
        const index = this.selected(PING_WHEEL.length);
        this.drawWheel(c, wheel.center, WHEEL.pingRadius, PING_WHEEL.map(type => ({
          icon: pingIcon(type),
          label: PING_STYLE[type].label,
          color: PING_STYLE[type].color,
        })), index, { icon: pingIcon('look'), label: PING_STYLE.look.label });
      } else {
        const index = this.selected(EMOTES.length);
        this.drawWheel(c, wheel.center, WHEEL.emoteRadius, EMOTES.map((emote: EmoteId) => ({
          icon: emoteIcon(emote),
          label: EMOTE_LABELS[emote],
          color: '#ffd23f',
        })), index, null);
      }
    });
  }

  /**
   * A wheel: its options around `center`, the one picked lit and named, and
   * in the middle what letting go there does (null: nothing).
   */
  private drawWheel(
    c: CanvasRenderingContext2D,
    center: Vector,
    radius: number,
    options: { icon: HTMLCanvasElement; label: string; color: string }[],
    picked: number | null,
    middle: { icon: HTMLCanvasElement; label: string } | null,
  ): void {
    // Kept on screen
    const reach = radius + WHEEL.slot;
    const cx = Math.max(reach, Math.min(Dimensions.w - reach, center.x));
    const cy = Math.max(reach, Math.min(Dimensions.h - reach, center.y));
    c.save();
    c.fillStyle = 'rgba(12, 10, 24, 0.72)';
    c.beginPath();
    c.arc(cx, cy, radius + WHEEL.slot * 0.75, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    c.lineWidth = 2;
    c.stroke();

    options.forEach((option, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / options.length;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const isPicked = index === picked;
      const size = isPicked ? WHEEL.slot * 1.2 : WHEEL.slot;
      c.fillStyle = isPicked ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.35)';
      c.beginPath();
      c.arc(x, y, size * 0.62, 0, Math.PI * 2);
      c.fill();
      if (isPicked) {
        c.strokeStyle = option.color;
        c.lineWidth = 3;
        c.stroke();
      }
      const art = size * 0.8;
      drawPixelArt(c, option.icon, x - art / 2, y - art / 2, art, art);
    });

    // The middle: what letting go there does, and the name of what's picked
    const label = picked !== null ? options[picked].label : middle?.label;
    if (picked === null && middle) {
      const art = WHEEL.slot * 0.6;
      drawPixelArt(c, middle.icon, cx - art / 2, cy - art / 2 - 6, art, art);
    }
    if (label) {
      RenderUtils.renderBitmapText(c, label, cx, cy + (picked === null && middle ? 12 : -8), {
        size: 16,
        color: picked !== null ? options[picked].color : '#ffffff',
        centered: true,
      });
    }
    c.restore();
  }
}

/** The world point under a screen point */
function screenToWorld(screen: Vector, camera: { zoom: number; position: { x: number; y: number } }): Vector {
  return new Vector(
    (screen.x - Dimensions.w / 2) / camera.zoom + camera.position.x,
    (screen.y - Dimensions.h / 2) / camera.zoom + camera.position.y,
  );
}
